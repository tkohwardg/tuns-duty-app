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
  Animated,
  Platform,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  const insets = useSafeAreaInsets();
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
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);
  const [batchAction, setBatchAction] = useState<"approve" | "reject" | null>(null);

  // Single item processing state
  const [processingId, setProcessingId] = useState<string | null>(null);

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

  // Single approve — direct action, no Alert confirmation (faster UX)
  const handleApprove = async (request: DutyRequest) => {
    if (!request.id || processingId) return;
    setProcessingId(request.id);
    try {
      await updateDutyRequestStatus(request.id, "approved");
      await updateSheetStatus(request.id, "approved");
      setPendingRequests((prev) => prev.filter((r) => r.id !== request.id));
      setApprovedRequests((prev) => [{ ...request, status: "approved" }, ...prev]);
    } catch (error) {
      Alert.alert("Error", "Failed to approve request.");
    } finally {
      setProcessingId(null);
    }
  };

  // Single reject — direct action
  const handleReject = async (request: DutyRequest) => {
    if (!request.id || processingId) return;
    setProcessingId(request.id);
    try {
      await updateDutyRequestStatus(request.id, "rejected");
      await updateSheetStatus(request.id, "rejected");
      setPendingRequests((prev) => prev.filter((r) => r.id !== request.id));
    } catch (error) {
      Alert.alert("Error", "Failed to reject request.");
    } finally {
      setProcessingId(null);
    }
  };

  // Batch mode
  const enterBatchMode = () => {
    setBatchMode(true);
    setSelectedIds(new Set());
    setBatchProgress(null);
    setBatchAction(null);
  };

  const exitBatchMode = () => {
    setBatchMode(false);
    setSelectedIds(new Set());
    setBatchProgress(null);
    setBatchAction(null);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isAllSelected = selectedIds.size === pendingRequests.length && pendingRequests.length > 0;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingRequests.map((r) => r.id!).filter(Boolean)));
    }
  };

  // Batch process — direct action without Alert confirmation for speed
  const runBatch = async (action: "approve" | "reject") => {
    if (selectedIds.size === 0 || batchProcessing) return;
    const ids = Array.from(selectedIds);
    const actionLabelPast = action === "approve" ? "approved" : "rejected";

    setBatchProcessing(true);
    setBatchAction(action);
    setBatchProgress({ done: 0, total: ids.length });

    let successCount = 0;
    let failCount = 0;
    const approvedItems: DutyRequest[] = [];

    for (const id of ids) {
      try {
        await updateDutyRequestStatus(id, actionLabelPast as "approved" | "rejected");
        await updateSheetStatus(id, actionLabelPast as "approved" | "rejected");
        successCount++;
        if (action === "approve") {
          const item = pendingRequests.find((r) => r.id === id);
          if (item) approvedItems.push(item);
        }
      } catch {
        failCount++;
      }
      setBatchProgress((prev) => prev ? { done: prev.done + 1, total: prev.total } : null);
    }

    // Update state
    setPendingRequests((prev) => prev.filter((r) => !selectedIds.has(r.id!)));
    if (action === "approve" && approvedItems.length > 0) {
      setApprovedRequests((prev) => [
        ...approvedItems.map((r) => ({ ...r, status: "approved" as const })),
        ...prev,
      ]);
    }

    setBatchProcessing(false);
    setBatchProgress(null);
    setBatchAction(null);
    setSelectedIds(new Set());
    exitBatchMode();

    if (failCount === 0) {
      Alert.alert("Done", `${successCount} request(s) ${actionLabelPast} successfully.`);
    } else {
      Alert.alert("Partial Success", `${successCount} succeeded, ${failCount} failed.`);
      await loadData();
    }
  };

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

  const handleStaffTap = (request: DutyRequest) => {
    setSelectedStaff({ name: request.userName, userId: request.userId, dutyDate: request.date });
  };

  // Swipe actions
  const renderSwipeRight = (request: DutyRequest) => (
    <TouchableOpacity
      onPress={() => handleApprove(request)}
      style={{ backgroundColor: "#22C55E", justifyContent: "center", alignItems: "center", paddingHorizontal: 20 }}
    >
      {processingId === request.id ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <>
          <MaterialIcons name="check" size={24} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600", marginTop: 2 }}>Approve</Text>
        </>
      )}
    </TouchableOpacity>
  );

  const renderSwipeLeft = (request: DutyRequest) => (
    <TouchableOpacity
      onPress={() => handleReject(request)}
      style={{ backgroundColor: "#EF4444", justifyContent: "center", alignItems: "center", paddingHorizontal: 20 }}
    >
      {processingId === request.id ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <>
          <MaterialIcons name="close" size={24} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600", marginTop: 2 }}>Reject</Text>
        </>
      )}
    </TouchableOpacity>
  );

  // Calendar render
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
    const cells: React.ReactNode[] = [];

    weekDays.forEach((day, i) =>
      cells.push(
        <View key={`header-${i}`} className="flex-1 items-center" style={{ paddingVertical: 2 }}>
          <Text className="text-xs text-muted font-medium">{day}</Text>
        </View>
      )
    );

    for (let i = 0; i < firstDay; i++) {
      const overflowDay = daysInPrevMonth - firstDay + 1 + i;
      const approvedForDay = getApprovedForAnyDate(overflowDay, prevMonthNum, prevYearNum);
      cells.push(
        <TouchableOpacity key={`prev-${i}`} className="flex-1 items-center py-1"
          onPress={() => handleOverflowDateTap(overflowDay, prevMonthNum, prevYearNum)}>
          <View className="w-7 h-7 rounded-full items-center justify-center">
            <Text className="text-xs" style={{ color: "#9CA3AF" }}>{overflowDay}</Text>
          </View>
          {approvedForDay.length > 0 && (
            <View className="flex-row" style={{ marginTop: 2, gap: 1 }}>
              {approvedForDay.slice(0, 3).map((r, idx) => (
                <View key={idx} style={{ backgroundColor: getDutyColor(r.dutyType), width: 5, height: 5, borderRadius: 2.5, opacity: 0.6 }} />
              ))}
            </View>
          )}
        </TouchableOpacity>
      );
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const isToday = isCurrentMonth && todayDate.getDate() === day;
      const approvedForDay = getApprovedForDate(day);
      cells.push(
        <TouchableOpacity key={`day-${day}`} className="flex-1 items-center py-1"
          onPress={() => handleDateTap(day)}>
          <View className={`w-7 h-7 rounded-full items-center justify-center ${isToday ? "bg-primary" : ""}`}>
            <Text className={`text-xs ${isToday ? "text-white font-bold" : "text-foreground"}`}>{day}</Text>
          </View>
          {approvedForDay.length > 0 && (
            <View className="flex-row" style={{ marginTop: 2, gap: 1 }}>
              {approvedForDay.slice(0, 3).map((r, idx) => (
                <View key={idx} style={{ backgroundColor: getDutyColor(r.dutyType), width: 5, height: 5, borderRadius: 2.5 }} />
              ))}
            </View>
          )}
        </TouchableOpacity>
      );
    }

    const totalCellsSoFar = cells.length - 7;
    const rem = totalCellsSoFar % 7;
    if (rem > 0) {
      const trailingCount = 7 - rem;
      for (let i = 1; i <= trailingCount; i++) {
        const approvedForDay = getApprovedForAnyDate(i, nextMonthNum, nextYearNum);
        cells.push(
          <TouchableOpacity key={`next-${i}`} className="flex-1 items-center py-1"
            onPress={() => handleOverflowDateTap(i, nextMonthNum, nextYearNum)}>
            <View className="w-7 h-7 rounded-full items-center justify-center">
              <Text className="text-xs" style={{ color: "#9CA3AF" }}>{i}</Text>
            </View>
            {approvedForDay.length > 0 && (
              <View className="flex-row" style={{ marginTop: 2, gap: 1 }}>
                {approvedForDay.slice(0, 3).map((r, idx) => (
                  <View key={idx} style={{ backgroundColor: getDutyColor(r.dutyType), width: 5, height: 5, borderRadius: 2.5, opacity: 0.6 }} />
                ))}
              </View>
            )}
          </TouchableOpacity>
        );
      }
    }

    const rows: React.ReactNode[] = [];
    for (let i = 0; i < cells.length; i += 7) {
      rows.push(<View key={`row-${i}`} className="flex-row">{cells.slice(i, i + 7)}</View>);
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
          style={{
            paddingVertical: 14,
            paddingHorizontal: 16,
            backgroundColor: isSelected ? "#F0FDF4" : undefined,
            flexDirection: "row",
            alignItems: "center",
            borderBottomWidth: 1,
            borderBottomColor: "#E5E7EB",
          }}
        >
          <View
            style={{
              width: 24, height: 24, borderRadius: 6, borderWidth: 2,
              borderColor: isSelected ? "#22C55E" : "#D1D5DB",
              backgroundColor: isSelected ? "#22C55E" : "transparent",
              alignItems: "center", justifyContent: "center", marginRight: 12,
            }}
          >
            {isSelected && <MaterialIcons name="check" size={15} color="#fff" />}
          </View>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#D1D5DB", marginRight: 12 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: "700" }} numberOfLines={1}>{item.userName}</Text>
            <Text style={{ fontSize: 12, color: "#687076", marginTop: 2 }}>{item.date}</Text>
          </View>
          <View style={{ backgroundColor: getDutyColor(item.dutyType), paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
            <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>{item.dutyType}</Text>
          </View>
        </TouchableOpacity>
      );
    }

    // Normal mode: inline buttons + swipe on native
    const itemContent = (
      <View
        style={{
          paddingVertical: 12,
          paddingHorizontal: 16,
          flexDirection: "row",
          alignItems: "center",
          borderBottomWidth: 1,
          borderBottomColor: "#E5E7EB",
        }}
      >
        <TouchableOpacity
          onPress={() => handleStaffTap(item)}
          style={{ flex: 1, flexDirection: "row", alignItems: "center" }}
          activeOpacity={0.7}
        >
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#D1D5DB", marginRight: 12 }} />
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={{ fontSize: 14, fontWeight: "700" }} numberOfLines={1}>{item.userName}</Text>
            <Text style={{ fontSize: 12, color: "#687076", marginTop: 2 }}>{item.date}</Text>
          </View>
          <View style={{ backgroundColor: getDutyColor(item.dutyType), paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginRight: 12 }}>
            <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>{item.dutyType}</Text>
          </View>
        </TouchableOpacity>
        {processingId === item.id ? (
          <ActivityIndicator size="small" color="#4CAF50" style={{ marginHorizontal: 8 }} />
        ) : (
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity
              onPress={() => handleApprove(item)}
              style={{ backgroundColor: "#22C55E", borderRadius: 8, padding: 10 }}
            >
              <MaterialIcons name="check" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleReject(item)}
              style={{ backgroundColor: "#EF4444", borderRadius: 8, padding: 10 }}
            >
              <MaterialIcons name="close" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );

    if (Platform.OS !== "web") {
      return (
        <Swipeable
          renderRightActions={() => renderSwipeRight(item)}
          renderLeftActions={() => renderSwipeLeft(item)}
          overshootRight={false}
          overshootLeft={false}
        >
          {itemContent}
        </Swipeable>
      );
    }
    return itemContent;
  };

  if (!isAdmin) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center px-6">
        <MaterialIcons name="lock" size={48} color="#9BA1A6" />
        <Text className="text-lg text-muted mt-4 text-center">Admin access required</Text>
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
  const bottomPad = Platform.OS === "web" ? 16 : Math.max(insets.bottom, 12);

  return (
    <ScreenContainer className="flex-1">
      {/* Header */}
      <View className="items-center py-2 border-b border-border">
        <Text className="text-lg font-bold text-foreground">Requests pending approval</Text>
      </View>

      {/* Selected Staff Info */}
      {!batchMode && (
        <View style={{ flexDirection: "row", marginHorizontal: 16, marginTop: 8, marginBottom: 4 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, color: "#687076" }}>Selected Staff Name:</Text>
            <Text style={{ fontSize: 12, color: "#687076" }}>Weekly hours (Sun-Sat):</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontSize: 14, fontWeight: "700" }}>
              {selectedStaff ? selectedStaff.name : "—"}
            </Text>
            <Text style={{ fontSize: 14, fontWeight: "700", color: selectedStaff && weeklyHours >= 14 ? "#EF4444" : undefined }}>
              {selectedStaff ? `${weeklyHours} hrs` : "—"}
              {selectedStaff && weeklyHours >= 14 ? " (≥14h)" : ""}
            </Text>
          </View>
        </View>
      )}

      {/* Calendar */}
      <View
        className="mx-3 border border-border rounded-xl p-3 bg-surface"
        style={{ height: CALENDAR_HEIGHT }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity onPress={prevMonth} style={{ padding: 8, borderRadius: 20, backgroundColor: "#f5f5f5" }}>
              <MaterialIcons name="chevron-left" size={24} color="#11181C" />
            </TouchableOpacity>
            <Text style={{ fontSize: 16, fontWeight: "700", marginHorizontal: 12 }}>
              {String(currentMonth + 1).padStart(2, "0")}/{currentYear}
            </Text>
            <TouchableOpacity onPress={nextMonth} style={{ padding: 8, borderRadius: 20, backgroundColor: "#f5f5f5" }}>
              <MaterialIcons name="chevron-right" size={24} color="#11181C" />
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {[
              { color: "#EF4444", label: "A" },
              { color: "#3B82F6", label: "P" },
              { color: "#22C55E", label: "9-17" },
              { color: "#86EFAC", label: "9-13" },
            ].map(({ color, label }) => (
              <View key={label} style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={{ backgroundColor: color, width: 8, height: 8, borderRadius: 4 }} />
                <Text style={{ fontSize: 10, color: "#687076", marginLeft: 3 }}>{label}</Text>
              </View>
            ))}
          </View>
        </View>
        {renderCalendar()}
      </View>

      {/* Pending Requests List */}
      <View className="flex-1 mx-3 mt-2 border border-border rounded-xl overflow-hidden"
        style={{ marginBottom: batchMode ? 0 : 8 }}>
        {/* List header */}
        <View style={{ backgroundColor: "#f5f5f5", paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#E5E7EB", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: "700" }}>
              Pending ({pendingRequests.length})
            </Text>
            {batchMode && (
              <Text style={{ fontSize: 12, color: "#687076", marginTop: 2 }}>
                {selectedIds.size === 0 ? "Tap items to select" : `${selectedIds.size} of ${pendingRequests.length} selected`}
              </Text>
            )}
          </View>

          {!batchMode && pendingRequests.length > 0 && (
            <TouchableOpacity
              onPress={enterBatchMode}
              style={{ backgroundColor: "#3B82F6", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}
            >
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>Batch</Text>
            </TouchableOpacity>
          )}
          {batchMode && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <TouchableOpacity
                onPress={toggleSelectAll}
                style={{
                  flexDirection: "row", alignItems: "center", borderRadius: 8,
                  paddingHorizontal: 10, paddingVertical: 6,
                  borderWidth: 1.5, borderColor: isAllSelected ? "#22C55E" : "#D1D5DB",
                  backgroundColor: isAllSelected ? "#F0FDF4" : "transparent", gap: 4,
                }}
              >
                <View style={{
                  width: 16, height: 16, borderRadius: 4, borderWidth: 1.5,
                  borderColor: isAllSelected ? "#22C55E" : "#9CA3AF",
                  backgroundColor: isAllSelected ? "#22C55E" : "transparent",
                  alignItems: "center", justifyContent: "center",
                }}>
                  {isAllSelected && <MaterialIcons name="check" size={11} color="#fff" />}
                </View>
                <Text style={{ fontSize: 12, fontWeight: "600", color: isAllSelected ? "#22C55E" : "#687076" }}>All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={exitBatchMode}
                style={{ backgroundColor: "#F3F4F6", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}
              >
                <Text style={{ fontSize: 12, fontWeight: "600", color: "#374151" }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* List */}
        {pendingRequests.length === 0 ? (
          <FlatList
            data={[]}
            renderItem={() => null}
            ListEmptyComponent={
              <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 32 }}>
                <MaterialIcons name="check-circle" size={40} color="#D1D5DB" />
                <Text style={{ color: "#687076", fontSize: 14, marginTop: 8 }}>No pending requests</Text>
              </View>
            }
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          />
        ) : (
          <FlatList
            data={pendingRequests}
            renderItem={renderPendingItem}
            keyExtractor={(item) => item.id || Math.random().toString()}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          />
        )}
      </View>

      {/* Sticky Batch Action Bar */}
      {batchMode && (
        <View
          style={{
            paddingBottom: bottomPad,
            backgroundColor: "#fff",
            borderTopWidth: 1,
            borderTopColor: "#E5E7EB",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.08,
            shadowRadius: 8,
            elevation: 8,
          }}
        >
          {/* Progress bar */}
          {batchProcessing && batchProgress && (
            <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <Text style={{ fontSize: 12, color: "#687076" }}>
                  {batchAction === "approve" ? "Approving" : "Rejecting"}… {batchProgress.done}/{batchProgress.total}
                </Text>
                <Text style={{ fontSize: 12, color: "#687076" }}>
                  {Math.round((batchProgress.done / batchProgress.total) * 100)}%
                </Text>
              </View>
              <View style={{ height: 4, backgroundColor: "#E5E7EB", borderRadius: 2, overflow: "hidden" }}>
                <View style={{
                  height: 4, borderRadius: 2,
                  backgroundColor: batchAction === "approve" ? "#22C55E" : "#EF4444",
                  width: `${(batchProgress.done / batchProgress.total) * 100}%`,
                }} />
              </View>
            </View>
          )}

          {/* Action buttons */}
          <View style={{ flexDirection: "row", paddingHorizontal: 16, paddingTop: 12, gap: 12 }}>
            <TouchableOpacity
              onPress={() => runBatch("reject")}
              disabled={selectedIds.size === 0 || batchProcessing}
              style={{
                flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
                borderRadius: 12, paddingVertical: 14,
                backgroundColor: selectedIds.size > 0 && !batchProcessing ? "#EF4444" : "#F3F4F6",
                gap: 6,
              }}
            >
              {batchProcessing && batchAction === "reject" ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <MaterialIcons name="close" size={18} color={selectedIds.size > 0 && !batchProcessing ? "#fff" : "#9CA3AF"} />
                  <Text style={{ fontSize: 15, fontWeight: "700", color: selectedIds.size > 0 && !batchProcessing ? "#fff" : "#9CA3AF" }}>
                    Reject {selectedIds.size > 0 ? `(${selectedIds.size})` : ""}
                  </Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => runBatch("approve")}
              disabled={selectedIds.size === 0 || batchProcessing}
              style={{
                flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
                borderRadius: 12, paddingVertical: 14,
                backgroundColor: selectedIds.size > 0 && !batchProcessing ? "#22C55E" : "#F3F4F6",
                gap: 6,
              }}
            >
              {batchProcessing && batchAction === "approve" ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <MaterialIcons name="check" size={18} color={selectedIds.size > 0 && !batchProcessing ? "#fff" : "#9CA3AF"} />
                  <Text style={{ fontSize: 15, fontWeight: "700", color: selectedIds.size > 0 && !batchProcessing ? "#fff" : "#9CA3AF" }}>
                    Approve {selectedIds.size > 0 ? `(${selectedIds.size})` : ""}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Approved Duties Modal */}
      <Modal visible={showDutyModal} transparent animationType="fade" onRequestClose={() => setShowDutyModal(false)}>
        <View className="flex-1 justify-center px-6" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View className="bg-background rounded-2xl p-4 max-h-[60%]">
            <Text className="text-lg font-bold text-foreground text-center mb-3">
              Approved Duties — {selectedDateStr}
            </Text>
            <FlatList
              data={selectedDateDuties}
              keyExtractor={(item) => item.id || Math.random().toString()}
              renderItem={({ item }) => (
                <View className="flex-row items-center py-3 px-3 border-b border-border">
                  <View className="w-8 h-8 rounded-full mr-3" style={{ backgroundColor: "#D1D5DB" }} />
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-foreground">{item.userName}</Text>
                  </View>
                  <View style={{ backgroundColor: getDutyColor(item.dutyType) }} className="px-2 py-1 rounded">
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
