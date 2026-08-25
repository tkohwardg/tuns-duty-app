export function completeHospitalEmailDomain(input: string): string {
  return input.endsWith("@") ? `${input}ha.org.hk` : input;
}

export function isHospitalEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith("@ha.org.hk");
}
