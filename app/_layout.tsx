import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ThemeProvider } from "@/lib/theme-provider";
import { AuthProvider, useAuthContext } from "@/lib/auth-context";
import { SettingsProvider } from "@/lib/settings-context";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { useFonts } from "expo-font";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as SplashScreen from "expo-splash-screen";
import "../global.css";

// Keep splash screen visible while fonts load
SplashScreen.preventAutoHideAsync();

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthContext();

  useEffect(() => {
    if (isLoading) return;
    if (user) {
      router.replace("/(tabs)");
    } else {
      router.replace("/login");
    }
  }, [user, isLoading]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    ...MaterialIcons.font,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

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
