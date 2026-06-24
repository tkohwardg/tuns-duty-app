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
} from "@/lib/duty-colors";
import { Swipeable } from "react-native-gesture-handler";
import { useNavigation } from "@react-navigation/native";
import { useColors } from "@/hooks/use-colors";
import { useSettings } from "@/lib/settings-context";

function parseDateStr(dateStr: string): Date {
  const parts = dateStr.split("/");
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);
  return new Date(year, month, day);
}

export default function ApprovedDutyScreen() {
  const { isAdmin, userProfile } = useAuthContext();
  const colors = useColors();
  const { settings } = useSettings();
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

  // Filter: only show duties from today onwards in the list, sorted ascending
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

  // Calculate this week's total hours (Sun-Sat)
  const weeklyHours = (() => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - dayOfWeek);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const weekDuties = approvedRequests.filter((r) => {
      if (!isAdmin && userProfile?.uid && r.userId !== userProfile.uid) return false;
      const d = parseDateStr(r.date);
      return d >= weekStart && d <= weekEnd;
    });

    let totalHours = 0;
    for (const duty of weekDuties) {
      const option = settings.dutyOptions.find((o) => o.label === duty.dutyType);
      if (option) {
        totalHours += option.hours;
      } else {
        if (duty.dutyType === "A" || duty.dutyType === "P" || duty.dutyType === "0900-1700") {
          totalHours += 7;
        } else if (duty.dutyType === "0900-1300") {
          totalHours += 4;
        }
      }
    }
    return totalHours;
  })();

  const isOverLimit = weeklyHours >= 14;

  // Only reject action for admin (swipe right reveals reject button)
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

  // Swipe RIGHT reveals this action panel on the LEFT side (renderLeftActions)
  // This matches My Requests page pattern where swipe right reveals Cancel
  const renderLeftActions = (request: DutyRequest) => (
    <TouchableOpacity
      onPress={() => handleReject(request)}
      style={{ backgroundColor: "#EF4444", justifyContent: "center", alignItems: "center", paddingHorizontal: 24 }}
    >
      <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>✗</Text>
      <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600", marginTop: 2 }}>Reject</Text>
    </TouchableOpacity>
  );

  // Calendar navigation
  const prevMonth = useCallback(() => {
    setCurrentMonth((m) => {
      if (m === 0) { setCurrentYear((y) => y - 1); return 11; }
      return m - 1;
    });
  }, []);

  const nextMonth = useCallback(() => {
    setCurrentMonth((m) => {
      if (m === 11) { setCurrentYear((y) => y + 1); return 0; }
      return m + 1;
    });
  }, []);

  // Get approved duties for any date
  const getApprovedForAnyDate = (day: number, month: number, year: number): DutyRequest[] => {
    const dateStr = formatDateStr(day, month, year);
    return approvedRequests.filter((r) => r.date === dateStr);
  };

  const getApprovedForDate = (day: number): DutyRequest[] =>
    getApprovedForAnyDate(day, currentMonth, currentYear);

  const handleDateTap = (day: number) => {
    const duties = getApprovedForDate(day);
    if (duties.length > 0) {
      setSelectedDateDuties(duties);
      setSelectedDateStr(formatDateStr(day, currentMonth, currentYear));
      setShowDutyModal(true);
    }
  };

  const handleOverflowDateTap = (day: number, month: number, year: number) => {
    const duties = getApprovedForAnyDate(day, month, year);
    if (duties.length > 0) {
      setSelectedDateDuties(duties);
      setSelectedDateStr(formatDateStr(day, month, year));
      setShowDutyModal(true);
    }
  };

  // Calendar render - fills 2/3 of the available space
  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
    const todayDate = new Date();
    const isCurrentMonth =
      todayDate.getMonth() === currentMonth && todayDate.getFullYear() === currentYear;

    const prevMonthNum = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYearNum = currentMonth === 0 ? currentYear - 1 : currentYear;
    const daysInPrevMonth = getDaysInMonth(prevYearNum, prevMonthNum);
    const nextMonthNum = currentMonth === 11 ? 0 : currentMonth + 1;
    const nextYearNum = currentMonth === 11 ? currentYear + 1 : currentYear;

    const weekDays = ["日", "一", "二", "三", "四", "五", "六"];
    const rows: React.ReactNode[] = [];

    // Header row
    rows.push(
      <View key="header" className="flex-row" style={{ marginBottom: 4 }}>
        {weekDays.map((day, i) => (
          <View key={`h-${i}`} className="flex-1 items-center" style={{ paddingVertical: 4 }}>
            <Text className="text-xs text-muted font-medium">{day}</Text>
          </View>
        ))}
      </View>
    );

    interface CellData {
      day: number;
      month: number;
      year: number;
      isOverflow: boolean;
    }

    const allCells: CellData[] = [];

    // Leading overflow
    for (let i = 0; i < firstDay; i++) {
      const overflowDay = daysInPrevMonth - firstDay + 1 + i;
      allCells.push({ day: overflowDay, month: prevMonthNum, year: prevYearNum, isOverflow: true });
    }

    // Current month
    for (let day = 1; day <= daysInMonth; day++) {
      allCells.push({ day, month: currentMonth, year: currentYear, isOverflow: false });
    }

    // Trailing overflow to complete last row
    const remainder = allCells.length % 7;
    if (remainder > 0) {
      const trailingCount = 7 - remainder;
      for (let i = 1; i <= trailingCount; i++) {
        allCells.push({ day: i, month: nextMonthNum, year: nextYearNum, isOverflow: true });
      }
    }

    // Build rows of 7 — each row uses flex:1 to distribute evenly
    for (let i = 0; i < allCells.length; i += 7) {
      const week = allCells.slice(i, i + 7);
      rows.push(
        <View key={`row-${i}`} className="flex-row" style={{ flex: 1 }}>
          {week.map((cell, idx) => {
            const isToday =
              isCurrentMonth && !cell.isOverflow && todayDate.getDate() === cell.day;
            const approvedForDay = getApprovedForAnyDate(cell.day, cell.month, cell.year);
            const hasApproved = approvedForDay.length > 0;

            return (
              <TouchableOpacity
                key={`${i}-${idx}`}
                className="flex-1 items-center justify-center"
                onPress={() => {
                  if (cell.isOverflow) {
                    handleOverflowDateTap(cell.day, cell.month, cell.year);
                  } else {
                    handleDateTap(cell.day);
                  }
                }}
              >
                <View
                  className={`w-8 h-8 rounded-full items-center justify-center ${isToday ? "bg-primary" : ""}`}
                >
                  <Text
                    className={`text-sm ${isToday ? "text-white font-bold" : cell.isOverflow ? "" : "text-foreground"}`}
                    style={cell.isOverflow ? { color: "#9CA3AF" } : undefined}
                  >
                    {cell.day}
                  </Text>
                </View>
                {hasApproved && (
                  <View className="flex-row" style={{ marginTop: 2, gap: 2 }}>
                    {approvedForDay.slice(0, 4).map((r, dotIdx) => (
                      <View
                        key={dotIdx}
                        style={{
                          backgroundColor: getDutyColor(r.dutyType),
                          width: 6,
                          height: 6,
                          borderRadius: 3,
                          opacity: cell.isOverflow ? 0.5 : 1,
                        }}
                      />
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      );
    }

    return rows;
  };

  const renderApprovedItem = ({ item }: { item: DutyRequest }) => {
    const content = (
      <View className="flex-row items-center py-3 px-4 bg-background border-b border-border">
        <View className="w-9 h-9 rounded-full mr-3" style={{ backgroundColor: "#D1D5DB" }} />
        <View className="flex-1">
          <Text className="text-sm font-bold text-foreground" numberOfLines={1}>
            {item.userName}
          </Text>
          <Text className="text-xs text-muted">{item.date}</Text>
        </View>
        <View style={{ backgroundColor: getDutyColor(item.dutyType) }} className="px-2 py-1 rounded">
          <Text className="text-white text-xs font-bold">{item.dutyType}</Text>
        </View>
      </View>
    );

    if (isAdmin) {
      // Only swipe RIGHT to reveal reject (renderLeftActions only, no renderRightActions)
      return (
        <Swipeable
          renderLeftActions={() => renderLeftActions(item)}
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
      {/* Header with weekly hours */}
      <View className="items-center py-2 border-b border-border">
        <Text className="text-lg font-bold text-foreground">Approved duty</Text>
        {isAdmin && (
          <Text className="text-xs text-muted mt-1">
            Swipe right → to reject duty
          </Text>
        )}
        <View className="flex-row items-center mt-1">
          <Text className="text-xs text-muted">This week (Sun-Sat): </Text>
          <Text
            className={`text-xs ${isOverLimit ? "font-bold" : ""}`}
            style={{ color: isOverLimit ? "#EF4444" : colors.muted }}
          >
            {weeklyHours}h
          </Text>
          {isOverLimit && (
            <Text className="text-xs font-bold" style={{ color: "#EF4444" }}> (≥14h)</Text>
          )}
        </View>
      </View>

      {/* Calendar — takes 2/3 of available space */}
      <View
        className="mx-3 mt-2 border border-border rounded-xl p-3 bg-surface"
        style={{ flex: 2 }}
      >
        {/* Month navigation header */}
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={prevMonth}
              style={{ padding: 10, borderRadius: 20, backgroundColor: colors.background }}
            >
              <Text style={{ fontSize: 20, color: colors.foreground, fontWeight: "700" }}>◀</Text>
            </TouchableOpacity>
            <Text className="text-base font-bold text-foreground mx-3">
              {String(currentMonth + 1).padStart(2, "0")}/{currentYear}
            </Text>
            <TouchableOpacity
              onPress={nextMonth}
              style={{ padding: 10, borderRadius: 20, backgroundColor: colors.background }}
            >
              <Text style={{ fontSize: 20, color: colors.foreground, fontWeight: "700" }}>▶</Text>
            </TouchableOpacity>
          </View>
          <View className="flex-row items-center" style={{ gap: 6 }}>
            {[
              { color: "#EF4444", label: "A" },
              { color: "#3B82F6", label: "P" },
              { color: "#22C55E", label: "9-17" },
              { color: "#86EFAC", label: "9-13" },
            ].map(({ color, label }) => (
              <View key={label} className="flex-row items-center">
                <View style={{ backgroundColor: color, width: 8, height: 8, borderRadius: 4 }} />
                <Text className="text-xs text-muted ml-1">{label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Calendar grid */}
        <View style={{ flex: 1 }}>
          {renderCalendar()}
        </View>
      </View>

      {/* Approved List — takes 1/3 of available space */}
      <View className="mx-3 mt-2 mb-2 border border-border rounded-xl overflow-hidden" style={{ flex: 1 }}>
        {futureApproved.length === 0 ? (
          <FlatList
            data={[]}
            renderItem={() => null}
            ListEmptyComponent={
              <View className="items-center justify-center py-6">
                <Text className="text-muted text-sm">No upcoming approved duties</Text>
              </View>
            }
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          />
        ) : (
          <FlatList
            data={futureApproved}
            renderItem={renderApprovedItem}
            keyExtractor={(item) => item.id || Math.random().toString()}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
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
              Approved Duties — {selectedDateStr}
            </Text>
            <FlatList
              data={selectedDateDuties}
              renderItem={({ item }) => (
                <View className="flex-row items-center py-2 border-b border-border">
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-foreground">{item.userName}</Text>
                  </View>
                  <View style={{ backgroundColor: getDutyColor(item.dutyType) }} className="px-2 py-1 rounded">
                    <Text className="text-white text-xs font-bold">{item.dutyType}</Text>
                  </View>
                </View>
              )}
              keyExtractor={(item) => item.id || Math.random().toString()}
            />
            <TouchableOpacity
              onPress={() => setShowDutyModal(false)}
              className="mt-3 py-2.5 rounded-xl items-center bg-primary"
            >
              <Text className="text-white font-semibold">Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
