export function getRequestDateEligibility(isAdmin: boolean) {
  return { minDaysAhead: isAdmin ? 1 : 7, restrictMonthlyWindow: !isAdmin };
}
