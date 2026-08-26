import { describe, expect, it } from "vitest";
import { calculateSundaySaturdayHours, getSundaySaturdayRange } from "../lib/weekly-hours";

describe("calculateSundaySaturdayHours", () => {
  const options = [{ label: "A", hours: 7 }, { label: "P", hours: 7 }, { label: "0900-1300", hours: 4 }];
  const duties = [
    { userId: "a", date: "30/8/2026", dutyType: "A" },
    { userId: "a", date: "5/9/2026", dutyType: "P" },
    { userId: "a", date: "6/9/2026", dutyType: "A" },
    { userId: "b", date: "2/9/2026", dutyType: "0900-1300" },
  ];
  it("counts selected colleague duties from the prior Sunday through coming Saturday only", () => {
    expect(calculateSundaySaturdayHours(duties, options, new Date(2026, 8, 2), "a")).toBe(14);
  });
  it("counts all staff when no colleague is selected", () => {
    expect(calculateSundaySaturdayHours(duties, options, new Date(2026, 8, 2))).toBe(18);
  });
  it("returns the Sunday-to-Saturday range containing the selected request date", () => {
    const range = getSundaySaturdayRange(new Date(2026, 7, 31));
    expect(range.start).toEqual(new Date(2026, 7, 30));
    expect(range.end.getDate()).toBe(5);
    expect(range.end.getMonth()).toBe(8);
  });
});
