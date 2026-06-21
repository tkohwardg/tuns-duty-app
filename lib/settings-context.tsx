import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

export interface DutyOption {
  label: string;
  hours: number;
  color: string;
}

export interface AppSettings {
  wardName: string;
  dutyOptions: DutyOption[];
}

const DEFAULT_SETTINGS: AppSettings = {
  wardName: "Ward 8S",
  dutyOptions: [
    { label: "A", hours: 7, color: "#EF4444" },
    { label: "P", hours: 7, color: "#3B82F6" },
    { label: "0900-1700", hours: 7, color: "#22C55E" },
    { label: "0900-1300", hours: 4, color: "#86EFAC" },
  ],
};

interface SettingsContextType {
  settings: AppSettings;
  isLoading: boolean;
  updateWardName: (name: string) => Promise<void>;
  addDutyOption: (option: DutyOption) => Promise<void>;
  removeDutyOption: (label: string) => Promise<void>;
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: DEFAULT_SETTINGS,
  isLoading: true,
  updateWardName: async () => {},
  addDutyOption: async () => {},
  removeDutyOption: async () => {},
  refreshSettings: async () => {},
});

const SETTINGS_DOC = "app_settings";
const SETTINGS_COLLECTION = "settings";

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  const loadSettings = useCallback(async () => {
    try {
      // Race with 10-second timeout
      const timeoutPromise = new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error("Settings load timeout")), 10000)
      );
      const docRef = doc(db as any, SETTINGS_COLLECTION, SETTINGS_DOC);
      const docSnap = await Promise.race([getDoc(docRef), timeoutPromise]) as any;
      if (docSnap && docSnap.exists()) {
        const data = docSnap.data() as AppSettings;
        setSettings({
          wardName: data.wardName || DEFAULT_SETTINGS.wardName,
          dutyOptions: data.dutyOptions && data.dutyOptions.length > 0
            ? data.dutyOptions
            : DEFAULT_SETTINGS.dutyOptions,
        });
      } else if (docSnap) {
        // Create default settings in Firestore
        try {
          await setDoc(doc(db as any, SETTINGS_COLLECTION, SETTINGS_DOC), DEFAULT_SETTINGS);
        } catch (e) {
          // Ignore write errors, use defaults
        }
      }
    } catch (error) {
      console.error("Error loading settings:", error);
      // Use default settings on error/timeout
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const saveSettings = async (newSettings: AppSettings) => {
    try {
      await setDoc(doc(db as any, SETTINGS_COLLECTION, SETTINGS_DOC), newSettings);
      setSettings(newSettings);
    } catch (error) {
      console.error("Error saving settings:", error);
      throw error;
    }
  };

  const updateWardName = async (name: string) => {
    await saveSettings({ ...settings, wardName: name });
  };

  const addDutyOption = async (option: DutyOption) => {
    const updated = [...settings.dutyOptions, option];
    await saveSettings({ ...settings, dutyOptions: updated });
  };

  const removeDutyOption = async (label: string) => {
    const updated = settings.dutyOptions.filter((o) => o.label !== label);
    await saveSettings({ ...settings, dutyOptions: updated });
  };

  const refreshSettings = async () => {
    await loadSettings();
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        isLoading,
        updateWardName,
        addDutyOption,
        removeDutyOption,
        refreshSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
