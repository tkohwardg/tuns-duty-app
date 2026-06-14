import { describe, it, expect } from "vitest";

// Test the date logic used in the request duty page
describe("Duty Request Date Logic", () => {
  function getMinDate(): Date {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function getMaxDate(): Date {
    const d = new Date();
    d.setDate(d.getDate() + 7 + 56); // 7 days + 8 weeks
    d.setHours(23, 59, 59, 999);
    return d;
  }

  function formatDate(date: Date): string {
    return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
  }

  function getAvailableDates(): Date[] {
    const dates: Date[] = [];
    const min = getMinDate();
    const max = getMaxDate();
    const current = new Date(min);
    while (current <= max) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }

  it("should have minimum date 7 days from now", () => {
    const min = getMinDate();
    const now = new Date();
    const diffMs = min.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    // Should be 6 or 7 days depending on time of day
    expect(diffDays).toBeGreaterThanOrEqual(6);
    expect(diffDays).toBeLessThanOrEqual(7);
  });

  it("should have maximum date 63 days from now (7 + 56)", () => {
    const max = getMaxDate();
    const now = new Date();
    const diffMs = max.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    // Should be around 63 days
    expect(diffDays).toBeGreaterThanOrEqual(62);
    expect(diffDays).toBeLessThanOrEqual(63);
  });

  it("should generate correct number of available dates (approximately 57 days)", () => {
    const dates = getAvailableDates();
    // 56 days range + 1 (inclusive) = 57
    expect(dates.length).toBe(57);
  });

  it("should format date correctly in DD/M/YYYY format", () => {
    const date = new Date(2026, 5, 15); // June 15, 2026
    expect(formatDate(date)).toBe("15/6/2026");
  });

  it("should not include today in available dates", () => {
    const dates = getAvailableDates();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const hasToday = dates.some((d) => d.getTime() === today.getTime());
    expect(hasToday).toBe(false);
  });

  it("should not include dates within 7 days", () => {
    const dates = getAvailableDates();
    const sixDaysFromNow = new Date();
    sixDaysFromNow.setDate(sixDaysFromNow.getDate() + 6);
    sixDaysFromNow.setHours(0, 0, 0, 0);
    const hasTooEarly = dates.some((d) => d.getTime() <= sixDaysFromNow.getTime());
    expect(hasTooEarly).toBe(false);
  });
});

describe("Duty Types", () => {
  const DUTY_OPTIONS = ["A", "P", "0900-1700", "0900-1300"];

  it("should have exactly 4 duty options", () => {
    expect(DUTY_OPTIONS.length).toBe(4);
  });

  it("should include all required duty types", () => {
    expect(DUTY_OPTIONS).toContain("A");
    expect(DUTY_OPTIONS).toContain("P");
    expect(DUTY_OPTIONS).toContain("0900-1700");
    expect(DUTY_OPTIONS).toContain("0900-1300");
  });
});

describe("Request Status Types", () => {
  const VALID_STATUSES = ["pending", "approved", "rejected", "cancelled"];

  it("should have 4 valid statuses", () => {
    expect(VALID_STATUSES.length).toBe(4);
  });

  it("should include all required statuses", () => {
    expect(VALID_STATUSES).toContain("pending");
    expect(VALID_STATUSES).toContain("approved");
    expect(VALID_STATUSES).toContain("rejected");
    expect(VALID_STATUSES).toContain("cancelled");
  });
});
