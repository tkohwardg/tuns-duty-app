import { describe, expect, it } from "vitest";
import {
  filterApprovedDutiesByColleague,
  getFilterableColleagues,
  getVisibleApprovedDuties,
} from "../lib/approved-duty-view";

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

  it("lists only User Role colleagues and filters duties only after selection", () => {
    const colleagues = getFilterableColleagues([
      { uid: "admin-1", name: "Admin Alice", role: "admin" },
      { uid: "user-b", name: "Bob", role: "user" },
      { uid: "user-a", name: "Alice", role: "user" },
    ] as any[]);

    expect(colleagues.map((user) => user.name)).toEqual(["Alice", "Bob"]);
    expect(filterApprovedDutiesByColleague(duties, null)).toHaveLength(2);
    expect(filterApprovedDutiesByColleague(duties, "user-b").map((duty) => duty.id)).toEqual(["two"]);
  });
});
