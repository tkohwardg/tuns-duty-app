export function getRequestDateEligibility(isAdmin: boolean) {
  return { minDaysAhead: isAdmin ? 0 : 14, restrictMonthlyWindow: !isAdmin };
}
