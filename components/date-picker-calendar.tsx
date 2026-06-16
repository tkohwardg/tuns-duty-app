import React, { useState, useMemo } from "react";
import { Text, View, TouchableOpacity, Modal } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

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
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

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
      <View key="header" className="flex-row mb-1">
        {weekDays.map((day, i) => (
          <View key={`h-${i}`} className="flex-1 items-center py-1">
            <Text className="text-xs text-muted font-medium">{day}</Text>
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
        <View key={`row-${i}`} className="flex-row">
          {week.map((cell, idx) => {
            const selectable = isSelectable(cell.day, cell.month, cell.year);
            const cellDate = new Date(cell.year, cell.month, cell.day);
            const isSelected = selectedDate && isSameDay(cellDate, selectedDate);
            const isToday = isSameDay(cellDate, today);

            return (
              <TouchableOpacity
                key={`${i}-${idx}`}
                className="flex-1 items-center py-1.5"
                onPress={() => handleDayPress(cell.day, cell.month, cell.year)}
                disabled={!selectable}
              >
                <View
                  className={`w-8 h-8 rounded-full items-center justify-center ${
                    isSelected ? "bg-primary" : isToday ? "border border-primary" : ""
                  }`}
                >
                  <Text
                    className={`text-sm ${
                      isSelected
                        ? "text-white font-bold"
                        : !selectable
                        ? "text-muted opacity-30"
                        : cell.isOverflow
                        ? "text-muted"
                        : "text-foreground"
                    }`}
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
      <View className="flex-1 justify-center px-6" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
        <View className="bg-background rounded-2xl p-4">
          {/* Title */}
          <Text className="text-lg font-bold text-foreground text-center mb-3">
            {title}
          </Text>

          {/* Month navigation */}
          <View className="flex-row items-center justify-between mb-2">
            <TouchableOpacity onPress={prevMonth} className="p-2">
              <MaterialIcons name="chevron-left" size={24} color="#11181C" />
            </TouchableOpacity>
            <Text className="text-base font-bold text-foreground">
              {monthNames[viewMonth]} {viewYear}
            </Text>
            <TouchableOpacity onPress={nextMonth} className="p-2">
              <MaterialIcons name="chevron-right" size={24} color="#11181C" />
            </TouchableOpacity>
          </View>

          {/* Calendar grid */}
          {renderCalendar()}

          {/* Info text for restrictions */}
          {!noRestrictions && (
            <Text className="text-xs text-muted text-center mt-2">
              Selectable: 7 days from now to 8 weeks ahead
            </Text>
          )}

          {/* Cancel button */}
          <TouchableOpacity
            onPress={onClose}
            className="mt-3 py-2.5 rounded-xl items-center border border-border"
          >
            <Text className="text-foreground font-semibold">Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
