import { toMinutes } from './time'

/**
 * Sunrise and sunset from the standard sunrise equation — no API, accurate
 * to a minute or two, which is plenty for "will it still be light at the
 * Round Tower". Times come back formatted in the trip's own time zone.
 *
 * https://en.wikipedia.org/wiki/Sunrise_equation
 */

export const COPENHAGEN = { lat: 55.6761, lng: 12.5683 }

export type SunTimes = { sunrise: string; sunset: string; daylightMinutes: number }

const rad = Math.PI / 180
const sin = (d: number) => Math.sin(d * rad)
const cos = (d: number) => Math.cos(d * rad)

export function sunTimes(
  dateIso: string,
  tz: string,
  lat = COPENHAGEN.lat,
  lng = COPENHAGEN.lng,
): SunTimes | null {
  const [y, m, d] = dateIso.split('-').map(Number)
  if (!y || !m || !d) return null

  // Days since J2000 noon, for this calendar date. Longitude is east-positive.
  const jdMidnight = Date.UTC(y, m - 1, d) / 86400000 + 2440587.5
  const n = Math.ceil(jdMidnight - 2451545.0 + 0.0008)
  const jStar = n - lng / 360

  const M = (357.5291 + 0.98560028 * jStar) % 360
  const C = 1.9148 * sin(M) + 0.02 * sin(2 * M) + 0.0003 * sin(3 * M)
  const lambda = (M + C + 180 + 102.9372) % 360
  const jTransit = 2451545.0 + jStar + 0.0053 * sin(M) - 0.0069 * sin(2 * lambda)

  const sinDec = sin(lambda) * sin(23.4397)
  const cosDec = Math.cos(Math.asin(sinDec))
  // -0.833° accounts for refraction and the sun's disc.
  const cosW = (sin(-0.833) - sin(lat) * sinDec) / (cos(lat) * cosDec)
  if (cosW > 1 || cosW < -1) return null // polar day or night; not Copenhagen's problem

  const w = Math.acos(cosW) / rad
  const toDate = (j: number) => new Date((j - 2440587.5) * 86400000)

  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const sunrise = fmt.format(toDate(jTransit - w / 360))
  const sunset = fmt.format(toDate(jTransit + w / 360))
  return { sunrise, sunset, daylightMinutes: toMinutes(sunset) - toMinutes(sunrise) }
}

export type DaylightFlag = { level: 'warn' | 'info'; text: string }

/**
 * For events that need daylight. Warns when the timing can't work, and
 * otherwise, with no time set yet, says how late is too late.
 */
export function daylightFlag(
  start: string | null,
  end: string | null,
  sun: SunTimes,
): DaylightFlag | null {
  if (!start) return { level: 'info', text: `Needs daylight · sunset ${sun.sunset}` }
  if (start < sun.sunrise) return { level: 'warn', text: `Before sunrise (${sun.sunrise})` }
  if (start >= sun.sunset) return { level: 'warn', text: `After dark · sunset ${sun.sunset}` }
  if (end && end > sun.sunset) return { level: 'warn', text: `Runs past sunset (${sun.sunset})` }

  const left = toMinutes(sun.sunset) - toMinutes(start)
  if (!end && left < 60) return { level: 'warn', text: `Only ${left} min of light left` }
  return null
}
