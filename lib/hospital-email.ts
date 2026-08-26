export function isHospitalEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith("@ha.org.hk");
}
