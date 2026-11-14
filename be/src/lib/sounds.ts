/** Readable names for the ML service's sound codes ("M" = m/b/p, etc.). */
const NAMES: Record<string, string> = {
  a: "a",
  i: "i",
  u: "u",
  o: "o",
  e: "e",
  M: "m/b/p",
  F: "f/v",
  H: "h",
  S: "desis (s, c, z, j)",
  T: "huruf lidah (t, d, n, l, r, k, g)",
};

export const soundName = (code: string) => NAMES[code] ?? code;

export const soundList = (codes: string[]) => [...new Set(codes)].map(soundName).join(", ");
