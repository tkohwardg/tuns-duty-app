import type { DutyRequest } from "@/lib/firebase";

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
