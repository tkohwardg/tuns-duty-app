export function completeHospitalEmailDomain(input: string): string {
  return input.endsWith("@") ? `${input}ha.org.hk` : input;
}
