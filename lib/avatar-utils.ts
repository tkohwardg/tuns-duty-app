/** Returns initials for every English name word, e.g. "CHAN, KING FUNG" → "CKF". */
export function getNameInitials(name: string | undefined | null): string {
  const initials = (name ?? "")
    .trim()
    .split(/[^A-Za-z]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase())
    .join("");
  return initials || "?";
}
