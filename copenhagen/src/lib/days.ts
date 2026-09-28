import { isoPlusDays } from './dates'
import type { TripDay } from './types'

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// Weekday from calendar parts via UTC, so a phone's time zone can't shift it.
function parts(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return { weekday: new Date(Date.UTC(y, m - 1, d)).getUTCDay(), month: m - 1, day: d }
}

/** 'Sat 21' */
export function shortDay(iso: string): string {
  const p = parts(iso)
  return `${WEEKDAYS[p.weekday].slice(0, 3)} ${p.day}`
}

/** 'Saturday, November 21' */
export function longDay(iso: string): string {
  const p = parts(iso)
  return `${WEEKDAYS[p.weekday]}, ${MONTHS[p.month]} ${p.day}`
}

/** Today if it falls inside the trip, otherwise the first day. */
export function defaultDay(days: TripDay[]): TripDay | undefined {
  const today = isoPlusDays(0)
  return days.find((d) => d.date === today) ?? days[0]
}
