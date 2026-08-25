import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Modal,
  Alert,
  RefreshControl,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useAuthContext } from "@/lib/auth-context";
import {
  getAllApprovedRequests,
  getAllUsers,
  updateDutyRequestStatus,
  type DutyRequest,
  type UserProfile,
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
import { filterApprovedDutiesByColleague, getFilterableColleagues, getVisibleApprovedDuties, type ApprovedDutyView } from "@/lib/approved-duty-view";
import { getNameInitials } from "@/lib/avatar-utils";
import { ModalCloseButton } from "@/components/modal-close-button";

function parseDateStr(dateStr: string): Date {
  const parts = dateStr.split("/");
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);
  return new Date(year, month, day);
}

export default function ApprovedDutyScreen() {
  const { isAdmin, userProfile, user } = useAuthContext();
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
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [approvedDutyView, setApprovedDutyView] = useState<ApprovedDutyView>("mine");
  const [filterableColleagues, setFilterableColleagues] = useState<UserProfile[]>([]);
  const [selectedColleagueId, setSelectedColleagueId] = useState<string | null>(null);
  const [showColleagueFilter, setShowColleagueFilter] = useState(false);
  const [isListExpanded, setIsListExpanded] = useState(false);

  const loadApproved = useCallback(async () => {
    try {
      // All users can see all approved duties regardless of role
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

  useEffect(() => {
    if (!isAdmin) return;
    getAllUsers()
      .then((users) => setFilterableColleagues(getFilterableColleagues(users)))
      .catch((error) => console.error("Error loading colleague filter:", error));
  }, [isAdmin]);

  const visibleApprovedRequests = useMemo(
    () => isAdmin
      ? filterApprovedDutiesByColleague(approvedRequests, selectedColleagueId)
      : getVisibleApprovedDuties(approvedRequests, user?.uid ?? userProfile?.uid, false, approvedDutyView),
    [approvedRequests, user?.uid, userProfile?.uid, isAdmin, approvedDutyView, selectedColleagueId],
  );

  const selectedColleagueName = useMemo(
    () => filterableColleagues.find((item) => item.uid === selectedColleagueId)?.name ?? "All staff",
    [filterableColleagues, selectedColleagueId],
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadApproved();
    setRefreshing(false);
  };

  // Derive the most recent updatedAt timestamp from the active approved-duty view.
  const lastUpdatedTime = useMemo(() => {
    if (visibleApprovedRequests.length === 0) return null;
    let latest = 0;
    for (const r of visibleApprovedRequests) {
      const ms = r.updatedAt?.toMillis?.() ?? 0;
      if (ms > latest) latest = ms;
    }
    return latest > 0 ? new Date(latest) : null;
  }, [visibleApprovedRequests]);

  const formatLastUpdated = (date: Date | null): string => {
    if (!date) return "—";
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return `Yesterday ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    return date.toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" }) +
      " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Filter: only show duties from today onwards in the list, sorted ascending
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const futureApproved = visibleApprovedRequests
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

    const weeklySource = isAdmin ? visibleApprovedRequests : approvedRequests.filter((r) => r.userId === (user?.uid ?? userProfile?.uid));
    const weekDuties = weeklySource.filter((r) => {
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

  // Direct reject action — no Alert.alert (which can be blocked by Swipeable gesture system)
  const handleReject = useCallback(async (request: DutyRequest) => {
    if (!request.id || rejectingId === request.id) return;
    setRejectingId(request.id);
    try {
      await updateDutyRequestStatus(request.id, "rejected");
      await updateSheetStatus(request.id, "rejected");
      setApprovedRequests((prev) => prev.filter((r) => r.id !== request.id));
    } catch (error) {
      Alert.alert("Error", "Failed to reject request.");
    } finally {
      setRejectingId(null);
    }
  }, [rejectingId]);

  // Swipe RIGHT reveals this action panel on the LEFT side (renderLeftActions)
  const renderLeftActions = (request: DutyRequest) => (
    <TouchableOpacity
      onPress={() => handleReject(request)}
      disabled={rejectingId === request.id}
      style={{
        backgroundColor: "#EF4444",
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 28,
        minWidth: 80,
      }}
    >
      {rejectingId === request.id ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <>
          <Text style={{ color: "#fff", fontSize: 20, fontWeight: "700" }}>✗</Text>
          <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600", marginTop: 2 }}>Reject</Text>
        </>
      )}
    </TouchableOpacity>
  );

  // Calendar navigation with PanResponder for swipe (using refs to avoid stale closure)
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

  const prevMonthRef = useRef(prevMonth);
  const nextMonthRef = useRef(nextMonth);
  prevMonthRef.current = prevMonth;
  nextMonthRef.current = nextMonth;

  const calendarPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (
        _: GestureResponderEvent,
        gestureState: PanResponderGestureState
      ) => {
        return Math.abs(gestureState.dx) > 30 && Math.abs(gestureState.dy) < 40;
      },
      onPanResponderRelease: (
        _: GestureResponderEvent,
        gestureState: PanResponderGestureState
      ) => {
        if (gestureState.dx > 50) {
          prevMonthRef.current();
        } else if (gestureState.dx < -50) {
          nextMonthRef.current();
        }
      },
    })
  ).current;

  // Get approved duties for any date
  const getApprovedForAnyDate = (day: number, month: number, year: number): DutyRequest[] => {
    const dateStr = formatDateStr(day, month, year);
    return visibleApprovedRequests.filter((r) => r.date === dateStr);
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

  // Calendar render — auto-height, no fixed container
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
      <View key="header" style={{ flexDirection: "row", marginBottom: 4 }}>
        {weekDays.map((day, i) => (
          <View key={`h-${i}`} style={{ flex: 1, alignItems: "center", paddingVertical: 4 }}>
            <Text style={{ fontSize: 11, color: colors.muted, fontWeight: "500" }}>{day}</Text>
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

    // Compact rows keep the calendar informative without crowding the duty list.
    for (let i = 0; i < allCells.length; i += 7) {
      const week = allCells.slice(i, i + 7);
      rows.push(
        <View key={`row-${i}`} style={{ flexDirection: "row", height: 43 }}>
          {week.map((cell, idx) => {
            const isToday =
              isCurrentMonth && !cell.isOverflow && todayDate.getDate() === cell.day;
            const approvedForDay = getApprovedForAnyDate(cell.day, cell.month, cell.year);
            const hasApproved = approvedForDay.length > 0;

            return (
              <TouchableOpacity
                key={`${i}-${idx}`}
                style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
                onPress={() => {
                  if (cell.isOverflow) {
                    handleOverflowDateTap(cell.day, cell.month, cell.year);
                  } else {
                    handleDateTap(cell.day);
                  }
                }}
              >
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: isToday ? "#4CAF50" : "transparent",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: isToday ? "700" : "400",
                      color: isToday ? "#fff" : cell.isOverflow ? "#9CA3AF" : colors.foreground,
                    }}
                  >
                    {cell.day}
                  </Text>
                </View>
                {hasApproved && (
                  <View style={{ flexDirection: "row", marginTop: 2, gap: 2 }}>
                    {approvedForDay.slice(0, 4).map((r, dotIdx) => (
                      <View
                        key={dotIdx}
                        style={{
                          backgroundColor: getDutyColor(r.dutyType),
                          width: 5,
                          height: 5,
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
    const avatarColor = filterableColleagues.find((profile) => profile.uid === item.userId)?.avatarColor ?? (item.userId === (user?.uid ?? userProfile?.uid) ? userProfile?.avatarColor : undefined) ?? "#E9D1DB";
    const content = (
      <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 16, backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: avatarColor, marginRight: 12, alignItems: "center", justifyContent: "center" }}><Text style={{ fontWeight: "700", color: "#475569" }}>{getNameInitials(item.userName)}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }} numberOfLines={1}>
            {item.userName}
          </Text>
          <Text style={{ fontSize: 12, color: colors.muted }}>{item.date}</Text>
        </View>
        <View style={{ backgroundColor: getDutyColor(item.dutyType), paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 }}>
          <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>{item.dutyType}</Text>
        </View>
      </View>
    );

    if (isAdmin) {
      // Swipe RIGHT to reveal reject button (renderLeftActions)
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
      <View style={{ alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Text style={{ fontSize: 18, fontWeight: "700", color: colors.foreground }}>Approved duty</Text>
        {isAdmin && (
          <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
            Swipe right → to reject duty
          </Text>
        )}
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
          <Text style={{ fontSize: 12, color: colors.muted }}>This week (Sun-Sat): </Text>
          <Text
            style={{
              fontSize: 12,
              fontWeight: isOverLimit ? "700" : "400",
              color: isOverLimit ? "#EF4444" : colors.muted,
            }}
          >
            {weeklyHours}h
          </Text>
          {isOverLimit && (
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#EF4444" }}> (≥14h)</Text>
          )}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 3 }}>
          <Text style={{ fontSize: 11, color: colors.muted }}>Last updated: </Text>
          <Text style={{ fontSize: 11, color: colors.muted, fontWeight: "500" }}>
            {isLoading ? "Loading…" : formatLastUpdated(lastUpdatedTime)}
          </Text>
        </View>
      </View>

      {/* Compact calendar leaves the remaining screen height for the duty list. */}
      <View
        style={{
          marginHorizontal: 12,
          marginTop: 8,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
          padding: 12,
          backgroundColor: colors.surface,
          overflow: "hidden",
        }}
      >
        {/* Month navigation header */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity
              onPress={prevMonth}
              style={{ padding: 8, borderRadius: 20, backgroundColor: colors.background }}
            >
              <Text style={{ fontSize: 18, color: colors.foreground, fontWeight: "700" }}>◀</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground, marginHorizontal: 12 }}>
              {String(currentMonth + 1).padStart(2, "0")}/{currentYear}
            </Text>
            <TouchableOpacity
              onPress={nextMonth}
              style={{ padding: 8, borderRadius: 20, backgroundColor: colors.background }}
            >
              <Text style={{ fontSize: 18, color: colors.foreground, fontWeight: "700" }}>▶</Text>
            </TouchableOpacity>
          </View>
          {!isAdmin && (
            <View
              style={{
                flexDirection: "row",
                padding: 2,
                borderRadius: 8,
                backgroundColor: colors.background,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              {([
                { value: "mine", label: "Mine" },
                { value: "all", label: "All" },
              ] as const).map((option) => {
                const selected = approvedDutyView === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    onPress={() => setApprovedDutyView(option.value)}
                    style={{
                      paddingHorizontal: 7,
                      paddingVertical: 3,
                      borderRadius: 6,
                      backgroundColor: selected ? "#4CAF50" : "transparent",
                    }}
                  >
                    <Text style={{ fontSize: 10, fontWeight: "700", color: selected ? "#fff" : colors.muted }}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
          {isAdmin && (
            <TouchableOpacity
              onPress={() => setShowColleagueFilter(true)}
              style={{ maxWidth: 96, flexDirection: "row", alignItems: "center", paddingHorizontal: 7, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}
            >
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 10, fontWeight: "700", color: colors.foreground }}>{selectedColleagueName}</Text>
              <Text style={{ marginLeft: 3, fontSize: 10, color: colors.muted }}>⌄</Text>
            </TouchableOpacity>
          )}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            {[
              { color: "#EF4444", label: "A" },
              { color: "#3B82F6", label: "P" },
              { color: "#22C55E", label: "9-17" },
              { color: "#86EFAC", label: "9-13" },
            ].map(({ color, label }) => (
              <View key={label} style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={{ backgroundColor: color, width: 7, height: 7, borderRadius: 4 }} />
                <Text style={{ fontSize: 9, color: colors.muted, marginLeft: 2 }}>{label}</Text>
              </View>
            ))}
          </View>
        </View>

        <TouchableOpacity
          onPress={() => setIsListExpanded((expanded) => !expanded)}
          style={{ alignSelf: "flex-end", marginBottom: isListExpanded ? 0 : 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}
        >
          <Text style={{ fontSize: 10, fontWeight: "700", color: colors.muted }}>{isListExpanded ? "Show calendar  ▾" : "More list  ▴"}</Text>
        </TouchableOpacity>

        {!isListExpanded && (
          <View {...calendarPanResponder.panHandlers}>{renderCalendar()}</View>
        )}
      </View>

      {/* Approved list expands into the released calendar space. */}
      <View style={{ flex: 1, marginHorizontal: 12, marginTop: 8, marginBottom: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 12, overflow: "hidden" }}>
        {futureApproved.length === 0 ? (
          <FlatList
            data={[]}
            renderItem={() => null}
            ListEmptyComponent={
              <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 24 }}>
                <Text style={{ color: colors.muted, fontSize: 14 }}>No upcoming approved duties</Text>
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

      {/* Admin colleague filter — only User Role accounts appear here. */}
      <Modal visible={showColleagueFilter} transparent onRequestClose={() => setShowColleagueFilter(false)}>
        <TouchableOpacity activeOpacity={1} onPress={() => setShowColleagueFilter(false)} style={{ flex: 1, justifyContent: "center", paddingHorizontal: 28, backgroundColor: "rgba(0,0,0,0.45)" }}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}} style={{ maxHeight: "65%", borderRadius: 16, padding: 20, backgroundColor: colors.background }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.foreground, marginBottom: 14 }}>Filter colleague</Text>
            <TouchableOpacity onPress={() => { setSelectedColleagueId(null); setShowColleagueFilter(false); }} style={{ minHeight: 48, justifyContent: "center", paddingHorizontal: 14, borderRadius: 10, backgroundColor: selectedColleagueId === null ? "#E8F5E9" : colors.surface, marginBottom: 8 }}>
              <Text style={{ fontWeight: "700", color: selectedColleagueId === null ? "#2E7D32" : colors.foreground }}>All staff</Text>
            </TouchableOpacity>
            <FlatList
              data={filterableColleagues}
              keyExtractor={(item) => item.uid}
              ListEmptyComponent={<Text style={{ padding: 14, textAlign: "center", color: colors.muted }}>No User Role colleagues found</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => { setSelectedColleagueId(item.uid); setShowColleagueFilter(false); }} style={{ minHeight: 48, justifyContent: "center", paddingHorizontal: 14, borderRadius: 10, backgroundColor: selectedColleagueId === item.uid ? "#E8F5E9" : colors.surface, marginBottom: 8 }}>
                  <Text style={{ fontWeight: "700", color: selectedColleagueId === item.uid ? "#2E7D32" : colors.foreground }}>{item.name}</Text>
                  <Text style={{ marginTop: 2, fontSize: 11, color: colors.muted }}>Staff no. {item.staffNumber}</Text>
                </TouchableOpacity>
              )}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Approved Duties Modal (on date tap) */}
      <Modal
        visible={showDutyModal}
        transparent
        onRequestClose={() => setShowDutyModal(false)}
      >
        <TouchableOpacity activeOpacity={1} onPress={() => setShowDutyModal(false)} style={{ flex: 1, justifyContent: "center", paddingHorizontal: 24, backgroundColor: "rgba(0,0,0,0.5)" }}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}} style={{ backgroundColor: colors.background, borderRadius: 16, padding: 16, maxHeight: "60%" }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground, textAlign: "center", marginBottom: 12 }}>
              Approved Duties — {selectedDateStr}
            </Text>
            <FlatList
              data={selectedDateDuties}
              renderItem={({ item }) => (
                <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }}>{item.userName}</Text>
                  </View>
                  <View style={{ backgroundColor: getDutyColor(item.dutyType), paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 }}>
                    <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>{item.dutyType}</Text>
                  </View>
                </View>
              )}
              keyExtractor={(item) => item.id || Math.random().toString()}
            />
            <ModalCloseButton onPress={() => setShowDutyModal(false)} />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </ScreenContainer>
  );
}
