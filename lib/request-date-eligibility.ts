export function getRequestDateEligibility(isAdmin: boolean) {
  return { minDaysAhead: isAdmin ? 0 : 7, restrictMonthlyWindow: !isAdmin };
}
