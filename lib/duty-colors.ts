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

/**
 * Get the most recent past Sunday (start of current week Sun-Sat)
 * If today is Sunday, returns today.
 */
export function getMostRecentSunday(fromDate?: Date): Date {
  const d = fromDate ? new Date(fromDate) : new Date();
  d.setHours(0, 0, 0, 0);
  const dayOfWeek = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  d.setDate(d.getDate() - dayOfWeek);
  return d;
}

/**
 * Get Saturday (end of current week Sun-Sat)
 */
export function getWeekEndSaturday(sunday: Date): Date {
  const sat = new Date(sunday);
  sat.setDate(sat.getDate() + 6);
  sat.setHours(23, 59, 59, 999);
  return sat;
}

/**
 * Calculate working hours for a duty type
 * A = 7 hours, P = 7 hours
 * 0900-1700 = 7 hours, 0900-1300 = 4 hours
 */
export function getDutyHours(dutyType: DutyType): number {
  switch (dutyType) {
    case "A":
      return 7;
    case "P":
      return 7;
    case "0900-1700":
      return 7;
    case "0900-1300":
      return 4;
    default:
      return 0;
  }
}

/**
 * Get the week (Sun-Sat) that contains a specific date.
 * Returns { sunday, saturday } for that week.
 */
export function getWeekForDate(dateStr: string): { sunday: Date; saturday: Date } | null {
  const d = parseDateString(dateStr);
  if (!d) return null;
  const sunday = getMostRecentSunday(d);
  const saturday = getWeekEndSaturday(sunday);
  return { sunday, saturday };
}

/**
 * Parse date string (D/M/YYYY) to Date object
 */
export function parseDateString(dateStr: string): Date | null {
  const parts = dateStr.split("/");
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);
  return new Date(year, month, day);
}

/**
 * Check if a date falls within the current week (Sun-Sat)
 */
export function isDateInCurrentWeek(dateStr: string, fromDate?: Date): boolean {
  const d = parseDateString(dateStr);
  if (!d) return false;
  const sunday = getMostRecentSunday(fromDate);
  const saturday = getWeekEndSaturday(sunday);
  return d >= sunday && d <= saturday;
}
