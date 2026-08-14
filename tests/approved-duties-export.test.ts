import { describe, expect, it } from "vitest";
import { buildApprovedDutiesCsv } from "../lib/approved-duties-export";

describe("buildApprovedDutiesCsv", () => {
  it("exports only duty details and calculates each employee's total approved hours", () => {
    const csv = buildApprovedDutiesCsv(
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

    expect(csv).toContain('"Ward 8S" Approved Duties');
    expect(csv).toContain('Export Period,"August 2026"');
    expect(csv).toContain("Date,Staff Name,Duty Type");
    expect(csv).toContain('1/8/2026,"Alice","A"');
    expect(csv).toContain("Employee Total Hours\nStaff Name,Total Approved Hours");
    expect(csv).toContain('"Alice",14');
    expect(csv).toContain('"Bob",4');
    expect(csv).toContain("All Staff Total Approved Hours,18");
    expect(csv).not.toContain("Requested At");
    expect(csv).not.toContain("Email");
    expect(csv).not.toContain("Status");
  });

  it("escapes quotation marks in staff names", () => {
    const csv = buildApprovedDutiesCsv(
      [{ userId: "staff-1", userName: 'May "M" Chan', date: "1/8/2026", dutyType: "A" }],
      [{ label: "A", hours: 7 }],
      { wardName: "Ward 8S", exportPeriod: "August 2026" },
    );

    expect(csv).toContain('"May ""M"" Chan"');
  });
});
