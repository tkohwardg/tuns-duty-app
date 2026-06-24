import React, { useState, useRef, useCallback } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  Modal,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
} from "react-native";
import { useColors } from "@/hooks/use-colors";

/**
 * Date restriction rules:
 * - Earliest selectable: today + 7 days
 * - Latest selectable: today + 8 weeks (56 days)
 * - When today is 15-26th of a month, dates 15-26 of that same month are NOT selectable
 * - Past dates are never selectable
 */

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function isDateSelectable(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  // Must be in the future
  if (targetDate <= today) return false;

  // Earliest: today + 7 days
  const minDate = new Date(today);
  minDate.setDate(minDate.getDate() + 7);
  if (targetDate < minDate) return false;

  // Latest: today + 8 weeks (56 days)
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + 56);
  if (targetDate > maxDate) return false;

  // When today is 15-26th, dates 15-26 of the SAME month as today are not selectable
  const todayDay = today.getDate();
  if (todayDay >= 15 && todayDay <= 26) {
    const targetDay = targetDate.getDate();
    const isSameMonth =
      targetDate.getMonth() === today.getMonth() &&
      targetDate.getFullYear() === today.getFullYear();
    if (isSameMonth && targetDay >= 15 && targetDay <= 26) {
      return false;
    }
  }

  return true;
}

interface DatePickerCalendarProps {
  visible: boolean;
  onClose: () => void;
  onSelectDate: (date: Date) => void;
  selectedDate?: Date | null;
  title?: string;
  /** If true, no date restrictions are applied (for export date picker) */
  noRestrictions?: boolean;
}

export function DatePickerCalendar({
  visible,
  onClose,
  onSelectDate,
  selectedDate,
  title = "Select Date",
  noRestrictions = false,
}: DatePickerCalendarProps) {
  const colors = useColors();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());

  const prevMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }, []);

  const nextMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }, []);

  // Use refs to avoid stale closure in PanResponder
  const prevMonthRef = useRef(prevMonth);
  const nextMonthRef = useRef(nextMonth);
  prevMonthRef.current = prevMonth;
  nextMonthRef.current = nextMonth;

  const panResponder = useRef(
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

  const isSelectable = (day: number, month: number, year: number): boolean => {
    if (noRestrictions) return true;
    const date = new Date(year, month, day);
    return isDateSelectable(date);
  };

  const handleDayPress = (day: number, month: number, year: number) => {
    if (!isSelectable(day, month, year)) return;
    const date = new Date(year, month, day);
    date.setHours(0, 0, 0, 0);
    onSelectDate(date);
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

    // Previous month overflow
    const prevMonthNum = viewMonth === 0 ? 11 : viewMonth - 1;
    const prevYearNum = viewMonth === 0 ? viewYear - 1 : viewYear;
    const daysInPrevMonth = getDaysInMonth(prevYearNum, prevMonthNum);

    // Next month overflow
    const nextMonthNum = viewMonth === 11 ? 0 : viewMonth + 1;
    const nextYearNum = viewMonth === 11 ? viewYear + 1 : viewYear;

    const weekDays = ["日", "一", "二", "三", "四", "五", "六"];
    const rows: React.ReactNode[] = [];

    // Header row
    rows.push(
      <View key="header" className="flex-row mb-2">
        {weekDays.map((day, i) => (
          <View key={`h-${i}`} className="flex-1 items-center py-1">
            <Text className="text-sm text-muted font-medium">{day}</Text>
          </View>
        ))}
      </View>
    );

    const allCells: { day: number; month: number; year: number; isOverflow: boolean }[] = [];

    // Leading overflow
    for (let i = 0; i < firstDay; i++) {
      const overflowDay = daysInPrevMonth - firstDay + 1 + i;
      allCells.push({ day: overflowDay, month: prevMonthNum, year: prevYearNum, isOverflow: true });
    }

    // Current month
    for (let day = 1; day <= daysInMonth; day++) {
      allCells.push({ day, month: viewMonth, year: viewYear, isOverflow: false });
    }

    // Trailing overflow
    const remainder = allCells.length % 7;
    if (remainder > 0) {
      const trailingCount = 7 - remainder;
      for (let i = 1; i <= trailingCount; i++) {
        allCells.push({ day: i, month: nextMonthNum, year: nextYearNum, isOverflow: true });
      }
    }

    // Build rows of 7
    for (let i = 0; i < allCells.length; i += 7) {
      const week = allCells.slice(i, i + 7);
      rows.push(
        <View key={`row-${i}`} className="flex-row" style={{ marginVertical: 3 }}>
          {week.map((cell, idx) => {
            const selectable = isSelectable(cell.day, cell.month, cell.year);
            const cellDate = new Date(cell.year, cell.month, cell.day);
            const isSelected = selectedDate && isSameDay(cellDate, selectedDate);
            const isToday = isSameDay(cellDate, today);

            return (
              <TouchableOpacity
                key={`${i}-${idx}`}
                className="flex-1 items-center"
                style={{ paddingVertical: 4 }}
                onPress={() => handleDayPress(cell.day, cell.month, cell.year)}
                disabled={!selectable}
              >
                <View
                  className={`w-9 h-9 rounded-full items-center justify-center ${
                    isSelected ? "bg-primary" : isToday ? "border border-primary" : ""
                  }`}
                >
                  <Text
                    className={`text-base ${
                      isSelected
                        ? "text-white font-bold"
                        : !selectable
                        ? "opacity-30"
                        : cell.isOverflow
                        ? ""
                        : "text-foreground"
                    }`}
                    style={
                      !selectable && !isSelected
                        ? { color: "#9CA3AF" }
                        : cell.isOverflow && !isSelected
                        ? { color: "#9CA3AF" }
                        : undefined
                    }
                  >
                    {cell.day}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      );
    }

    return rows;
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-center px-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
        <View className="bg-background rounded-2xl p-5">
          {/* Title */}
          <Text className="text-lg font-bold text-foreground text-center mb-4">
            {title}
          </Text>

          {/* Month navigation with clear arrows */}
          <View className="flex-row items-center justify-between mb-3">
            <TouchableOpacity
              onPress={prevMonth}
              className="p-2 rounded-full"
              style={{ backgroundColor: colors.surface }}
            >
              <Text style={{ fontSize: 22, color: colors.foreground, fontWeight: "700" }}>{"\u25c0"}</Text>
            </TouchableOpacity>
            <Text className="text-lg font-bold text-foreground">
              {monthNames[viewMonth]} {viewYear}
            </Text>
            <TouchableOpacity
              onPress={nextMonth}
              className="p-2 rounded-full"
              style={{ backgroundColor: colors.surface }}
            >
              <Text style={{ fontSize: 22, color: colors.foreground, fontWeight: "700" }}>{"\u25b6"}</Text>
            </TouchableOpacity>
          </View>

          {/* Calendar grid with swipe support */}
          <View {...panResponder.panHandlers}>
            {renderCalendar()}
          </View>

          {/* Info text for restrictions */}
          {!noRestrictions && (
            <Text className="text-xs text-muted text-center mt-3">
              Selectable: 7 days from now to 8 weeks ahead
            </Text>
          )}

          {/* Cancel button */}
          <TouchableOpacity
            onPress={onClose}
            className="mt-4 py-3 rounded-xl items-center border border-border"
          >
            <Text className="text-foreground font-semibold text-base">Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
