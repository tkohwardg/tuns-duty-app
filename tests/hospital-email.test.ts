import { describe, expect, it } from "vitest";
import { completeHospitalEmailDomain } from "../lib/hospital-email";

describe("completeHospitalEmailDomain", () => {
  it("completes the Hospital Authority domain after the user enters @", () => {
    expect(completeHospitalEmailDomain("staff123@")).toBe("staff123@ha.org.hk");
  });

  it("does not alter an existing email value", () => {
    expect(completeHospitalEmailDomain("staff123@ha.org.hk")).toBe("staff123@ha.org.hk");
  });
});
