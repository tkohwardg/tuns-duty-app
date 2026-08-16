import type { DutyRequest, UserProfile } from "@/lib/firebase";

export type ApprovedDutyView = "mine" | "all";

/** Returns the approved duties visible for the active role and selected view mode. */
export function getVisibleApprovedDuties(
  duties: DutyRequest[],
  currentUserId: string | undefined,
  isAdmin: boolean,
  view: ApprovedDutyView,
): DutyRequest[] {
  if (isAdmin || view === "all") return duties;
  if (!currentUserId) return [];
  return duties.filter((duty) => duty.userId === currentUserId);
}

/** Returns only User Role colleagues, ordered by name, for the Admin filter. */
export function getFilterableColleagues(users: UserProfile[]): UserProfile[] {
  return users
    .filter((user) => user.role === "user")
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Keeps all duties until an Admin explicitly selects a User Role colleague. */
export function filterApprovedDutiesByColleague(
  duties: DutyRequest[],
  selectedUserId: string | null,
): DutyRequest[] {
  if (!selectedUserId) return duties;
  return duties.filter((duty) => duty.userId === selectedUserId);
}
