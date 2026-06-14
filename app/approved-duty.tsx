import React, { useState, useEffect, useCallback } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useAuthContext } from "@/lib/auth-context";
import { getAllApprovedRequests, type DutyRequest } from "@/lib/firebase";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

export default function ApprovedDutyScreen() {
  const { userProfile } = useAuthContext();
  const [approvedRequests, setApprovedRequests] = useState<DutyRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  const loadApproved = useCallback(async () => {
    setIsLoading(true);
    try {
      const approved = await getAllApprovedRequests();
      setApprovedRequests(approved);
    } catch (error) {
      console.error("Error loading approved requests:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadApproved();
  }, [loadApproved]);

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

  // Check if a date has approved duties
  const getApprovedForDate = (day: number): DutyRequest[] => {
    const dateStr = `${day}/${currentMonth + 1}/${currentYear}`;
    return approvedRequests.filter((r) => r.date === dateStr);
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
    const today = new Date();
    const isCurrentMonth =
      today.getMonth() === currentMonth && today.getFullYear() === currentYear;

    const weekDays = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];
    const cells: React.ReactNode[] = [];

    // Week day headers
    weekDays.forEach((day, i) => (
      cells.push(
        <View key={`header-${i}`} className="flex-1 items-center py-2">
          <Text className="text-xs text-muted font-medium">{day}</Text>
        </View>
      )
    ));

    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
      cells.push(<View key={`empty-${i}`} className="flex-1 items-center py-2" />);
    }

    // Day cells
    for (let day = 1; day <= daysInMonth; day++) {
      const isToday = isCurrentMonth && today.getDate() === day;
      const approvedForDay = getApprovedForDate(day);
      const hasApproved = approvedForDay.length > 0;

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
          {hasApproved && (
            <Text className="text-xs text-muted mt-0.5" numberOfLines={1}>
              {approvedForDay.length > 1 ? `還有另...` : ""}
            </Text>
          )}
        </View>
      );
    }

    // Render in rows of 7
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

  const renderApprovedItem = ({ item }: { item: DutyRequest }) => (
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
      <Text className="text-base font-medium text-foreground ml-2">
        {item.dutyType}
      </Text>
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
        <Text className="text-xl font-bold text-foreground">Approved duty</Text>
      </View>

      {/* Approved List */}
      <View className="mx-4 mt-4 border border-border rounded-xl overflow-hidden max-h-60">
        {approvedRequests.length === 0 ? (
          <View className="items-center justify-center py-10">
            <Text className="text-muted text-base">No approved duties</Text>
          </View>
        ) : (
          <FlatList
            data={approvedRequests}
            renderItem={renderApprovedItem}
            keyExtractor={(item) => item.id || Math.random().toString()}
          />
        )}
      </View>

      {/* Calendar */}
      <View className="mx-4 mt-4 border border-border rounded-xl p-3 bg-surface">
        {/* Calendar Header */}
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

        {/* Calendar Grid */}
        {renderCalendar()}
      </View>
    </ScreenContainer>
  );
}
