/**
 * Display text for the lowercase enum values from the database.
 * The stored values stay lowercase — these are for reading only.
 */
export function titleCase(s: string): string {
  return s.replace(/\b[a-z]/g, (c) => c.toUpperCase())
}
