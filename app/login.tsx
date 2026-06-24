import React, { useState } from "react";
import {
  Text,
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useAuthContext } from "@/lib/auth-context";
import { useSettings } from "@/lib/settings-context";
import { router } from "expo-router";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const { login } = useAuthContext();
  const { settings } = useSettings();

  const handleLogin = async () => {
    setErrorMessage("");
    if (!email.trim() || !password.trim()) {
      setErrorMessage("Please enter both email and password.");
      return;
    }
    setIsLoading(true);
    try {
      await login(email.trim(), password.trim());
      router.replace("/(tabs)");
    } catch (error: any) {
      let message = "Login failed. Please check your credentials.";
      if (
        error?.code === "auth/user-not-found" ||
        error?.code === "auth/invalid-credential" ||
        error?.code === "auth/wrong-password"
      ) {
        message = "Incorrect email or password. Please try again.";
      } else if (error?.code === "auth/invalid-email") {
        message = "Please enter a valid email address.";
      } else if (error?.code === "auth/too-many-requests") {
        message = "Too many failed attempts. Please try again later.";
      } else if (error?.code === "auth/network-request-failed") {
        message = "Network error. Please check your connection.";
      }
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <View className="flex-1 justify-center px-8">
          {/* Header */}
          <View className="items-center mb-12">
            <Text className="text-4xl font-bold text-foreground">{settings.wardName}</Text>
            <Text className="text-xl text-muted mt-2">TUNS Request Duty</Text>
          </View>

          {/* Form */}
          <View className="gap-4">
            {/* Inline Error Message */}
            {errorMessage !== "" && (
              <View
                className="rounded-xl px-4 py-3"
                style={{ backgroundColor: "#FEE2E2", borderWidth: 1, borderColor: "#EF4444" }}
              >
                <Text style={{ color: "#DC2626", fontSize: 14, textAlign: "center" }}>
                  {errorMessage}
                </Text>
              </View>
            )}
            <View>
              <Text className="text-sm font-medium text-foreground mb-1">
                Hospital Email
              </Text>
              <TextInput
                className="border border-border rounded-xl px-4 py-3 text-base text-foreground bg-surface"
                placeholder="Enter your hospital email"
                placeholderTextColor="#9BA1A6"
                value={email}
                onChangeText={(t) => { setEmail(t); setErrorMessage(""); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>

            <View>
              <Text className="text-sm font-medium text-foreground mb-1">
                Password
              </Text>
              <TextInput
                className="border border-border rounded-xl px-4 py-3 text-base text-foreground bg-surface"
                placeholder="Enter your password"
                placeholderTextColor="#9BA1A6"
                value={password}
                onChangeText={(t) => { setPassword(t); setErrorMessage(""); }}
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
            </View>

            <TouchableOpacity
              onPress={handleLogin}
              disabled={isLoading}
              className="mt-6 rounded-xl py-4 items-center"
              style={{ backgroundColor: isLoading ? "#9CA3AF" : "#4CAF50" }}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white text-lg font-semibold">Login</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
