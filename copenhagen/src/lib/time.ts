/** Postgres `time` arrives as 'HH:MM:SS'; the UI works in zero-padded 'HH:MM'. */
export function hhmm(t: string | null | undefined): string | null {
  if (!t) return null
  const m = /^(\d{1,2}):(\d{2})/.exec(t)
  if (!m) return null
  return `${m[1].padStart(2, '0')}:${m[2]}`
}

/** 'HH:MM' → minutes after midnight. */
export function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/** 90 → '1h 30m', 45 → '45m'. */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}
