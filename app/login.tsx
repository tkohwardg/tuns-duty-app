import React, { useState } from "react";
import {
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useAuthContext } from "@/lib/auth-context";
import { router } from "expo-router";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuthContext();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Error", "Please enter both email and staff number.");
      return;
    }

    setIsLoading(true);
    try {
      await login(email.trim(), password.trim());
      router.replace("/(tabs)");
    } catch (error: any) {
      let message = "Login failed. Please check your credentials.";
      if (error?.code === "auth/user-not-found") {
        message = "No account found with this email.";
      } else if (error?.code === "auth/wrong-password") {
        message = "Incorrect staff number.";
      } else if (error?.code === "auth/invalid-email") {
        message = "Please enter a valid email address.";
      }
      Alert.alert("Login Failed", message);
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
            <Text className="text-4xl font-bold text-foreground">Ward 8S</Text>
            <Text className="text-xl text-muted mt-2">TUNS Request Duty</Text>
          </View>

          {/* Form */}
          <View className="gap-4">
            <View>
              <Text className="text-sm font-medium text-foreground mb-1">
                Hospital Email
              </Text>
              <TextInput
                className="border border-border rounded-xl px-4 py-3 text-base text-foreground bg-surface"
                placeholder="Enter your hospital email"
                placeholderTextColor="#9BA1A6"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>

            <View>
              <Text className="text-sm font-medium text-foreground mb-1">
                Staff Number (Password)
              </Text>
              <TextInput
                className="border border-border rounded-xl px-4 py-3 text-base text-foreground bg-surface"
                placeholder="Enter your staff number"
                placeholderTextColor="#9BA1A6"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
            </View>

            <TouchableOpacity
              onPress={handleLogin}
              disabled={isLoading}
              className="mt-6 rounded-xl py-4 items-center"
              style={{ backgroundColor: "#4CAF50" }}
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
