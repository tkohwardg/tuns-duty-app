import { describe, expect, it } from "vitest";
import { getRequestDateEligibility } from "../lib/request-date-eligibility";

describe("getRequestDateEligibility", () => {
  it("gives Admins today-through-eight-weeks eligibility without the monthly blackout", () => {
    expect(getRequestDateEligibility(true)).toEqual({ minDaysAhead: 0, restrictMonthlyWindow: false });
  });

  it("gives Users the configured lead-time eligibility with the standard monthly blackout", () => {
    expect(getRequestDateEligibility(false)).toEqual({ minDaysAhead: 14, restrictMonthlyWindow: true });
    expect(getRequestDateEligibility(false, 7)).toEqual({ minDaysAhead: 7, restrictMonthlyWindow: true });
    expect(getRequestDateEligibility(false, 21)).toEqual({ minDaysAhead: 21, restrictMonthlyWindow: true });
    expect(getRequestDateEligibility(false, 28)).toEqual({ minDaysAhead: 28, restrictMonthlyWindow: true });
  });
});
