import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { buildApprovedDutiesWorkbook } from "../lib/approved-duties-export";

describe("buildApprovedDutiesWorkbook", () => {
  it("creates separate duty and selected-period total-hours sheets", () => {
    const workbook = buildApprovedDutiesWorkbook(
      XLSX,
      [
        { userId: "staff-2", userName: "Bob", date: "2/8/2026", dutyType: "0900-1300" },
        { userId: "staff-1", userName: "Alice", date: "1/8/2026", dutyType: "A" },
        { userId: "staff-1", userName: "Alice", date: "3/8/2026", dutyType: "P" },
      ],
      [
        { label: "A", hours: 7 },
        { label: "P", hours: 7 },
        { label: "0900-1300", hours: 4 },
      ],
      { wardName: "Ward 8S", exportPeriod: "August 2026" },
    );

    expect(workbook.SheetNames).toEqual(["Approved Duties", "Employee Total Hours"]);
    const duties = XLSX.utils.sheet_to_json(workbook.Sheets["Approved Duties"], { header: 1 }) as unknown[][];
    const totals = XLSX.utils.sheet_to_json(workbook.Sheets["Employee Total Hours"], { header: 1 }) as unknown[][];

    expect(duties[0][0]).toBe("Ward 8S — Approved Duties");
    expect(duties[1]).toEqual(["Export Period", "August 2026"]);
    expect(duties[3]).toEqual(["Date", "Staff Name", "Duty Type"]);
    expect(duties[4]).toEqual(["2/8/2026", "Bob", "0900-1300"]);
    expect(totals[0][0]).toBe("Ward 8S — Employee Total Hours");
    expect(totals[3]).toEqual(["Staff Name", "Total Approved Hours"]);
    expect(totals[4]).toEqual(["Alice", 14]);
    expect(totals[5]).toEqual(["Bob", 4]);
    expect(totals[7]).toEqual(["All Staff Total Approved Hours", 18]);
  });

  it("calculates hours only from the duties provided to the selected export period", () => {
    const workbook = buildApprovedDutiesWorkbook(
      XLSX,
      [{ userId: "staff-1", userName: "Alice", date: "1/8/2026", dutyType: "A" }],
      [{ label: "A", hours: 7 }],
      { wardName: "Ward 8S", exportPeriod: "August 2026" },
    );
    const totals = XLSX.utils.sheet_to_json(workbook.Sheets["Employee Total Hours"], { header: 1 }) as unknown[][];

    expect(totals[4]).toEqual(["Alice", 7]);
    expect(totals[6]).toEqual(["All Staff Total Approved Hours", 7]);
  });
});
