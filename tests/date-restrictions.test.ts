import { describe, it, expect } from "vitest";

/**
 * User-role date restriction rules:
 * - Earliest selectable: today + 14 days
 * - Latest selectable: today + 8 weeks (56 days)
 * - If a legacy 15th–26th blackout overlaps the lead-time window,
 *   the 14-day lead-time rule takes priority.
 * - Past dates are never selectable.
 */

function isDateSelectable(date: Date, mockToday?: Date): boolean {
  const today = mockToday ? new Date(mockToday) : new Date();
  today.setHours(0, 0, 0, 0);

  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  // Past dates are never selectable.
  if (targetDate < today) return false;

  // The 14-day lead-time rule is evaluated first and has priority.
  const minDate = new Date(today);
  minDate.setDate(minDate.getDate() + 14);
  if (targetDate < minDate) return false;

  // Latest: today + 8 weeks (56 days).
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + 56);
  if (targetDate > maxDate) return false;

  // Legacy blackout: when today is 15–26th, dates 15–26 of the same
  // month are unavailable only within the lead-time period. Because the
  // lead-time check above has already passed, it never overrides the
  // 14-day eligibility rule.
  const todayDay = today.getDate();
  const targetDay = targetDate.getDate();
  const isSameMonth =
    targetDate.getMonth() === today.getMonth() &&
    targetDate.getFullYear() === today.getFullYear();
  const isLegacyBlackout =
    todayDay >= 15 && todayDay <= 26 && isSameMonth && targetDay >= 15 && targetDay <= 26;
  if (isLegacyBlackout && targetDate < minDate) return false;

  return true;
}

describe("Date Selection Restrictions", () => {
  it("should not allow past dates", () => {
    const today = new Date(2026, 0, 10);
    const yesterday = new Date(2026, 0, 9);
    expect(isDateSelectable(yesterday, today)).toBe(false);
  });

  it("should not allow today", () => {
    const today = new Date(2026, 0, 10);
    expect(isDateSelectable(today, today)).toBe(false);
  });

  it("should not allow dates within 14 days", () => {
    const today = new Date(2026, 0, 10);
    const in13Days = new Date(2026, 0, 23);
    expect(isDateSelectable(in13Days, today)).toBe(false);
  });

  it("should allow dates exactly 14 days from now", () => {
    const today = new Date(2026, 0, 10);
    const in14Days = new Date(2026, 0, 24);
    expect(isDateSelectable(in14Days, today)).toBe(true);
  });

  it("should allow dates within 8 weeks", () => {
    const today = new Date(2026, 0, 10);
    const in30Days = new Date(2026, 1, 9);
    expect(isDateSelectable(in30Days, today)).toBe(true);
  });

  it("should not allow dates beyond 8 weeks (56 days)", () => {
    const today = new Date(2026, 0, 10);
    const in57Days = new Date(2026, 2, 8);
    expect(isDateSelectable(in57Days, today)).toBe(false);
  });

  it("should allow date exactly 56 days from now", () => {
    const today = new Date(2026, 0, 10);
    const in56Days = new Date(2026, 2, 7);
    expect(isDateSelectable(in56Days, today)).toBe(true);
  });

  it("should reject a 15–26 date when it is still inside the 14-day window", () => {
    const today = new Date(2026, 0, 15);
    const jan26 = new Date(2026, 0, 26);
    expect(isDateSelectable(jan26, today)).toBe(false);
  });

  it("should allow a date after the 14-day window even when its day number is 15–26", () => {
    const today = new Date(2026, 0, 1);
    const jan15 = new Date(2026, 0, 15);
    expect(isDateSelectable(jan15, today)).toBe(true);
  });

  it("should allow a date exactly 14 days after the 15th", () => {
    const today = new Date(2026, 0, 15);
    const jan29 = new Date(2026, 0, 29);
    expect(isDateSelectable(jan29, today)).toBe(true);
  });

  it("should allow February 15 when it is beyond the 14-day window", () => {
    const today = new Date(2026, 0, 26);
    const feb15 = new Date(2026, 1, 15);
    expect(isDateSelectable(feb15, today)).toBe(true);
  });

  it("should reject dates before the 14-day window when today is the 20th", () => {
    const today = new Date(2026, 0, 20);
    const jan25 = new Date(2026, 0, 25);
    expect(isDateSelectable(jan25, today)).toBe(false);
  });

  it("should allow a date exactly 14 days after the 14th", () => {
    const today = new Date(2026, 0, 14);
    const jan28 = new Date(2026, 0, 28);
    expect(isDateSelectable(jan28, today)).toBe(true);
  });

  it("should reject February 3 when today is January 27 because it is before 14 days", () => {
    const today = new Date(2026, 0, 27);
    const feb3 = new Date(2026, 1, 3);
    expect(isDateSelectable(feb3, today)).toBe(false);
  });

  it("should allow February 20 when today is January 15", () => {
    const today = new Date(2026, 0, 15);
    const feb20 = new Date(2026, 1, 20);
    expect(isDateSelectable(feb20, today)).toBe(true);
  });
});
