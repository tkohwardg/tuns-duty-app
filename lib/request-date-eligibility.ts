export type UserRequestLeadDays = 7 | 14 | 21 | 28;

export function getRequestDateEligibility(
  isAdmin: boolean,
  userRequestLeadDays: UserRequestLeadDays = 14,
) {
  return {
    minDaysAhead: isAdmin ? 0 : userRequestLeadDays,
    restrictMonthlyWindow: !isAdmin,
  };
}
