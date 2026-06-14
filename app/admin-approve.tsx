import React, { useState, useEffect, useCallback } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useAuthContext } from "@/lib/auth-context";
import {
  getAllPendingRequests,
  updateDutyRequestStatus,
  type DutyRequest,
} from "@/lib/firebase";
import { updateSheetStatus } from "@/lib/google-sheets";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

export default function AdminApproveScreen() {
  const { userProfile, isAdmin } = useAuthContext();
  const [pendingRequests, setPendingRequests] = useState<DutyRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<DutyRequest | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  const loadPending = useCallback(async () => {
    setIsLoading(true);
    try {
      const pending = await getAllPendingRequests();
      setPendingRequests(pending);
    } catch (error) {
      console.error("Error loading pending requests:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  const handleApprove = async (request: DutyRequest) => {
    if (!request.id) return;
    Alert.alert(
      "Approve Request",
      `Approve ${request.userName}'s duty on ${request.date} (${request.dutyType})?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Approve",
          onPress: async () => {
            try {
              await updateDutyRequestStatus(request.id!, "approved");
              await updateSheetStatus(request.id!, "approved");
              setPendingRequests((prev) =>
                prev.filter((r) => r.id !== request.id)
              );
              Alert.alert("Done", "Request approved.");
            } catch (error) {
              Alert.alert("Error", "Failed to approve request.");
            }
          },
        },
      ]
    );
  };

  const handleReject = async (request: DutyRequest) => {
    if (!request.id) return;
    Alert.alert(
      "Reject Request",
      `Reject ${request.userName}'s duty on ${request.date} (${request.dutyType})?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: async () => {
            try {
              await updateDutyRequestStatus(request.id!, "rejected");
              await updateSheetStatus(request.id!, "rejected");
              setPendingRequests((prev) =>
                prev.filter((r) => r.id !== request.id)
              );
              Alert.alert("Done", "Request rejected.");
            } catch (error) {
              Alert.alert("Error", "Failed to reject request.");
            }
          },
        },
      ]
    );
  };

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
    const today = new Date();
    const isCurrentMonth =
      today.getMonth() === currentMonth && today.getFullYear() === currentYear;

    const weekDays = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];
    const cells: React.ReactNode[] = [];

    weekDays.forEach((day, i) =>
      cells.push(
        <View key={`header-${i}`} className="flex-1 items-center py-2">
          <Text className="text-xs text-muted font-medium">{day}</Text>
        </View>
      )
    );

    for (let i = 0; i < firstDay; i++) {
      cells.push(<View key={`empty-${i}`} className="flex-1 items-center py-2" />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const isToday = isCurrentMonth && today.getDate() === day;
      const dateStr = `${day}/${currentMonth + 1}/${currentYear}`;
      const requestsForDay = pendingRequests.filter((r) => r.date === dateStr);
      const hasRequests = requestsForDay.length > 0;

      cells.push(
        <View key={`day-${day}`} className="flex-1 items-center py-2">
          <View
            className={`w-8 h-8 rounded-full items-center justify-center ${
              isToday ? "bg-primary" : ""
            }`}
          >
            <Text
              className={`text-sm ${
                isToday ? "text-white font-bold" : "text-foreground"
              }`}
            >
              {day}
            </Text>
          </View>
          {hasRequests && (
            <Text className="text-xs text-muted mt-0.5" numberOfLines={1}>
              ...
            </Text>
          )}
        </View>
      );
    }

    const rows: React.ReactNode[] = [];
    for (let i = 0; i < cells.length; i += 7) {
      rows.push(
        <View key={`row-${i}`} className="flex-row">
          {cells.slice(i, i + 7)}
        </View>
      );
    }

    return rows;
  };

  const renderPendingItem = ({ item }: { item: DutyRequest }) => (
    <View className="flex-row items-center py-4 px-4 border-b border-border">
      <View
        className="w-10 h-10 rounded-full mr-3"
        style={{ backgroundColor: "#D1D5DB" }}
      />
      <View className="flex-1">
        <Text className="text-base font-bold text-foreground" numberOfLines={1}>
          {item.userName}
        </Text>
        <Text className="text-sm text-muted">{item.date}</Text>
      </View>
      <Text className="text-base font-medium text-foreground mr-3">
        {item.dutyType}
      </Text>
      {/* Approve/Reject buttons */}
      <TouchableOpacity
        onPress={() => handleApprove(item)}
        className="mr-2 p-2"
      >
        <MaterialIcons name="check-circle" size={28} color="#22C55E" />
      </TouchableOpacity>
      <TouchableOpacity onPress={() => handleReject(item)} className="p-2">
        <MaterialIcons name="cancel" size={28} color="#EF4444" />
      </TouchableOpacity>
    </View>
  );

  if (isLoading) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#4CAF50" />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="flex-1">
      {/* Header */}
      <View className="items-center py-4 border-b border-border">
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ position: "absolute", left: 16, top: 16 }}
        >
          <MaterialIcons name="arrow-back" size={24} color="#11181C" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-foreground">
          Requests pending approval
        </Text>
      </View>

      {/* Staff Info */}
      {selectedRequest && (
        <View className="px-4 py-3">
          <Text className="text-sm text-muted">
            Selected Staff Name:{" "}
            <Text className="font-bold text-foreground">
              {selectedRequest.userName}
            </Text>
          </Text>
        </View>
      )}

      {/* Calendar */}
      <View className="mx-4 mt-2 border border-border rounded-xl p-3 bg-surface">
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-row items-center">
            <TouchableOpacity onPress={prevMonth} className="p-2">
              <MaterialIcons name="chevron-left" size={24} color="#11181C" />
            </TouchableOpacity>
            <TouchableOpacity onPress={nextMonth} className="p-2">
              <MaterialIcons name="chevron-right" size={24} color="#11181C" />
            </TouchableOpacity>
            <Text className="text-base font-bold text-foreground ml-2">
              {String(currentMonth + 1).padStart(2, "0")}/{currentYear}
            </Text>
          </View>
        </View>
        {renderCalendar()}
      </View>

      {/* Pending Requests List */}
      <View className="flex-1 mx-4 mt-4 border border-border rounded-xl overflow-hidden">
        {pendingRequests.length === 0 ? (
          <View className="flex-1 items-center justify-center py-10">
            <Text className="text-muted text-base">No pending requests</Text>
          </View>
        ) : (
          <FlatList
            data={pendingRequests}
            renderItem={renderPendingItem}
            keyExtractor={(item) => item.id || Math.random().toString()}
          />
        )}
      </View>

      {/* Bottom Buttons */}
      <View className="flex-row px-4 pb-6 pt-4 gap-3">
        <TouchableOpacity
          onPress={() => router.back()}
          className="flex-1 rounded-xl py-3 items-center"
          style={{ backgroundColor: "#4CAF50" }}
        >
          <Text className="text-white text-sm font-semibold">Request duty</Text>
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
    </ScreenContainer>
  );
}
