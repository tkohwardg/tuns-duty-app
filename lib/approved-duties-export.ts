export interface ApprovedDutyExportRow {
  userId: string;
  userName: string;
  date: string;
  dutyType: string;
}

export interface DutyHoursOption {
  label: string;
  hours: number;
}

function escapeCsvValue(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * Builds a CSV with approved-duty detail rows followed by total approved hours per employee.
 */
export function buildApprovedDutiesCsv(
  duties: ApprovedDutyExportRow[],
  dutyOptions: DutyHoursOption[],
): string {
  const detailRows = duties
    .map((duty) => `${duty.date},${escapeCsvValue(duty.userName)},${escapeCsvValue(duty.dutyType)}`)
    .join("\n");

  const dutyHours = new Map(dutyOptions.map((option) => [option.label, option.hours]));
  const staffTotals = new Map<string, { name: string; hours: number }>();
  duties.forEach((duty) => {
    const current = staffTotals.get(duty.userId) ?? { name: duty.userName, hours: 0 };
    current.hours += dutyHours.get(duty.dutyType) ?? 0;
    staffTotals.set(duty.userId, current);
  });

  const totalRows = Array.from(staffTotals.values())
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((staff) => `${escapeCsvValue(staff.name)},${staff.hours}`)
    .join("\n");

  return [
    "Approved Duties",
    "Date,Staff Name,Duty Type",
    detailRows,
    "",
    "Employee Total Hours",
    "Staff Name,Total Approved Hours",
    totalRows,
  ].join("\n");
}
