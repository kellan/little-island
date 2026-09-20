// Counts come from the URL so a measurement can be reproduced exactly. Zero is a
// real count — it is how you attribute cost by taking one load away entirely —
// so it must not be mistaken for a missing parameter.
export function count(value: string | null, fallback: number, max: number): number {
  if (value === null || value.trim() === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(max, Math.round(parsed)));
}
