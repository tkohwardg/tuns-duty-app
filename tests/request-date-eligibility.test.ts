import { describe, expect, it } from "vitest";
import { getRequestDateEligibility } from "../lib/request-date-eligibility";

describe("getRequestDateEligibility", () => {
  it("gives Admins today-through-eight-weeks eligibility without the monthly blackout", () => {
    expect(getRequestDateEligibility(true)).toEqual({ minDaysAhead: 0, restrictMonthlyWindow: false });
  });

  it("gives Users 14-day eligibility with the standard monthly blackout", () => {
    expect(getRequestDateEligibility(false)).toEqual({ minDaysAhead: 14, restrictMonthlyWindow: true });
  });
});
