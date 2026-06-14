import React, { useState, useCallback } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  Alert,
  ScrollView,
  Platform,
  Modal,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useAuthContext } from "@/lib/auth-context";
import { router } from "expo-router";
import { addDutyRequest, type DutyType } from "@/lib/firebase";
import { submitToGoogleSheet } from "@/lib/google-sheets";
import { Timestamp } from "firebase/firestore";

const DUTY_OPTIONS: DutyType[] = ["A", "P", "0900-1700", "0900-1300"];

interface RequestRow {
  date: Date | null;
  dutyType: DutyType | null;
}

function getMinDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getMaxDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 7 + 56); // 7 days + 8 weeks
  d.setHours(23, 59, 59, 999);
  return d;
}

function formatDate(date: Date): string {
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

function formatToday(): string {
  const d = new Date();
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

// Generate available dates for the picker
function getAvailableDates(): Date[] {
  const dates: Date[] = [];
  const min = getMinDate();
  const max = getMaxDate();
  const current = new Date(min);
  while (current <= max) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

export default function RequestDutyScreen() {
  const { userProfile, isAdmin, logout } = useAuthContext();
  const [requests, setRequests] = useState<RequestRow[]>([
    { date: null, dutyType: null },
    { date: null, dutyType: null },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState<number | null>(null);
  const [showDutyPicker, setShowDutyPicker] = useState<number | null>(null);

  const availableDates = getAvailableDates();

  const handleReset = (index: number) => {
    const updated = [...requests];
    updated[index] = { date: null, dutyType: null };
    setRequests(updated);
  };

  const handleDateSelect = (index: number, date: Date) => {
    const updated = [...requests];
    updated[index].date = date;
    setRequests(updated);
    setShowDatePicker(null);
  };

  const handleDutySelect = (index: number, duty: DutyType) => {
    const updated = [...requests];
    updated[index].dutyType = duty;
    setRequests(updated);
    setShowDutyPicker(null);
  };

  const handleSubmit = async () => {
    const validRequests = requests.filter((r) => r.date && r.dutyType);
    if (validRequests.length === 0) {
      Alert.alert("Error", "Please select at least one date and duty type.");
      return;
    }

    if (!userProfile) {
      Alert.alert("Error", "User profile not found. Please login again.");
      return;
    }

    setIsSubmitting(true);
    try {
      for (const req of validRequests) {
        if (!req.date || !req.dutyType) continue;

        const dutyRequest = {
          userId: userProfile.uid,
          userName: userProfile.name,
          userEmail: userProfile.email,
          date: formatDate(req.date),
          dutyType: req.dutyType,
          status: "pending" as const,
        };

        // Submit to Firestore
        const docRef = await addDutyRequest(dutyRequest);

        // Submit to Google Sheets
        await submitToGoogleSheet({
          ...dutyRequest,
          timestamp: new Date().toISOString(),
          requestId: docRef.id,
        });
      }

      Alert.alert("Success", "Your duty request(s) have been submitted.");
      // Reset form
      setRequests([
        { date: null, dutyType: null },
        { date: null, dutyType: null },
      ]);
    } catch (error) {
      console.error("Submit error:", error);
      Alert.alert("Error", "Failed to submit request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.replace("/login" as any);
    } catch (error) {
      Alert.alert("Error", "Failed to logout.");
    }
  };

  return (
    <ScreenContainer className="px-4">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="items-center mt-4 mb-6">
          <Text className="text-3xl font-bold text-foreground">Ward 8S</Text>
          <Text className="text-xl text-muted mt-1">TUNS Request duty</Text>
        </View>

        {/* Info Section */}
        <View className="mb-6">
          <View className="flex-row items-center mb-2">
            <Text className="text-base font-bold text-foreground w-24">Today:</Text>
            <Text className="text-base text-foreground">{formatToday()}</Text>
          </View>
          <View className="flex-row items-center">
            <Text className="text-base font-bold text-foreground w-24">Name:</Text>
            <Text className="text-base text-foreground">
              {userProfile?.name || "Loading..."}
            </Text>
          </View>
        </View>

        {/* Request Rows */}
        {requests.map((req, index) => (
          <View
            key={index}
            className="flex-row items-center mb-4 py-3 px-2 border-b border-border"
          >
            <Text className="text-base font-bold text-foreground w-24">
              Request {index + 1}
            </Text>

            {/* Date Picker Button */}
            <TouchableOpacity
              onPress={() => setShowDatePicker(index)}
              className="flex-1 mx-2 py-2 px-3 rounded-lg border border-border bg-surface"
            >
              <Text className={`text-sm ${req.date ? "text-foreground" : "text-muted"}`}>
                {req.date ? formatDate(req.date) : "Date"}
              </Text>
            </TouchableOpacity>

            {/* Duty Picker Button */}
            <TouchableOpacity
              onPress={() => setShowDutyPicker(index)}
              className="flex-1 mx-2 py-2 px-3 rounded-lg border border-border bg-surface"
            >
              <Text className={`text-sm ${req.dutyType ? "text-foreground" : "text-muted"}`}>
                {req.dutyType || "Select duty"}
              </Text>
            </TouchableOpacity>

            {/* Reset Button */}
            <TouchableOpacity
              onPress={() => handleReset(index)}
              style={{ backgroundColor: "#E91E8B" }}
              className="w-10 h-10 rounded-full items-center justify-center"
            >
              <Text className="text-white text-xs font-semibold">Reset</Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* Submit Button */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={isSubmitting}
          className="mt-6 rounded-2xl py-4 items-center"
          style={{ backgroundColor: "#4CAF50" }}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white text-lg font-semibold">Submit</Text>
          )}
        </TouchableOpacity>

        {/* Navigation Buttons */}
        <View className="flex-row mt-6 gap-3">
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/my-requests" as any)}
            className="flex-1 rounded-xl py-3 items-center"
            style={{ backgroundColor: "#E91E8B" }}
          >
            <Text className="text-white text-sm font-semibold">
              Review Requested duty
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/approved-duty" as any)}
            className="flex-1 rounded-xl py-3 items-center"
            style={{ backgroundColor: "#3F51B5" }}
          >
            <Text className="text-white text-sm font-semibold">
              Review Approved duty
            </Text>
          </TouchableOpacity>
        </View>

        {/* Bottom Buttons */}
        <View className="flex-row mt-4 gap-3">
          <TouchableOpacity
            onPress={handleLogout}
            className="flex-1 rounded-xl py-3 items-center"
            style={{ backgroundColor: "#F44336" }}
          >
            <Text className="text-white text-sm font-semibold">Log out</Text>
          </TouchableOpacity>

          {isAdmin && (
            <TouchableOpacity
              onPress={() => router.push("/admin-approve" as any)}
              className="flex-1 rounded-xl py-3 items-center"
              style={{ backgroundColor: "#FF9800" }}
            >
              <Text className="text-white text-sm font-semibold">
                Admin approve duty
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Date Picker Modal */}
      <Modal
        visible={showDatePicker !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDatePicker(null)}
      >
        <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View className="bg-background rounded-t-3xl p-4 max-h-96">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-lg font-bold text-foreground">Select Date</Text>
              <TouchableOpacity onPress={() => setShowDatePicker(null)}>
                <Text className="text-base" style={{ color: "#3F51B5" }}>Cancel</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={availableDates}
              keyExtractor={(item) => item.toISOString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => handleDateSelect(showDatePicker!, item)}
                  className="py-3 px-4 border-b border-border"
                >
                  <Text className="text-base text-foreground">
                    {item.toLocaleDateString("en-GB", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Duty Picker Modal */}
      <Modal
        visible={showDutyPicker !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDutyPicker(null)}
      >
        <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View className="bg-background rounded-t-3xl p-4">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-lg font-bold text-foreground">Select Duty</Text>
              <TouchableOpacity onPress={() => setShowDutyPicker(null)}>
                <Text className="text-base" style={{ color: "#3F51B5" }}>Cancel</Text>
              </TouchableOpacity>
            </View>
            {DUTY_OPTIONS.map((duty) => (
              <TouchableOpacity
                key={duty}
                onPress={() => handleDutySelect(showDutyPicker!, duty)}
                className="py-4 px-4 border-b border-border"
              >
                <Text className="text-lg text-foreground">{duty}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
