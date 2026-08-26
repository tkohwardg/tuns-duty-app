type WeekDuty = { date: string; dutyType: string; userId: string };
type DutyOption = { label: string; hours: number };

function parseDutyDate(value: string) {
  const [day, month, year] = value.split("/").map(Number);
  return new Date(year, month - 1, day);
}

export function getSundaySaturdayRange(referenceDate: Date) {
  const start = new Date(referenceDate);
  start.setDate(referenceDate.getDate() - referenceDate.getDay());
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function calculateSundaySaturdayHours(duties: WeekDuty[], dutyOptions: DutyOption[], referenceDate: Date, userId?: string | null) {
  const { start: weekStart, end: weekEnd } = getSundaySaturdayRange(referenceDate);
  return duties
    .filter((duty) => !userId || duty.userId === userId)
    .filter((duty) => { const date = parseDutyDate(duty.date); return date >= weekStart && date <= weekEnd; })
    .reduce((total, duty) => total + (dutyOptions.find((option) => option.label === duty.dutyType)?.hours ?? 0), 0);
}
