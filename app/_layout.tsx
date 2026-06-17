import { Stack, router, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ThemeProvider } from "@/lib/theme-provider";
import { AuthProvider, useAuthContext } from "@/lib/auth-context";
import { SettingsProvider } from "@/lib/settings-context";
import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, TouchableOpacity } from "react-native";
import "../global.css";

const AUTH_TIMEOUT_MS = 10000; // 10 seconds

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthContext();
  const segments = useSegments();
  const [timedOut, setTimedOut] = useState(false);

  // 10-second timeout for auth loading
  useEffect(() => {
    if (!isLoading) {
      setTimedOut(false);
      return;
    }
    const timer = setTimeout(() => {
      setTimedOut(true);
    }, AUTH_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [isLoading]);

  // Redirect based on auth state
  useEffect(() => {
    if (isLoading && !timedOut) return;

    const inAuthGroup = segments[0] === "login" || segments[0] === "oauth";

    if (!user && !inAuthGroup) {
      // Not logged in, redirect to login
      router.replace("/login");
    } else if (user && inAuthGroup) {
      // Logged in, redirect to tabs
      router.replace("/(tabs)");
    }
  }, [user, isLoading, segments, timedOut]);

  // Show timeout/error screen
  if (timedOut && isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" }}>
        <Text style={{ fontSize: 18, fontWeight: "bold", color: "#333", marginBottom: 8 }}>
          Connection Timeout
        </Text>
        <Text style={{ fontSize: 14, color: "#666", textAlign: "center", paddingHorizontal: 40, marginBottom: 20 }}>
          Unable to connect to the server. Please check your internet connection and try again.
        </Text>
        <TouchableOpacity
          onPress={() => {
            setTimedOut(false);
            // Force redirect to login so user can retry
            router.replace("/login");
          }}
          style={{
            backgroundColor: "#4CAF50",
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 8,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>Go to Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Show loading only briefly (max 10s)
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" }}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={{ fontSize: 14, color: "#666", marginTop: 12 }}>Connecting...</Text>
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AuthProvider>
          <SettingsProvider>
            <StatusBar style="dark" />
            <AuthGate>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="login" />
                <Stack.Screen name="(tabs)" />
              </Stack>
            </AuthGate>
          </SettingsProvider>
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
