import { describe, expect, it } from "vitest";
import { getVisibleApprovedDuties } from "../lib/approved-duty-view";

const duties = [
  { id: "one", userId: "user-a", userName: "Alice" },
  { id: "two", userId: "user-b", userName: "Bob" },
] as any[];

describe("getVisibleApprovedDuties", () => {
  it("defaults to the logged-in User's duties when Mine is selected", () => {
    expect(getVisibleApprovedDuties(duties, "user-a", false, "mine").map((duty) => duty.id)).toEqual(["one"]);
  });

  it("shows all duties for a User who selects All and for every Admin", () => {
    expect(getVisibleApprovedDuties(duties, "user-a", false, "all")).toHaveLength(2);
    expect(getVisibleApprovedDuties(duties, "user-a", true, "mine")).toHaveLength(2);
  });
});
