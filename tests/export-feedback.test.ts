import { describe, expect, it } from "vitest";
import { getNoApprovedDutiesMessage } from "../lib/export-feedback";

describe("getNoApprovedDutiesMessage", () => {
  it("identifies the selected export period in the no-data feedback", () => {
    expect(getNoApprovedDutiesMessage("July 2026")).toBe(
      "No approved duties were found for July 2026. Please select a different month or date range and try again.",
    );
  });
});
