import { describe, it, expect } from "vitest";

// Test sorting logic (ascending by duty date, then by createdAt)
describe("Sorting Logic", () => {
  function parseDateStr(dateStr: string): Date {
    const parts = dateStr.split("/");
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    return new Date(year, month, day);
  }

  it("should sort duty requests by date ascending", () => {
    const requests = [
      { date: "25/06/2026", createdAt: { toMillis: () => 100 } },
      { date: "20/06/2026", createdAt: { toMillis: () => 200 } },
      { date: "30/06/2026", createdAt: { toMillis: () => 50 } },
    ];

    const sorted = requests.sort((a, b) => {
      const dateA = parseDateStr(a.date);
      const dateB = parseDateStr(b.date);
      const dateDiff = dateA.getTime() - dateB.getTime();
      if (dateDiff !== 0) return dateDiff;
      const createdA = a.createdAt?.toMillis?.() || 0;
      const createdB = b.createdAt?.toMillis?.() || 0;
      return createdA - createdB;
    });

    expect(sorted[0].date).toBe("20/06/2026");
    expect(sorted[1].date).toBe("25/06/2026");
    expect(sorted[2].date).toBe("30/06/2026");
  });

  it("should sort by createdAt ascending when dates are equal", () => {
    const requests = [
      { date: "25/06/2026", createdAt: { toMillis: () => 300 } },
      { date: "25/06/2026", createdAt: { toMillis: () => 100 } },
      { date: "25/06/2026", createdAt: { toMillis: () => 200 } },
    ];

    const sorted = requests.sort((a, b) => {
      const dateA = parseDateStr(a.date);
      const dateB = parseDateStr(b.date);
      const dateDiff = dateA.getTime() - dateB.getTime();
      if (dateDiff !== 0) return dateDiff;
      const createdA = a.createdAt?.toMillis?.() || 0;
      const createdB = b.createdAt?.toMillis?.() || 0;
      return createdA - createdB;
    });

    expect(sorted[0].createdAt.toMillis()).toBe(100);
    expect(sorted[1].createdAt.toMillis()).toBe(200);
    expect(sorted[2].createdAt.toMillis()).toBe(300);
  });
});

// Test settings structure
describe("Settings Context Structure", () => {
  it("should have correct default duty options structure", () => {
    const DEFAULT_SETTINGS = {
      wardName: "Ward 8S",
      dutyOptions: [
        { label: "A", hours: 7, color: "#EF4444" },
        { label: "P", hours: 7, color: "#3B82F6" },
        { label: "0900-1700", hours: 7, color: "#22C55E" },
        { label: "0900-1300", hours: 4, color: "#86EFAC" },
      ],
    };

    expect(DEFAULT_SETTINGS.wardName).toBe("Ward 8S");
    expect(DEFAULT_SETTINGS.dutyOptions).toHaveLength(4);
    expect(DEFAULT_SETTINGS.dutyOptions[0]).toEqual({ label: "A", hours: 7, color: "#EF4444" });
    expect(DEFAULT_SETTINGS.dutyOptions[3]).toEqual({ label: "0900-1300", hours: 4, color: "#86EFAC" });
  });

  it("should calculate working hours from duty options", () => {
    const dutyOptions = [
      { label: "A", hours: 7, color: "#EF4444" },
      { label: "P", hours: 7, color: "#3B82F6" },
      { label: "0900-1700", hours: 7, color: "#22C55E" },
      { label: "0900-1300", hours: 4, color: "#86EFAC" },
    ];

    const getHours = (dutyType: string) => {
      const opt = dutyOptions.find((o) => o.label === dutyType);
      return opt ? opt.hours : 0;
    };

    expect(getHours("A")).toBe(7);
    expect(getHours("P")).toBe(7);
    expect(getHours("0900-1700")).toBe(7);
    expect(getHours("0900-1300")).toBe(4);
    expect(getHours("unknown")).toBe(0);
  });
});
