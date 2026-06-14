import React, { useState, useEffect, useCallback } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  Modal,
  Animated,
  RefreshControl,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useAuthContext } from "@/lib/auth-context";
import {
  getAllPendingRequests,
  getAllApprovedRequests,
  updateDutyRequestStatus,
  type DutyRequest,
} from "@/lib/firebase";
import { updateSheetStatus } from "@/lib/google-sheets";
import { getDutyColor, getDaysInMonth, getFirstDayOfMonth, formatDateStr } from "@/lib/duty-colors";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Swipeable } from "react-native-gesture-handler";

export default function AdminApproveScreen() {
  const { isAdmin } = useAuthContext();
  const [pendingRequests, setPendingRequests] = useState<DutyRequest[]>([]);
  const [approvedRequests, setApprovedRequests] = useState<DutyRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [selectedDateDuties, setSelectedDateDuties] = useState<DutyRequest[]>([]);
  const [showDutyModal, setShowDutyModal] = useState(false);
  const [selectedDateStr, setSelectedDateStr] = useState("");

  const loadData = useCallback(async () => {
    try {
      const [pending, approved] = await Promise.all([
        getAllPendingRequests(),
        getAllApprovedRequests(),
      ]);
      setPendingRequests(pending);
      setApprovedRequests(approved);
    } catch (error) {
      console.error("Error loading data:", error);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await loadData();
      setIsLoading(false);
    };
    init();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleApprove = async (request: DutyRequest) => {
    if (!request.id) return;
    try {
      await updateDutyRequestStatus(request.id, "approved");
      await updateSheetStatus(request.id, "approved");
      setPendingRequests((prev) => prev.filter((r) => r.id !== request.id));
      setApprovedRequests((prev) => [request, ...prev]);
      Alert.alert("Done", "Request approved.");
    } catch (error) {
      Alert.alert("Error", "Failed to approve request.");
    }
  };

  const handleReject = async (request: DutyRequest) => {
    if (!request.id) return;
    try {
      await updateDutyRequestStatus(request.id, "rejected");
      await updateSheetStatus(request.id, "rejected");
      setPendingRequests((prev) => prev.filter((r) => r.id !== request.id));
      Alert.alert("Done", "Request rejected.");
    } catch (error) {
      Alert.alert("Error", "Failed to reject request.");
    }
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

  const getApprovedForDate = (day: number): DutyRequest[] => {
    const dateStr = formatDateStr(day, currentMonth, currentYear);
    return approvedRequests.filter((r) => r.date === dateStr);
  };

  const handleDateTap = (day: number) => {
    const duties = getApprovedForDate(day);
    if (duties.length > 0) {
      setSelectedDateDuties(duties);
      setSelectedDateStr(formatDateStr(day, currentMonth, currentYear));
      setShowDutyModal(true);
    }
  };

  // Swipe left to approve
  const renderRightActions = (request: DutyRequest) => {
    return (
      <TouchableOpacity
        onPress={() => handleApprove(request)}
        style={{ backgroundColor: "#22C55E" }}
        className="justify-center items-center px-5"
      >
        <MaterialIcons name="check" size={24} color="#fff" />
        <Text className="text-white text-xs font-semibold mt-1">Approve</Text>
      </TouchableOpacity>
    );
  };

  // Swipe right to reject
  const renderLeftActions = (request: DutyRequest) => {
    return (
      <TouchableOpacity
        onPress={() => handleReject(request)}
        style={{ backgroundColor: "#EF4444" }}
        className="justify-center items-center px-5"
      >
        <MaterialIcons name="close" size={24} color="#fff" />
        <Text className="text-white text-xs font-semibold mt-1">Reject</Text>
      </TouchableOpacity>
    );
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
    const today = new Date();
    const isCurrentMonth =
      today.getMonth() === currentMonth && today.getFullYear() === currentYear;

    const weekDays = ["日", "一", "二", "三", "四", "五", "六"];
    const cells: React.ReactNode[] = [];

    weekDays.forEach((day, i) =>
      cells.push(
        <View key={`header-${i}`} className="flex-1 items-center py-1">
          <Text className="text-xs text-muted font-medium">{day}</Text>
        </View>
      )
    );

    for (let i = 0; i < firstDay; i++) {
      cells.push(<View key={`empty-${i}`} className="flex-1 items-center py-1" />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const isToday = isCurrentMonth && today.getDate() === day;
      const approvedForDay = getApprovedForDate(day);
      const hasApproved = approvedForDay.length > 0;

      cells.push(
        <TouchableOpacity
          key={`day-${day}`}
          className="flex-1 items-center py-1"
          onPress={() => handleDateTap(day)}
        >
          <View
            className={`w-7 h-7 rounded-full items-center justify-center ${
              isToday ? "bg-primary" : ""
            }`}
          >
            <Text
              className={`text-xs ${
                isToday ? "text-white font-bold" : "text-foreground"
              }`}
            >
              {day}
            </Text>
          </View>
          {hasApproved && (
            <View className="flex-row mt-0.5 gap-0.5">
              {approvedForDay.slice(0, 3).map((r, idx) => (
                <View
                  key={idx}
                  style={{ backgroundColor: getDutyColor(r.dutyType), width: 6, height: 6, borderRadius: 3 }}
                />
              ))}
            </View>
          )}
        </TouchableOpacity>
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
    <Swipeable
      renderRightActions={() => renderRightActions(item)}
      renderLeftActions={() => renderLeftActions(item)}
      overshootRight={false}
      overshootLeft={false}
    >
      <View className="flex-row items-center py-3 px-4 bg-background border-b border-border">
        <View
          className="w-9 h-9 rounded-full mr-3"
          style={{ backgroundColor: "#D1D5DB" }}
        />
        <View className="flex-1">
          <Text className="text-sm font-bold text-foreground" numberOfLines={1}>
            {item.userName}
          </Text>
          <Text className="text-xs text-muted">{item.date}</Text>
        </View>
        <View
          style={{ backgroundColor: getDutyColor(item.dutyType) }}
          className="px-2 py-1 rounded"
        >
          <Text className="text-white text-xs font-bold">{item.dutyType}</Text>
        </View>
      </View>
    </Swipeable>
  );

  if (!isAdmin) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center px-6">
        <MaterialIcons name="lock" size={48} color="#9BA1A6" />
        <Text className="text-lg text-muted mt-4 text-center">
          Admin access required
        </Text>
      </ScreenContainer>
    );
  }

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
      <View className="items-center py-3 border-b border-border">
        <Text className="text-lg font-bold text-foreground">
          Requests pending approval
        </Text>
      </View>

      {/* Calendar - Top Half */}
      <View className="mx-3 mt-2 border border-border rounded-xl p-2 bg-surface">
        <View className="flex-row items-center justify-between mb-1">
          <View className="flex-row items-center">
            <TouchableOpacity onPress={prevMonth} className="p-1">
              <MaterialIcons name="chevron-left" size={22} color="#11181C" />
            </TouchableOpacity>
            <TouchableOpacity onPress={nextMonth} className="p-1">
              <MaterialIcons name="chevron-right" size={22} color="#11181C" />
            </TouchableOpacity>
            <Text className="text-sm font-bold text-foreground ml-2">
              {String(currentMonth + 1).padStart(2, "0")}/{currentYear}
            </Text>
          </View>
          {/* Legend */}
          <View className="flex-row items-center gap-2">
            <View className="flex-row items-center">
              <View style={{ backgroundColor: "#EF4444", width: 8, height: 8, borderRadius: 4 }} />
              <Text className="text-xs text-muted ml-0.5">A</Text>
            </View>
            <View className="flex-row items-center">
              <View style={{ backgroundColor: "#3B82F6", width: 8, height: 8, borderRadius: 4 }} />
              <Text className="text-xs text-muted ml-0.5">P</Text>
            </View>
            <View className="flex-row items-center">
              <View style={{ backgroundColor: "#22C55E", width: 8, height: 8, borderRadius: 4 }} />
              <Text className="text-xs text-muted ml-0.5">9-17</Text>
            </View>
            <View className="flex-row items-center">
              <View style={{ backgroundColor: "#86EFAC", width: 8, height: 8, borderRadius: 4 }} />
              <Text className="text-xs text-muted ml-0.5">9-13</Text>
            </View>
          </View>
        </View>
        {renderCalendar()}
      </View>

      {/* Pending Requests List - Bottom Half */}
      <View className="flex-1 mx-3 mt-2 mb-2 border border-border rounded-xl overflow-hidden">
        <View className="bg-surface px-4 py-2 border-b border-border">
          <Text className="text-sm font-bold text-foreground">
            Pending Requests ({pendingRequests.length})
          </Text>
          <Text className="text-xs text-muted">
            ← Swipe left to approve | Swipe right to reject →
          </Text>
        </View>
        {pendingRequests.length === 0 ? (
          <View className="flex-1 items-center justify-center py-8">
            <Text className="text-muted text-sm">No pending requests</Text>
          </View>
        ) : (
          <FlatList
            data={pendingRequests}
            renderItem={renderPendingItem}
            keyExtractor={(item) => item.id || Math.random().toString()}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          />
        )}
      </View>

      {/* Approved Duties Modal (on date tap) */}
      <Modal
        visible={showDutyModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDutyModal(false)}
      >
        <View className="flex-1 justify-center px-6" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View className="bg-background rounded-2xl p-4 max-h-[60%]">
            <Text className="text-lg font-bold text-foreground text-center mb-3">
              Approved Duties - {selectedDateStr}
            </Text>
            <FlatList
              data={selectedDateDuties}
              keyExtractor={(item) => item.id || Math.random().toString()}
              renderItem={({ item }) => (
                <View className="flex-row items-center py-3 px-3 border-b border-border">
                  <View
                    className="w-8 h-8 rounded-full mr-3"
                    style={{ backgroundColor: "#D1D5DB" }}
                  />
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-foreground">
                      {item.userName}
                    </Text>
                  </View>
                  <View
                    style={{ backgroundColor: getDutyColor(item.dutyType) }}
                    className="px-2 py-1 rounded"
                  >
                    <Text className="text-white text-xs font-bold">{item.dutyType}</Text>
                  </View>
                </View>
              )}
            />
            <TouchableOpacity
              onPress={() => setShowDutyModal(false)}
              className="mt-4 rounded-xl py-3 items-center border border-border"
            >
              <Text className="text-foreground text-base font-semibold">Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
