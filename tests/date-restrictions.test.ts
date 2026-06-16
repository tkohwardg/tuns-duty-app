import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Date restriction rules:
 * - Earliest selectable: today + 7 days
 * - Latest selectable: today + 8 weeks (56 days)
 * - When today is 15-26th, dates 15-26 of that same month are NOT selectable
 * - Past dates are never selectable
 */

function isDateSelectable(date: Date, mockToday?: Date): boolean {
  const today = mockToday ? new Date(mockToday) : new Date();
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

describe("Date Selection Restrictions", () => {
  it("should not allow past dates", () => {
    const today = new Date(2026, 0, 10); // Jan 10, 2026
    const yesterday = new Date(2026, 0, 9);
    expect(isDateSelectable(yesterday, today)).toBe(false);
  });

  it("should not allow today", () => {
    const today = new Date(2026, 0, 10);
    expect(isDateSelectable(today, today)).toBe(false);
  });

  it("should not allow dates within 7 days", () => {
    const today = new Date(2026, 0, 10); // Jan 10
    const in6Days = new Date(2026, 0, 16); // Jan 16
    expect(isDateSelectable(in6Days, today)).toBe(false);
  });

  it("should allow dates exactly 7 days from now", () => {
    const today = new Date(2026, 0, 10); // Jan 10
    const in7Days = new Date(2026, 0, 17); // Jan 17
    expect(isDateSelectable(in7Days, today)).toBe(true);
  });

  it("should allow dates within 8 weeks", () => {
    const today = new Date(2026, 0, 10); // Jan 10
    const in30Days = new Date(2026, 1, 9); // Feb 9
    expect(isDateSelectable(in30Days, today)).toBe(true);
  });

  it("should not allow dates beyond 8 weeks (56 days)", () => {
    const today = new Date(2026, 0, 10); // Jan 10
    const in57Days = new Date(2026, 2, 8); // Mar 8 (57 days)
    expect(isDateSelectable(in57Days, today)).toBe(false);
  });

  it("should allow date exactly 56 days from now", () => {
    const today = new Date(2026, 0, 10); // Jan 10
    const in56Days = new Date(2026, 2, 7); // Mar 7 (56 days)
    expect(isDateSelectable(in56Days, today)).toBe(true);
  });

  // 15-26 restriction tests
  it("when today is 15th, should NOT allow 22nd of same month (within 7-day window AND 15-26 restriction)", () => {
    const today = new Date(2026, 0, 15); // Jan 15
    const jan22 = new Date(2026, 0, 22); // Jan 22 - within 7 days AND in 15-26 range
    expect(isDateSelectable(jan22, today)).toBe(false);
  });

  it("when today is 15th, should NOT allow 26th of same month (15-26 restriction)", () => {
    const today = new Date(2026, 0, 15); // Jan 15
    const jan26 = new Date(2026, 0, 26); // Jan 26 - in 15-26 range
    expect(isDateSelectable(jan26, today)).toBe(false);
  });

  it("when today is 15th, should allow 27th of same month", () => {
    const today = new Date(2026, 0, 15); // Jan 15
    const jan27 = new Date(2026, 0, 27); // Jan 27 - outside 15-26 range, and > 7 days
    expect(isDateSelectable(jan27, today)).toBe(true);
  });

  it("when today is 26th, should allow 7 days later (Feb 2)", () => {
    const today = new Date(2026, 0, 26); // Jan 26
    const feb2 = new Date(2026, 1, 2); // Feb 2 (7 days later)
    expect(isDateSelectable(feb2, today)).toBe(true);
  });

  it("when today is 26th, should NOT allow Jan 27 (within 7 days)", () => {
    const today = new Date(2026, 0, 26); // Jan 26
    const jan27 = new Date(2026, 0, 27); // Jan 27 - only 1 day later
    expect(isDateSelectable(jan27, today)).toBe(false);
  });

  it("when today is 20th, should NOT allow 25th of same month (15-26 restriction + within 7 days)", () => {
    const today = new Date(2026, 0, 20); // Jan 20
    const jan25 = new Date(2026, 0, 25); // Jan 25 - within 7 days AND in 15-26 range
    expect(isDateSelectable(jan25, today)).toBe(false);
  });

  it("when today is 14th, should allow 22nd of same month (not in 15-26 restriction period)", () => {
    const today = new Date(2026, 0, 14); // Jan 14
    const jan22 = new Date(2026, 0, 22); // Jan 22 - 8 days later, today is NOT 15-26
    expect(isDateSelectable(jan22, today)).toBe(true);
  });

  it("when today is 27th, should allow Feb 3 (7 days later, no restriction)", () => {
    const today = new Date(2026, 0, 27); // Jan 27
    const feb3 = new Date(2026, 1, 3); // Feb 3 (7 days later)
    expect(isDateSelectable(feb3, today)).toBe(true);
  });

  it("when today is 15th, 15-26 restriction only applies to same month", () => {
    const today = new Date(2026, 0, 15); // Jan 15
    const feb20 = new Date(2026, 1, 20); // Feb 20 - different month, should be allowed
    expect(isDateSelectable(feb20, today)).toBe(true);
  });
});
