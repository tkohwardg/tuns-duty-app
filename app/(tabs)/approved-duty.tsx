import React, { useState, useEffect, useCallback } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Modal,
  Alert,
  RefreshControl,
  Dimensions,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useAuthContext } from "@/lib/auth-context";
import {
  getAllApprovedRequests,
  updateDutyRequestStatus,
  type DutyRequest,
} from "@/lib/firebase";
import { updateSheetStatus } from "@/lib/google-sheets";
import {
  getDutyColor,
  getDaysInMonth,
  getFirstDayOfMonth,
  formatDateStr,
  parseDateString,
} from "@/lib/duty-colors";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Swipeable } from "react-native-gesture-handler";
import { useNavigation } from "@react-navigation/native";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const CALENDAR_HEIGHT = SCREEN_HEIGHT / 3;

function parseDateStr(dateStr: string): Date {
  const parts = dateStr.split("/");
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);
  return new Date(year, month, day);
}

export default function ApprovedDutyScreen() {
  const { isAdmin } = useAuthContext();
  const navigation = useNavigation();
  const [approvedRequests, setApprovedRequests] = useState<DutyRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [selectedDateDuties, setSelectedDateDuties] = useState<DutyRequest[]>([]);
  const [showDutyModal, setShowDutyModal] = useState(false);
  const [selectedDateStr, setSelectedDateStr] = useState("");

  const loadApproved = useCallback(async () => {
    try {
      const approved = await getAllApprovedRequests();
      setApprovedRequests(approved);
    } catch (error) {
      console.error("Error loading approved requests:", error);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await loadApproved();
      setIsLoading(false);
    };
    init();
  }, [loadApproved]);

  // Reload on focus
  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      loadApproved();
    });
    return unsubscribe;
  }, [navigation, loadApproved]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadApproved();
    setRefreshing(false);
  };

  // Filter: only show duties from today onwards in the list, sorted ascending (sooner date at top)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const futureApproved = approvedRequests
    .filter((r) => {
      const d = parseDateStr(r.date);
      return d >= today;
    })
    .sort((a, b) => {
      const dateA = parseDateStr(a.date);
      const dateB = parseDateStr(b.date);
      const dateDiff = dateA.getTime() - dateB.getTime();
      if (dateDiff !== 0) return dateDiff;
      const createdA = a.createdAt?.toMillis?.() || 0;
      const createdB = b.createdAt?.toMillis?.() || 0;
      return createdA - createdB;
    });

  const handleReject = (request: DutyRequest) => {
    if (!request.id) return;
    Alert.alert(
      "Confirm Reject",
      `Reject ${request.userName}'s "${request.dutyType}" on ${request.date}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: async () => {
            try {
              await updateDutyRequestStatus(request.id!, "rejected");
              await updateSheetStatus(request.id!, "rejected");
              setApprovedRequests((prev) => prev.filter((r) => r.id !== request.id));
            } catch (error) {
              Alert.alert("Error", "Failed to reject request.");
            }
          },
        },
      ]
    );
  };

  const handleCancel = (request: DutyRequest) => {
    if (!request.id) return;
    Alert.alert(
      "Confirm Cancel",
      `Cancel ${request.userName}'s "${request.dutyType}" on ${request.date}?`,
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            try {
              await updateDutyRequestStatus(request.id!, "cancelled");
              await updateSheetStatus(request.id!, "cancelled");
              setApprovedRequests((prev) => prev.filter((r) => r.id !== request.id));
            } catch (error) {
              Alert.alert("Error", "Failed to cancel request.");
            }
          },
        },
      ]
    );
  };

  // Admin swipe: left to cancel, right to reject
  const renderRightActions = (request: DutyRequest) => {
    return (
      <TouchableOpacity
        onPress={() => handleCancel(request)}
        style={{ backgroundColor: "#F59E0B" }}
        className="justify-center items-center px-5"
      >
        <MaterialIcons name="cancel" size={22} color="#fff" />
        <Text className="text-white text-xs font-semibold mt-1">Cancel</Text>
      </TouchableOpacity>
    );
  };

  const renderLeftActions = (request: DutyRequest) => {
    return (
      <TouchableOpacity
        onPress={() => handleReject(request)}
        style={{ backgroundColor: "#EF4444" }}
        className="justify-center items-center px-5"
      >
        <MaterialIcons name="close" size={22} color="#fff" />
        <Text className="text-white text-xs font-semibold mt-1">Reject</Text>
      </TouchableOpacity>
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

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
    const todayDate = new Date();
    const isCurrentMonth =
      todayDate.getMonth() === currentMonth && todayDate.getFullYear() === currentYear;

    const weekDays = ["日", "一", "二", "三", "四", "五", "六"];
    const cells: React.ReactNode[] = [];

    weekDays.forEach((day, i) =>
      cells.push(
        <View key={`header-${i}`} className="flex-1 items-center py-0.5">
          <Text className="text-xs text-muted font-medium">{day}</Text>
        </View>
      )
    );

    for (let i = 0; i < firstDay; i++) {
      cells.push(<View key={`empty-${i}`} className="flex-1 items-center py-0.5" />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const isToday = isCurrentMonth && todayDate.getDate() === day;
      const approvedForDay = getApprovedForDate(day);
      const hasApproved = approvedForDay.length > 0;

      cells.push(
        <TouchableOpacity
          key={`day-${day}`}
          className="flex-1 items-center py-0.5"
          onPress={() => handleDateTap(day)}
        >
          <View
            className={`w-6 h-6 rounded-full items-center justify-center ${
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
                  style={{ backgroundColor: getDutyColor(r.dutyType), width: 5, height: 5, borderRadius: 2.5 }}
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

  const renderApprovedItem = ({ item }: { item: DutyRequest }) => {
    const content = (
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
    );

    if (isAdmin) {
      return (
        <Swipeable
          renderRightActions={() => renderRightActions(item)}
          renderLeftActions={() => renderLeftActions(item)}
          overshootRight={false}
          overshootLeft={false}
        >
          {content}
        </Swipeable>
      );
    }

    return content;
  };

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
      <View className="items-center py-2 border-b border-border">
        <Text className="text-lg font-bold text-foreground">Approved duty</Text>
        {isAdmin && (
          <Text className="text-xs text-muted mt-1">
            ← Swipe left to cancel | Swipe right to reject →
          </Text>
        )}
      </View>

      {/* Approved List - Top (future duties only, descending) */}
      <View className="mx-3 mt-2 border border-border rounded-xl overflow-hidden" style={{ maxHeight: "35%" }}>
        {futureApproved.length === 0 ? (
          <FlatList
            data={[]}
            renderItem={() => null}
            ListEmptyComponent={
              <View className="items-center justify-center py-8">
                <Text className="text-muted text-sm">No upcoming approved duties</Text>
              </View>
            }
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          />
        ) : (
          <FlatList
            data={futureApproved}
            renderItem={renderApprovedItem}
            keyExtractor={(item) => item.id || Math.random().toString()}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          />
        )}
      </View>

      {/* Calendar - 1/3 of screen */}
      <View
        className="mx-3 mt-2 mb-2 border border-border rounded-xl p-2 bg-surface"
        style={{ height: CALENDAR_HEIGHT }}
      >
        <View className="flex-row items-center justify-between mb-1">
          <View className="flex-row items-center">
            <TouchableOpacity onPress={prevMonth} className="p-1">
              <MaterialIcons name="chevron-left" size={20} color="#11181C" />
            </TouchableOpacity>
            <TouchableOpacity onPress={nextMonth} className="p-1">
              <MaterialIcons name="chevron-right" size={20} color="#11181C" />
            </TouchableOpacity>
            <Text className="text-sm font-bold text-foreground ml-2">
              {String(currentMonth + 1).padStart(2, "0")}/{currentYear}
            </Text>
          </View>
          <View className="flex-row items-center gap-1">
            <View className="flex-row items-center">
              <View style={{ backgroundColor: "#EF4444", width: 6, height: 6, borderRadius: 3 }} />
              <Text className="text-[10px] text-muted ml-0.5">A</Text>
            </View>
            <View className="flex-row items-center">
              <View style={{ backgroundColor: "#3B82F6", width: 6, height: 6, borderRadius: 3 }} />
              <Text className="text-[10px] text-muted ml-0.5">P</Text>
            </View>
            <View className="flex-row items-center">
              <View style={{ backgroundColor: "#22C55E", width: 6, height: 6, borderRadius: 3 }} />
              <Text className="text-[10px] text-muted ml-0.5">9-17</Text>
            </View>
            <View className="flex-row items-center">
              <View style={{ backgroundColor: "#86EFAC", width: 6, height: 6, borderRadius: 3 }} />
              <Text className="text-[10px] text-muted ml-0.5">9-13</Text>
            </View>
          </View>
        </View>
        {renderCalendar()}
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
