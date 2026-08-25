import { describe, expect, it } from "vitest";
import { completeHospitalEmailDomain, isHospitalEmail } from "../lib/hospital-email";

describe("completeHospitalEmailDomain", () => {
  it("completes the Hospital Authority domain after the user enters @", () => {
    expect(completeHospitalEmailDomain("staff123@")).toBe("staff123@ha.org.hk");
  });

  it("does not alter an existing email value", () => {
    expect(completeHospitalEmailDomain("staff123@ha.org.hk")).toBe("staff123@ha.org.hk");
  });

  it("accepts only the required Hospital Authority email domain", () => {
    expect(isHospitalEmail("staff123@ha.org.hk")).toBe(true);
    expect(isHospitalEmail("STAFF123@HA.ORG.HK ")).toBe(true);
    expect(isHospitalEmail("staff123@example.com")).toBe(false);
    expect(isHospitalEmail("staff123@ha.org")).toBe(false);
  });
});
