import type { DutyType } from "./firebase";

/**
 * Color mapping for duty types
 * Red for 'A', Blue for 'P', Light Green for '0900-1300', Green for '0900-1700'
 */
export const DUTY_COLORS: Record<DutyType, string> = {
  A: "#EF4444",         // Red
  P: "#3B82F6",         // Blue
  "0900-1300": "#86EFAC", // Light Green
  "0900-1700": "#22C55E", // Green
};

export function getDutyColor(dutyType: DutyType): string {
  return DUTY_COLORS[dutyType] || "#6B7280";
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

export function formatDateStr(day: number, month: number, year: number): string {
  return `${day}/${month + 1}/${year}`;
}
