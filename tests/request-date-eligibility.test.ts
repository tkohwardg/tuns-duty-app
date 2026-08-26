import { describe, expect, it } from "vitest";
import { getRequestDateEligibility } from "../lib/request-date-eligibility";

describe("getRequestDateEligibility", () => {
  it("gives Admins next-day eligibility without the monthly blackout", () => {
    expect(getRequestDateEligibility(true)).toEqual({ minDaysAhead: 1, restrictMonthlyWindow: false });
  });

  it("preserves the standard User restrictions", () => {
    expect(getRequestDateEligibility(false)).toEqual({ minDaysAhead: 7, restrictMonthlyWindow: true });
  });
});
