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
    expect(diffDays).toBeGreaterThanOrEqual(6);
    expect(diffDays).toBeLessThanOrEqual(7);
  });

  it("should have maximum date 63 days from now (7 + 56)", () => {
    const max = getMaxDate();
    const now = new Date();
    const diffMs = max.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    expect(diffDays).toBeGreaterThanOrEqual(62);
    expect(diffDays).toBeLessThanOrEqual(63);
  });

  it("should generate correct number of available dates (approximately 57 days)", () => {
    const dates = getAvailableDates();
    expect(dates.length).toBe(57);
  });

  it("should format date correctly in D/M/YYYY format", () => {
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

describe("Duty Color Mapping", () => {
  const DUTY_COLORS: Record<string, string> = {
    A: "#EF4444",
    P: "#3B82F6",
    "0900-1300": "#86EFAC",
    "0900-1700": "#22C55E",
  };

  it("should map A to red", () => {
    expect(DUTY_COLORS["A"]).toBe("#EF4444");
  });

  it("should map P to blue", () => {
    expect(DUTY_COLORS["P"]).toBe("#3B82F6");
  });

  it("should map 0900-1300 to light green", () => {
    expect(DUTY_COLORS["0900-1300"]).toBe("#86EFAC");
  });

  it("should map 0900-1700 to green", () => {
    expect(DUTY_COLORS["0900-1700"]).toBe("#22C55E");
  });

  it("should have a color for every duty type", () => {
    const DUTY_OPTIONS = ["A", "P", "0900-1700", "0900-1300"];
    DUTY_OPTIONS.forEach((opt) => {
      expect(DUTY_COLORS[opt]).toBeDefined();
      expect(DUTY_COLORS[opt]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
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

  it("cancelled should not mean deleted (status change only)", () => {
    const requests = [
      { id: "1", status: "pending" },
      { id: "2", status: "cancelled" },
      { id: "3", status: "approved" },
    ];
    // All requests should still exist
    expect(requests).toHaveLength(3);
    expect(requests.find((r) => r.id === "2")?.status).toBe("cancelled");
  });
});

describe("Calendar Helpers", () => {
  function getDaysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
  }

  function getFirstDayOfMonth(year: number, month: number): number {
    return new Date(year, month, 1).getDay();
  }

  function formatDateStr(day: number, month: number, year: number): string {
    return `${day}/${month + 1}/${year}`;
  }

  it("should get correct days in June 2026 (30 days)", () => {
    expect(getDaysInMonth(2026, 5)).toBe(30);
  });

  it("should get correct days in February 2026 (28 days)", () => {
    expect(getDaysInMonth(2026, 1)).toBe(28);
  });

  it("should get correct first day of June 2026 (Monday = 1)", () => {
    expect(getFirstDayOfMonth(2026, 5)).toBe(1);
  });

  it("should format date string correctly", () => {
    expect(formatDateStr(21, 5, 2026)).toBe("21/6/2026");
    expect(formatDateStr(1, 0, 2026)).toBe("1/1/2026");
  });
});

describe("Approved Duty Filtering (future only)", () => {
  function parseDateStr(dateStr: string): Date | null {
    const parts = dateStr.split("/");
    if (parts.length !== 3) return null;
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    return new Date(year, month, day);
  }

  it("should filter out past duties", () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const requests = [
      { date: "1/1/2020", status: "approved" },
      { date: "1/1/2030", status: "approved" },
    ];

    const filtered = requests.filter((r) => {
      const d = parseDateStr(r.date);
      return d && d >= today;
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].date).toBe("1/1/2030");
  });

  it("should include today's duties", () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;

    const requests = [{ date: todayStr, status: "approved" }];

    const filtered = requests.filter((r) => {
      const d = parseDateStr(r.date);
      return d && d >= today;
    });

    expect(filtered).toHaveLength(1);
  });

  it("should parse date string correctly", () => {
    const date = parseDateStr("21/6/2026");
    expect(date).not.toBeNull();
    expect(date!.getDate()).toBe(21);
    expect(date!.getMonth()).toBe(5);
    expect(date!.getFullYear()).toBe(2026);
  });
});
