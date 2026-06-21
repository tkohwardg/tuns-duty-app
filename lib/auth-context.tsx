import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { loginWithEmail, logout as firebaseLogout, onAuthChange, db, COLLECTIONS } from "./firebase";
import type { UserProfile } from "./firebase";
import { doc, getDoc } from "firebase/firestore";
import type { User } from "firebase/auth";

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  isLoading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  isLoading: true,
  isAdmin: false,
  login: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Timeout: if auth doesn't resolve in 10s, stop loading
    const timeout = setTimeout(() => {
      setIsLoading(false);
    }, 10000);

    const unsubscribe = onAuthChange(async (firebaseUser) => {
      clearTimeout(timeout);
      setUser(firebaseUser);
      if (firebaseUser && db) {
        try {
          const userDocRef = doc(db as any, COLLECTIONS.USERS, firebaseUser.uid);
          // Race profile fetch with 8s timeout
          const profileTimeout = new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error("Profile fetch timeout")), 8000)
          );
          const userDocSnap = await Promise.race([getDoc(userDocRef), profileTimeout]) as any;
          if (userDocSnap && userDocSnap.exists()) {
            const profile = userDocSnap.data() as UserProfile;
            setUserProfile(profile);
            await AsyncStorage.setItem("userProfile", JSON.stringify(profile));
          }
        } catch (error) {
          // Fallback to cached profile
          const cached = await AsyncStorage.getItem("userProfile");
          if (cached) {
            setUserProfile(JSON.parse(cached));
          }
        }
      } else {
        setUserProfile(null);
        await AsyncStorage.removeItem("userProfile");
      }
      setIsLoading(false);
    });

    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    if (!db) throw new Error("Firebase not initialized");
    const credential = await loginWithEmail(email, password);
    const firebaseUser = credential.user;

    // Fetch user profile
    const userDocRef = doc(db as any, COLLECTIONS.USERS, firebaseUser.uid);
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) {
      const profile = userDocSnap.data() as UserProfile;
      setUserProfile(profile);
      await AsyncStorage.setItem("userProfile", JSON.stringify(profile));
    }
  };

  const logout = async () => {
    await firebaseLogout();
    setUser(null);
    setUserProfile(null);
    await AsyncStorage.removeItem("userProfile");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        isLoading,
        isAdmin: userProfile?.role === "admin",
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuthContext = () => useContext(AuthContext);
