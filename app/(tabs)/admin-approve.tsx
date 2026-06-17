import React, { useState, useEffect, useCallback } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  Modal,
  RefreshControl,
  Dimensions,
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
import { useSettings, type DutyOption } from "@/lib/settings-context";
import {
  getDutyColor,
  getDaysInMonth,
  getFirstDayOfMonth,
  formatDateStr,
  getDutyHours,
  getWeekForDate,
  parseDateString,
} from "@/lib/duty-colors";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Swipeable } from "react-native-gesture-handler";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const CALENDAR_HEIGHT = SCREEN_HEIGHT / 3;

function parseDateStr(dateStr: string): Date {
  const parts = dateStr.split("/");
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);
  return new Date(year, month, day);
}

export default function AdminApproveScreen() {
  const { isAdmin } = useAuthContext();
  const { settings } = useSettings();
  const [pendingRequests, setPendingRequests] = useState<DutyRequest[]>([]);
  const [approvedRequests, setApprovedRequests] = useState<DutyRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [selectedDateDuties, setSelectedDateDuties] = useState<DutyRequest[]>([]);
  const [showDutyModal, setShowDutyModal] = useState(false);
  const [selectedDateStr, setSelectedDateStr] = useState("");
  const [selectedStaff, setSelectedStaff] = useState<{ name: string; userId: string; dutyDate: string } | null>(null);

  // Batch mode state
  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchProcessing, setBatchProcessing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [pending, approved] = await Promise.all([
        getAllPendingRequests(),
        getAllApprovedRequests(),
      ]);
      const sortedPending = pending.sort((a, b) => {
        const dateA = parseDateStr(a.date);
        const dateB = parseDateStr(b.date);
        const dateDiff = dateA.getTime() - dateB.getTime();
        if (dateDiff !== 0) return dateDiff;
        const createdA = a.createdAt?.toMillis?.() || 0;
        const createdB = b.createdAt?.toMillis?.() || 0;
        return createdA - createdB;
      });
      setPendingRequests(sortedPending);
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

  // Calculate total working hours for selected staff
  const getWeeklyHours = (): number => {
    if (!selectedStaff) return 0;
    const week = getWeekForDate(selectedStaff.dutyDate);
    if (!week) return 0;
    return approvedRequests
      .filter((r) => {
        if (r.userId !== selectedStaff.userId) return false;
        const d = parseDateString(r.date);
        if (!d) return false;
        return d >= week.sunday && d <= week.saturday;
      })
      .reduce((total, r) => {
        const opt = settings.dutyOptions.find((o: DutyOption) => o.label === r.dutyType);
        return total + (opt ? opt.hours : getDutyHours(r.dutyType));
      }, 0);
  };

  // Single approve/reject
  const handleApprove = (request: DutyRequest) => {
    if (!request.id) return;
    Alert.alert(
      "Confirm Approve",
      `Approve ${request.userName}'s "${request.dutyType}" request on ${request.date}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Approve",
          onPress: async () => {
            try {
              await updateDutyRequestStatus(request.id!, "approved");
              await updateSheetStatus(request.id!, "approved");
              setPendingRequests((prev) => prev.filter((r) => r.id !== request.id));
              setApprovedRequests((prev) => [{ ...request, status: "approved" }, ...prev]);
            } catch (error) {
              Alert.alert("Error", "Failed to approve request.");
            }
          },
        },
      ]
    );
  };

  const handleReject = (request: DutyRequest) => {
    if (!request.id) return;
    Alert.alert(
      "Confirm Reject",
      `Reject ${request.userName}'s "${request.dutyType}" request on ${request.date}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: async () => {
            try {
              await updateDutyRequestStatus(request.id!, "rejected");
              await updateSheetStatus(request.id!, "rejected");
              setPendingRequests((prev) => prev.filter((r) => r.id !== request.id));
            } catch (error) {
              Alert.alert("Error", "Failed to reject request.");
            }
          },
        },
      ]
    );
  };

  // Batch operations
  const toggleBatchMode = () => {
    setBatchMode(!batchMode);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const selectAll = () => {
    if (selectedIds.size === pendingRequests.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingRequests.map((r) => r.id!).filter(Boolean)));
    }
  };

  const handleBatchApprove = () => {
    if (selectedIds.size === 0) return;
    Alert.alert(
      "Batch Approve",
      `Approve ${selectedIds.size} selected request(s)?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Approve All",
          onPress: async () => {
            setBatchProcessing(true);
            try {
              const promises = Array.from(selectedIds).map(async (id) => {
                await updateDutyRequestStatus(id, "approved");
                await updateSheetStatus(id, "approved");
              });
              await Promise.all(promises);
              const approvedItems = pendingRequests.filter((r) => selectedIds.has(r.id!));
              setPendingRequests((prev) => prev.filter((r) => !selectedIds.has(r.id!)));
              setApprovedRequests((prev) => [
                ...approvedItems.map((r) => ({ ...r, status: "approved" as const })),
                ...prev,
              ]);
              setSelectedIds(new Set());
              Alert.alert("Success", `${approvedItems.length} request(s) approved.`);
            } catch (error) {
              Alert.alert("Error", "Some requests failed to approve.");
              await loadData();
            } finally {
              setBatchProcessing(false);
            }
          },
        },
      ]
    );
  };

  const handleBatchReject = () => {
    if (selectedIds.size === 0) return;
    Alert.alert(
      "Batch Reject",
      `Reject ${selectedIds.size} selected request(s)?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject All",
          style: "destructive",
          onPress: async () => {
            setBatchProcessing(true);
            try {
              const promises = Array.from(selectedIds).map(async (id) => {
                await updateDutyRequestStatus(id, "rejected");
                await updateSheetStatus(id, "rejected");
              });
              await Promise.all(promises);
              setPendingRequests((prev) => prev.filter((r) => !selectedIds.has(r.id!)));
              const count = selectedIds.size;
              setSelectedIds(new Set());
              Alert.alert("Success", `${count} request(s) rejected.`);
            } catch (error) {
              Alert.alert("Error", "Some requests failed to reject.");
              await loadData();
            } finally {
              setBatchProcessing(false);
            }
          },
        },
      ]
    );
  };

  // Calendar navigation - using functional setState to avoid stale closure
  const prevMonth = useCallback(() => {
    setCurrentMonth((m) => {
      if (m === 0) {
        setCurrentYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }, []);

  const nextMonth = useCallback(() => {
    setCurrentMonth((m) => {
      if (m === 11) {
        setCurrentYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }, []);

  // Get approved duties for any date (supports overflow months)
  const getApprovedForAnyDate = (day: number, month: number, year: number): DutyRequest[] => {
    const dateStr = formatDateStr(day, month, year);
    return approvedRequests.filter((r) => r.date === dateStr);
  };

  const getApprovedForDate = (day: number): DutyRequest[] => {
    return getApprovedForAnyDate(day, currentMonth, currentYear);
  };

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

  const handleStaffTap = (request: DutyRequest) => {
    setSelectedStaff({ name: request.userName, userId: request.userId, dutyDate: request.date });
  };

  // Swipe actions
  const renderRightActions = (request: DutyRequest) => (
    <TouchableOpacity
      onPress={() => handleApprove(request)}
      style={{ backgroundColor: "#22C55E" }}
      className="justify-center items-center px-5"
    >
      <MaterialIcons name="check" size={24} color="#fff" />
      <Text className="text-white text-xs font-semibold mt-1">Approve</Text>
    </TouchableOpacity>
  );

  const renderLeftActions = (request: DutyRequest) => (
    <TouchableOpacity
      onPress={() => handleReject(request)}
      style={{ backgroundColor: "#EF4444" }}
      className="justify-center items-center px-5"
    >
      <MaterialIcons name="close" size={24} color="#fff" />
      <Text className="text-white text-xs font-semibold mt-1">Reject</Text>
    </TouchableOpacity>
  );

  // Calendar render with overflow days
  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
    const today = new Date();
    const isCurrentMonth =
      today.getMonth() === currentMonth && today.getFullYear() === currentYear;

    // Previous month info for leading overflow
    const prevMonthNum = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYearNum = currentMonth === 0 ? currentYear - 1 : currentYear;
    const daysInPrevMonth = getDaysInMonth(prevYearNum, prevMonthNum);

    // Next month info for trailing overflow
    const nextMonthNum = currentMonth === 11 ? 0 : currentMonth + 1;
    const nextYearNum = currentMonth === 11 ? currentYear + 1 : currentYear;

    const weekDays = ["日", "一", "二", "三", "四", "五", "六"];
    const cells: React.ReactNode[] = [];

    // Header row
    weekDays.forEach((day, i) =>
      cells.push(
        <View key={`header-${i}`} className="flex-1 items-center py-0.5">
          <Text className="text-xs text-muted font-medium">{day}</Text>
        </View>
      )
    );

    // Leading overflow days (previous month)
    for (let i = 0; i < firstDay; i++) {
      const overflowDay = daysInPrevMonth - firstDay + 1 + i;
      const approvedForDay = getApprovedForAnyDate(overflowDay, prevMonthNum, prevYearNum);
      const hasApproved = approvedForDay.length > 0;

      cells.push(
        <TouchableOpacity
          key={`prev-${i}`}
          className="flex-1 items-center py-0.5"
          onPress={() => handleOverflowDateTap(overflowDay, prevMonthNum, prevYearNum)}
        >
          <View className="w-6 h-6 rounded-full items-center justify-center">
            <Text className="text-xs" style={{ color: "#9CA3AF" }}>{overflowDay}</Text>
          </View>
          {hasApproved && (
            <View className="flex-row mt-0.5 gap-0.5">
              {approvedForDay.slice(0, 3).map((r, idx) => (
                <View
                  key={idx}
                  style={{ backgroundColor: getDutyColor(r.dutyType), width: 5, height: 5, borderRadius: 2.5, opacity: 0.6 }}
                />
              ))}
            </View>
          )}
        </TouchableOpacity>
      );
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const isToday = isCurrentMonth && today.getDate() === day;
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

    // Trailing overflow days (next month) - fill remaining cells to complete the last row
    const totalCellsSoFar = cells.length - 7; // subtract header row
    const remainder = totalCellsSoFar % 7;
    if (remainder > 0) {
      const trailingCount = 7 - remainder;
      for (let i = 1; i <= trailingCount; i++) {
        const approvedForDay = getApprovedForAnyDate(i, nextMonthNum, nextYearNum);
        const hasApproved = approvedForDay.length > 0;

        cells.push(
          <TouchableOpacity
            key={`next-${i}`}
            className="flex-1 items-center py-0.5"
            onPress={() => handleOverflowDateTap(i, nextMonthNum, nextYearNum)}
          >
            <View className="w-6 h-6 rounded-full items-center justify-center">
              <Text className="text-xs" style={{ color: "#9CA3AF" }}>{i}</Text>
            </View>
            {hasApproved && (
              <View className="flex-row mt-0.5 gap-0.5">
                {approvedForDay.slice(0, 3).map((r, idx) => (
                  <View
                    key={idx}
                    style={{ backgroundColor: getDutyColor(r.dutyType), width: 5, height: 5, borderRadius: 2.5, opacity: 0.6 }}
                  />
                ))}
              </View>
            )}
          </TouchableOpacity>
        );
      }
    }

    // Build rows
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

  // Pending list item
  const renderPendingItem = ({ item }: { item: DutyRequest }) => {
    if (batchMode) {
      const isSelected = selectedIds.has(item.id!);
      return (
        <TouchableOpacity
          onPress={() => toggleSelect(item.id!)}
          activeOpacity={0.7}
          className="flex-row items-center py-3 px-4 bg-background border-b border-border"
        >
          <View
            className="w-6 h-6 rounded mr-3 items-center justify-center border"
            style={{
              backgroundColor: isSelected ? "#22C55E" : "transparent",
              borderColor: isSelected ? "#22C55E" : "#9CA3AF",
            }}
          >
            {isSelected && <MaterialIcons name="check" size={16} color="#fff" />}
          </View>
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
        </TouchableOpacity>
      );
    }

    return (
      <Swipeable
        renderRightActions={() => renderRightActions(item)}
        renderLeftActions={() => renderLeftActions(item)}
        overshootRight={false}
        overshootLeft={false}
      >
        <TouchableOpacity
          onPress={() => handleStaffTap(item)}
          activeOpacity={0.7}
          className="flex-row items-center py-3 px-4 bg-background border-b border-border"
        >
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
        </TouchableOpacity>
      </Swipeable>
    );
  };

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

  const weeklyHours = getWeeklyHours();

  return (
    <ScreenContainer className="flex-1">
      {/* Header */}
      <View className="items-center py-2 border-b border-border">
        <Text className="text-lg font-bold text-foreground">
          Requests pending approval
        </Text>
      </View>

      {/* Selected Staff Info */}
      {!batchMode && (
        <View className="flex-row mx-4 mt-2 mb-1">
          <View className="flex-1">
            <Text className="text-xs text-muted">Selected Staff Name:</Text>
            <Text className="text-xs text-muted">Total working hours this</Text>
            <Text className="text-xs text-muted">  week (Sun-Sat):</Text>
          </View>
          <View className="items-end">
            <Text className="text-sm font-bold text-foreground">
              {selectedStaff ? selectedStaff.name : "—"}
            </Text>
            <Text className="text-sm font-bold text-foreground">
              {selectedStaff ? `${weeklyHours} hrs` : "—"}
            </Text>
          </View>
        </View>
      )}

      {/* Calendar - uses available space, larger */}
      <View
        className="mx-3 border border-border rounded-xl p-3 bg-surface"
        style={{ height: CALENDAR_HEIGHT }}
      >
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-row items-center">
            <TouchableOpacity onPress={prevMonth} className="p-2 rounded-full" style={{ backgroundColor: '#f5f5f5' }}>
              <MaterialIcons name="chevron-left" size={24} color="#11181C" />
            </TouchableOpacity>
            <Text className="text-base font-bold text-foreground mx-3">
              {String(currentMonth + 1).padStart(2, "0")}/{currentYear}
            </Text>
            <TouchableOpacity onPress={nextMonth} className="p-2 rounded-full" style={{ backgroundColor: '#f5f5f5' }}>
              <MaterialIcons name="chevron-right" size={24} color="#11181C" />
            </TouchableOpacity>
          </View>
          <View className="flex-row items-center gap-2">
            <View className="flex-row items-center">
              <View style={{ backgroundColor: "#EF4444", width: 8, height: 8, borderRadius: 4 }} />
              <Text className="text-xs text-muted ml-1">A</Text>
            </View>
            <View className="flex-row items-center">
              <View style={{ backgroundColor: "#3B82F6", width: 8, height: 8, borderRadius: 4 }} />
              <Text className="text-xs text-muted ml-1">P</Text>
            </View>
            <View className="flex-row items-center">
              <View style={{ backgroundColor: "#22C55E", width: 8, height: 8, borderRadius: 4 }} />
              <Text className="text-xs text-muted ml-1">9-17</Text>
            </View>
            <View className="flex-row items-center">
              <View style={{ backgroundColor: "#86EFAC", width: 8, height: 8, borderRadius: 4 }} />
              <Text className="text-xs text-muted ml-1">9-13</Text>
            </View>
          </View>
        </View>
        {renderCalendar()}
      </View>

      {/* Pending Requests List - Bottom */}
      <View className="flex-1 mx-3 mt-2 mb-2 border border-border rounded-xl overflow-hidden">
        <View className="bg-surface px-4 py-2 border-b border-border flex-row items-center justify-between">
          <View>
            <Text className="text-sm font-bold text-foreground">
              Pending Requests ({pendingRequests.length})
            </Text>
            {!batchMode && (
              <Text className="text-xs text-muted">
                ← Swipe left to approve | Swipe right to reject →
              </Text>
            )}
          </View>
          {pendingRequests.length > 0 && (
            <TouchableOpacity
              onPress={toggleBatchMode}
              className="px-3 py-1.5 rounded-lg"
              style={{ backgroundColor: batchMode ? "#EF4444" : "#3B82F6" }}
            >
              <Text className="text-white text-xs font-bold">
                {batchMode ? "Cancel" : "Batch"}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Batch action bar */}
        {batchMode && (
          <View className="flex-row items-center px-4 py-2 bg-surface border-b border-border gap-2">
            <TouchableOpacity
              onPress={selectAll}
              className="px-3 py-1.5 rounded-lg border border-border"
            >
              <Text className="text-xs font-semibold text-foreground">
                {selectedIds.size === pendingRequests.length ? "Deselect All" : "Select All"}
              </Text>
            </TouchableOpacity>
            <View className="flex-1" />
            <TouchableOpacity
              onPress={handleBatchApprove}
              disabled={selectedIds.size === 0 || batchProcessing}
              className="px-3 py-1.5 rounded-lg"
              style={{ backgroundColor: selectedIds.size > 0 ? "#22C55E" : "#D1D5DB" }}
            >
              {batchProcessing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text className="text-white text-xs font-bold">
                  Approve ({selectedIds.size})
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleBatchReject}
              disabled={selectedIds.size === 0 || batchProcessing}
              className="px-3 py-1.5 rounded-lg"
              style={{ backgroundColor: selectedIds.size > 0 ? "#EF4444" : "#D1D5DB" }}
            >
              {batchProcessing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text className="text-white text-xs font-bold">
                  Reject ({selectedIds.size})
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {pendingRequests.length === 0 ? (
          <FlatList
            data={[]}
            renderItem={() => null}
            ListEmptyComponent={
              <View className="items-center justify-center py-8">
                <Text className="text-muted text-sm">No pending requests</Text>
              </View>
            }
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          />
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
