import { describe, expect, it } from "vitest";
import { isHospitalEmail } from "../lib/hospital-email";

describe("isHospitalEmail", () => {
  it("accepts only the required Hospital Authority email domain", () => {
    expect(isHospitalEmail("staff123@ha.org.hk")).toBe(true);
    expect(isHospitalEmail("STAFF123@HA.ORG.HK ")).toBe(true);
    expect(isHospitalEmail("staff123@example.com")).toBe(false);
    expect(isHospitalEmail("staff123@ha.org")).toBe(false);
  });
});
