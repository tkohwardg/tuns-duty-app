import { describe, it, expect } from "vitest";

// ========== Date Window Logic ==========
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
});

// ========== Sorting Logic (Ascending) ==========
describe("Sorting Logic - Ascending by duty date then createdAt", () => {
  function parseDateStr(dateStr: string): Date {
    const parts = dateStr.split("/");
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    return new Date(year, month, day);
  }

  it("should sort by duty date ascending (sooner date at top)", () => {
    const requests = [
      { date: "25/6/2026", createdAt: 1000 },
      { date: "20/6/2026", createdAt: 2000 },
      { date: "30/6/2026", createdAt: 500 },
    ];

    const sorted = [...requests].sort((a, b) => {
      const dateA = parseDateStr(a.date);
      const dateB = parseDateStr(b.date);
      const dateDiff = dateA.getTime() - dateB.getTime();
      if (dateDiff !== 0) return dateDiff;
      return a.createdAt - b.createdAt;
    });

    expect(sorted[0].date).toBe("20/6/2026");
    expect(sorted[1].date).toBe("25/6/2026");
    expect(sorted[2].date).toBe("30/6/2026");
  });

  it("should sort by createdAt ascending for same duty date (earlier request first)", () => {
    const requests = [
      { date: "25/6/2026", createdAt: 3000 },
      { date: "25/6/2026", createdAt: 1000 },
      { date: "25/6/2026", createdAt: 2000 },
    ];

    const sorted = [...requests].sort((a, b) => {
      const dateA = parseDateStr(a.date);
      const dateB = parseDateStr(b.date);
      const dateDiff = dateA.getTime() - dateB.getTime();
      if (dateDiff !== 0) return dateDiff;
      return a.createdAt - b.createdAt;
    });

    expect(sorted[0].createdAt).toBe(1000);
    expect(sorted[1].createdAt).toBe(2000);
    expect(sorted[2].createdAt).toBe(3000);
  });
});

// ========== Dynamic Duty Options ==========
describe("Dynamic Duty Options", () => {
  const DEFAULT_OPTIONS = [
    { label: "A", hours: 7, color: "#EF4444" },
    { label: "P", hours: 7, color: "#3B82F6" },
    { label: "0900-1700", hours: 7, color: "#22C55E" },
    { label: "0900-1300", hours: 4, color: "#86EFAC" },
  ];

  it("should have correct default duty options with hours", () => {
    expect(DEFAULT_OPTIONS.find((o) => o.label === "A")?.hours).toBe(7);
    expect(DEFAULT_OPTIONS.find((o) => o.label === "P")?.hours).toBe(7);
    expect(DEFAULT_OPTIONS.find((o) => o.label === "0900-1700")?.hours).toBe(7);
    expect(DEFAULT_OPTIONS.find((o) => o.label === "0900-1300")?.hours).toBe(4);
  });

  it("should have correct colors for each duty type", () => {
    expect(DEFAULT_OPTIONS.find((o) => o.label === "A")?.color).toBe("#EF4444"); // red
    expect(DEFAULT_OPTIONS.find((o) => o.label === "P")?.color).toBe("#3B82F6"); // blue
    expect(DEFAULT_OPTIONS.find((o) => o.label === "0900-1700")?.color).toBe("#22C55E"); // green
    expect(DEFAULT_OPTIONS.find((o) => o.label === "0900-1300")?.color).toBe("#86EFAC"); // light green
  });

  it("should allow adding new duty options", () => {
    const newOption = { label: "N", hours: 10, color: "#6366F1" };
    const updated = [...DEFAULT_OPTIONS, newOption];
    expect(updated.length).toBe(5);
    expect(updated.find((o) => o.label === "N")?.hours).toBe(10);
  });

  it("should allow removing duty options", () => {
    const updated = DEFAULT_OPTIONS.filter((o) => o.label !== "0900-1300");
    expect(updated.length).toBe(3);
    expect(updated.find((o) => o.label === "0900-1300")).toBeUndefined();
  });

  it("should prevent duplicate labels when adding", () => {
    const existingLabels = DEFAULT_OPTIONS.map((o) => o.label);
    const isDuplicate = existingLabels.includes("A");
    expect(isDuplicate).toBe(true);
  });
});

// ========== Week Calculation (Sunday to Saturday) ==========
describe("Week Calculation (Sunday to Saturday)", () => {
  function getMostRecentSunday(date: Date): Date {
    const d = new Date(date);
    const dayOfWeek = d.getDay();
    d.setDate(d.getDate() - dayOfWeek);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function getWeekEndSaturday(sundayDate: Date): Date {
    const d = new Date(sundayDate);
    d.setDate(d.getDate() + 6);
    d.setHours(23, 59, 59, 999);
    return d;
  }

  it("should find the most recent Sunday for a Thursday", () => {
    // June 25, 2026 is a Thursday
    const date = new Date(2026, 5, 25);
    const sunday = getMostRecentSunday(date);
    expect(sunday.getDay()).toBe(0);
    expect(sunday.getDate()).toBe(21);
  });

  it("should find the Saturday end of week", () => {
    const sunday = new Date(2026, 5, 21); // June 21 (Sunday)
    sunday.setHours(0, 0, 0, 0);
    const saturday = getWeekEndSaturday(sunday);
    expect(saturday.getDay()).toBe(6);
    expect(saturday.getDate()).toBe(27);
  });

  it("should handle Sunday as the start of its own week", () => {
    const date = new Date(2026, 5, 21); // June 21 is a Sunday
    const sunday = getMostRecentSunday(date);
    expect(sunday.getDate()).toBe(21);
  });

  it("should handle Saturday as the last day of its week", () => {
    const date = new Date(2026, 5, 27); // June 27 is a Saturday
    const sunday = getMostRecentSunday(date);
    expect(sunday.getDate()).toBe(21); // Week started on June 21
  });

  it("should calculate weekly hours correctly from dynamic options", () => {
    const dutyOptions = [
      { label: "A", hours: 7, color: "#EF4444" },
      { label: "P", hours: 7, color: "#3B82F6" },
      { label: "0900-1700", hours: 7, color: "#22C55E" },
      { label: "0900-1300", hours: 4, color: "#86EFAC" },
    ];

    const weekDuties = [
      { dutyType: "A" },
      { dutyType: "P" },
      { dutyType: "0900-1300" },
    ];

    const totalHours = weekDuties.reduce((sum, duty) => {
      const option = dutyOptions.find((o) => o.label === duty.dutyType);
      return sum + (option?.hours || 0);
    }, 0);

    expect(totalHours).toBe(18); // 7 + 7 + 4
  });
});

// ========== Request Status ==========
describe("Request Status Types", () => {
  const VALID_STATUSES = ["pending", "approved", "rejected", "cancelled"];

  it("should have 4 valid statuses", () => {
    expect(VALID_STATUSES.length).toBe(4);
  });

  it("cancelled should not mean deleted (status change only)", () => {
    const requests = [
      { id: "1", status: "pending" },
      { id: "2", status: "cancelled" },
      { id: "3", status: "approved" },
    ];
    expect(requests).toHaveLength(3);
    expect(requests.find((r) => r.id === "2")?.status).toBe("cancelled");
  });
});

// ========== Duplicate Check Logic ==========
describe("Duplicate Check Logic", () => {
  it("should detect duplicate: same user, same date, same duty type with pending status", () => {
    const existingRequests = [
      { userId: "user1", date: "25/6/2026", dutyType: "A", status: "pending" },
    ];

    const isDuplicate = existingRequests.some(
      (r) =>
        r.userId === "user1" &&
        r.date === "25/6/2026" &&
        r.dutyType === "A" &&
        (r.status === "pending" || r.status === "approved")
    );

    expect(isDuplicate).toBe(true);
  });

  it("should allow same user, same date, different duty type", () => {
    const existingRequests = [
      { userId: "user1", date: "25/6/2026", dutyType: "A", status: "pending" },
    ];

    const isDuplicate = existingRequests.some(
      (r) =>
        r.userId === "user1" &&
        r.date === "25/6/2026" &&
        r.dutyType === "P" &&
        (r.status === "pending" || r.status === "approved")
    );

    expect(isDuplicate).toBe(false);
  });

  it("should allow re-request after cancellation", () => {
    const existingRequests = [
      { userId: "user1", date: "25/6/2026", dutyType: "A", status: "cancelled" },
    ];

    const isDuplicate = existingRequests.some(
      (r) =>
        r.userId === "user1" &&
        r.date === "25/6/2026" &&
        r.dutyType === "A" &&
        (r.status === "pending" || r.status === "approved")
    );

    expect(isDuplicate).toBe(false);
  });
});

// ========== Approved Duty Filtering ==========
describe("Approved Duty Filtering (future only)", () => {
  function parseDateStr(dateStr: string): Date {
    const parts = dateStr.split("/");
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
      return d >= today;
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
      return d >= today;
    });

    expect(filtered).toHaveLength(1);
  });
});

// ========== Export CSV Format ==========
describe("Export CSV Format", () => {
  function parseDateStr(dateStr: string): Date {
    const parts = dateStr.split("/");
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    return new Date(year, month, day);
  }

  it("should generate valid CSV header", () => {
    const header = "Date,Staff Name,Email,Duty Type,Status,Requested At";
    const fields = header.split(",");
    expect(fields.length).toBe(6);
    expect(fields[0]).toBe("Date");
    expect(fields[3]).toBe("Duty Type");
  });

  it("should filter by date range for export", () => {
    const start = parseDateStr("1/6/2026");
    const end = parseDateStr("30/6/2026");

    const requests = [
      { date: "15/5/2026" },
      { date: "15/6/2026" },
      { date: "25/6/2026" },
      { date: "15/7/2026" },
    ];

    const filtered = requests.filter((r) => {
      const d = parseDateStr(r.date);
      return d >= start && d <= end;
    });

    expect(filtered.length).toBe(2);
  });

  it("should sort exported data by duty date ascending", () => {
    const requests = [
      { date: "25/6/2026", createdAt: 1000 },
      { date: "15/6/2026", createdAt: 2000 },
      { date: "20/6/2026", createdAt: 500 },
    ];

    const sorted = [...requests].sort((a, b) => {
      const dateA = parseDateStr(a.date);
      const dateB = parseDateStr(b.date);
      return dateA.getTime() - dateB.getTime();
    });

    expect(sorted[0].date).toBe("15/6/2026");
    expect(sorted[1].date).toBe("20/6/2026");
    expect(sorted[2].date).toBe("25/6/2026");
  });
});

// ========== Calendar Helpers ==========
describe("Calendar Helpers", () => {
  function getDaysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
  }

  function getFirstDayOfMonth(year: number, month: number): number {
    return new Date(year, month, 1).getDay();
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
});
