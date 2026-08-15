import type * as XLSX from "xlsx";

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

export interface ApprovedDutiesExportMetadata {
  wardName: string;
  exportPeriod: string;
}

/**
 * Builds a two-sheet workbook for only the duties supplied by the selected export period.
 */
export function buildApprovedDutiesWorkbook(
  xlsx: typeof XLSX,
  duties: ApprovedDutyExportRow[],
  dutyOptions: DutyHoursOption[],
  metadata: ApprovedDutiesExportMetadata,
): XLSX.WorkBook {
  const dutyHours = new Map(dutyOptions.map((option) => [option.label, option.hours]));
  const staffTotals = new Map<string, { name: string; hours: number }>();

  duties.forEach((duty) => {
    const current = staffTotals.get(duty.userId) ?? { name: duty.userName, hours: 0 };
    current.hours += dutyHours.get(duty.dutyType) ?? 0;
    staffTotals.set(duty.userId, current);
  });

  const individualTotals = Array.from(staffTotals.values())
    .sort((a, b) => a.name.localeCompare(b.name));
  const allStaffTotalHours = individualTotals.reduce((total, staff) => total + staff.hours, 0);

  const dutiesSheet = xlsx.utils.aoa_to_sheet([
    [`${metadata.wardName} — Approved Duties`],
    ["Export Period", metadata.exportPeriod],
    [],
    ["Date", "Staff Name", "Duty Type"],
    ...duties.map((duty) => [duty.date, duty.userName, duty.dutyType]),
  ]);
  dutiesSheet["!merges"] = [xlsx.utils.decode_range("A1:C1")];
  dutiesSheet["!cols"] = [{ wch: 14 }, { wch: 24 }, { wch: 18 }];

  const totalsSheet = xlsx.utils.aoa_to_sheet([
    [`${metadata.wardName} — Employee Total Hours`],
    ["Export Period", metadata.exportPeriod],
    [],
    ["Staff Name", "Total Approved Hours"],
    ...individualTotals.map((staff) => [staff.name, staff.hours]),
    [],
    ["All Staff Total Approved Hours", allStaffTotalHours],
  ]);
  totalsSheet["!merges"] = [xlsx.utils.decode_range("A1:B1")];
  totalsSheet["!cols"] = [{ wch: 30 }, { wch: 26 }];

  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, dutiesSheet, "Approved Duties");
  xlsx.utils.book_append_sheet(workbook, totalsSheet, "Employee Total Hours");
  return workbook;
}
