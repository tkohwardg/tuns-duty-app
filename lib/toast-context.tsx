import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Text, View } from "react-native";

type ToastKind = "success" | "error";
type ToastState = { message: string; kind: ToastKind } | null;
const ToastContext = createContext<{ showToast: (message: string, kind?: ToastKind) => void }>({ showToast: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((message: string, kind: ToastKind = "success") => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ message, kind });
    timer.current = setTimeout(() => setToast(null), 2800);
  }, []);
  return <ToastContext.Provider value={{ showToast }}><View style={{ flex: 1 }}>{children}{toast && <View pointerEvents="none" style={{ position: "absolute", left: 18, right: 18, bottom: 24, paddingHorizontal: 16, paddingVertical: 13, borderRadius: 12, backgroundColor: toast.kind === "success" ? "#15803D" : "#DC2626", shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 8, elevation: 8 }}><Text style={{ color: "#fff", fontSize: 14, fontWeight: "700", textAlign: "center" }}>{toast.message}</Text></View>}</View></ToastContext.Provider>;
}

export const useToast = () => useContext(ToastContext);
