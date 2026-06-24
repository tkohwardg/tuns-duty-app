import React, { useState } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  Alert,
  ScrollView,
  Modal,
  ActivityIndicator,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useAuthContext } from "@/lib/auth-context";
import { useSettings } from "@/lib/settings-context";
import { router } from "expo-router";
import { addDutyRequest, checkDuplicateRequest, type DutyType } from "@/lib/firebase";
import { submitToGoogleSheet } from "@/lib/google-sheets";
import { DatePickerCalendar } from "@/components/date-picker-calendar";

interface RequestRow {
  date: Date | null;
  dutyType: DutyType | null;
}

function formatDate(date: Date): string {
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

function formatToday(): string {
  const d = new Date();
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

const INITIAL_REQUESTS: RequestRow[] = [
  { date: null, dutyType: null },
  { date: null, dutyType: null },
  { date: null, dutyType: null },
  { date: null, dutyType: null },
  { date: null, dutyType: null },
];

export default function RequestDutyScreen() {
  const { userProfile, logout } = useAuthContext();
  const { settings } = useSettings();
  const dutyOptions = settings.dutyOptions.map((o) => o.label);
  const [requests, setRequests] = useState<RequestRow[]>(
    INITIAL_REQUESTS.map((r) => ({ ...r }))
  );
  const [rowErrors, setRowErrors] = useState<(string | null)[]>([null, null, null, null, null]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState<number | null>(null);
  const [showDutyPicker, setShowDutyPicker] = useState<number | null>(null);

  const handleReset = (index: number) => {
    const updated = [...requests];
    updated[index] = { date: null, dutyType: null };
    setRequests(updated);
    // Clear error for this row when reset
    setRowErrors((prev) => {
      const errs = [...prev];
      errs[index] = null;
      return errs;
    });
  };

  const handleDateSelect = (index: number, date: Date) => {
    const updated = [...requests];
    updated[index].date = date;
    setRequests(updated);
    setShowDatePicker(null);
    // Clear error for this row when user makes a change (they'll see it again on submit if still incomplete)
    setRowErrors((prev) => {
      const errs = [...prev];
      errs[index] = null;
      return errs;
    });
  };

  const handleDutySelect = (index: number, duty: DutyType) => {
    const updated = [...requests];
    updated[index].dutyType = duty;
    setRequests(updated);
    setShowDutyPicker(null);
    // Clear error for this row
    setRowErrors((prev) => {
      const errs = [...prev];
      errs[index] = null;
      return errs;
    });
  };

  const handleSubmit = async () => {
    // Validate: if one field is filled, both must be filled
    const newErrors: (string | null)[] = [null, null, null, null, null];
    let hasError = false;
    for (let i = 0; i < requests.length; i++) {
      const r = requests[i];
      if (r.date && !r.dutyType) {
        newErrors[i] = "Please select a duty type";
        hasError = true;
      } else if (!r.date && r.dutyType) {
        newErrors[i] = "Please select a date";
        hasError = true;
      }
    }
    setRowErrors(newErrors);
    if (hasError) return;

    const validRequests = requests.filter((r) => r.date && r.dutyType);
    if (validRequests.length === 0) {
      Alert.alert("Error", "Please fill in at least one complete request (date + duty type).");
      return;
    }

    if (!userProfile) {
      Alert.alert("Error", "User profile not found. Please login again.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Check for duplicates first — show inline row errors
      const dupErrors: (string | null)[] = [null, null, null, null, null];
      let hasDupError = false;
      for (let i = 0; i < validRequests.length; i++) {
        const req = validRequests[i];
        if (!req.date || !req.dutyType) continue;
        const dateStr = formatDate(req.date);
        const isDuplicate = await checkDuplicateRequest(
          userProfile.uid,
          dateStr,
          req.dutyType
        );
        if (isDuplicate) {
          // Find the original index in requests array
          const origIdx = requests.findIndex(
            (r) => r.date && formatDate(r.date) === dateStr && r.dutyType === req.dutyType
          );
          if (origIdx >= 0) {
            dupErrors[origIdx] = `"${req.dutyType}" on ${dateStr} already approved or pending`;
          }
          hasDupError = true;
        }
      }
      if (hasDupError) {
        setRowErrors(dupErrors);
        setIsSubmitting(false);
        return;
      }

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

        const docRef = await addDutyRequest(dutyRequest);

        await submitToGoogleSheet({
          ...dutyRequest,
          timestamp: new Date().toISOString(),
          requestId: docRef.id,
        });
      }

      Alert.alert("Success", "Your duty request(s) have been submitted.");
      // Clear all slots after submission
      setRequests(INITIAL_REQUESTS.map((r) => ({ ...r })));
      setRowErrors([null, null, null, null, null]);
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
          <Text className="text-3xl font-bold text-foreground">{settings.wardName}</Text>
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

        {/* Request Rows (5 slots) */}
        {requests.map((req, index) => (
          <View key={index} className="mb-3">
            <View className="flex-row items-center py-3 px-2 border-b border-border">
              <Text className="text-base font-bold text-foreground w-24">
                Request {index + 1}
              </Text>

              <TouchableOpacity
                onPress={() => setShowDatePicker(index)}
                className="flex-1 mx-2 py-2 px-3 rounded-lg border bg-surface"
                style={{
                  borderColor: rowErrors[index] && !req.date ? "#EF4444" : "#E5E7EB",
                }}
              >
                <Text className={`text-sm ${req.date ? "text-foreground" : "text-muted"}`}>
                  {req.date ? formatDate(req.date) : "Date"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowDutyPicker(index)}
                className="flex-1 mx-2 py-2 px-3 rounded-lg border bg-surface"
                style={{
                  borderColor: rowErrors[index] && !req.dutyType ? "#EF4444" : "#E5E7EB",
                }}
              >
                <Text className={`text-sm ${req.dutyType ? "text-foreground" : "text-muted"}`}>
                  {req.dutyType || "Select duty"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleReset(index)}
                style={{ backgroundColor: "#E91E8B" }}
                className="w-10 h-10 rounded-full items-center justify-center"
              >
                <Text className="text-white text-xs font-semibold">Reset</Text>
              </TouchableOpacity>
            </View>
            {rowErrors[index] && (
              <Text
                className="text-xs px-2 mt-1"
                style={{ color: "#EF4444" }}
              >
                {rowErrors[index]}
              </Text>
            )}
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

        {/* Log out Button */}
        <TouchableOpacity
          onPress={handleLogout}
          className="mt-4 rounded-xl py-3 items-center"
          style={{ backgroundColor: "#F44336" }}
        >
          <Text className="text-white text-sm font-semibold">Log out</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Date Picker Calendar Modal */}
      <DatePickerCalendar
        visible={showDatePicker !== null}
        onClose={() => setShowDatePicker(null)}
        onSelectDate={(date) => {
          if (showDatePicker !== null) {
            handleDateSelect(showDatePicker, date);
          }
        }}
        selectedDate={showDatePicker !== null ? requests[showDatePicker].date : null}
        title="Select Date"
      />

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
            {dutyOptions.map((duty) => (
              <TouchableOpacity
                key={duty}
                onPress={() => handleDutySelect(showDutyPicker!, duty as DutyType)}
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
