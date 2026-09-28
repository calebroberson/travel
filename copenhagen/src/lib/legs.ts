/**
 * Transit legs are itinerary_item rows with kind 'transit'. The schema has
 * no columns for mode or duration and is treated as fixed, so both live in
 * the title using a readable convention:
 *
 *   "Metro · 14 min · M3 from Nørreport"
 *
 * Every part is optional on the way in. It stays legible in the Supabase
 * dashboard, round-trips cleanly, and a title that doesn't follow the
 * convention (typed by hand, say) degrades to plain detail text rather than
 * breaking. Two nullable columns would be tidier if the schema ever opens up.
 */

export const MODES = ['walk', 'bike', 'metro', 'bus', 'train', 'ferry', 'taxi'] as const
export type TravelMode = (typeof MODES)[number]

export const MODE_LABEL: Record<TravelMode, string> = {
  walk: 'Walk',
  bike: 'Bike',
  metro: 'Metro',
  bus: 'Bus',
  train: 'Train',
  ferry: 'Ferry',
  taxi: 'Taxi',
}

export const MODE_ICON: Record<TravelMode, string> = {
  walk: '🚶',
  bike: '🚲',
  metro: '🚇',
  bus: '🚌',
  train: '🚆',
  ferry: '⛴️',
  taxi: '🚕',
}

export type Leg = { mode: TravelMode | null; minutes: number | null; detail: string }

const SEP = ' · '
const MINUTES = /^(\d{1,3})\s*min$/i

export function encodeLeg(leg: Leg): string {
  const parts = [
    leg.mode ? MODE_LABEL[leg.mode] : null,
    leg.minutes !== null && leg.minutes > 0 ? `${leg.minutes} min` : null,
    leg.detail.trim() || null,
  ].filter((p): p is string => p !== null)
  // item_has_subject needs a non-null title on an item with no place.
  return parts.length > 0 ? parts.join(SEP) : 'Travel'
}

export function decodeLeg(title: string | null): Leg {
  const parts = (title ?? '').split(SEP)
  let i = 0

  let mode: TravelMode | null = null
  const first = parts[0]?.trim().toLowerCase()
  const found = MODES.find((m) => MODE_LABEL[m].toLowerCase() === first)
  if (found) {
    mode = found
    i++
  }

  let minutes: number | null = null
  const mm = parts[i] !== undefined ? MINUTES.exec(parts[i].trim()) : null
  if (mm) {
    minutes = Number(mm[1])
    i++
  }

  const detail = parts.slice(i).join(SEP).trim()
  return { mode, minutes, detail: detail === 'Travel' && !mode ? '' : detail }
}

/** Google Maps' travelmode for a leg; transit when nothing is planned yet. */
export function googleTravelMode(mode: TravelMode | null): string {
  switch (mode) {
    case 'walk':
      return 'walking'
    case 'bike':
      return 'bicycling'
    case 'taxi':
      return 'driving'
    default:
      return 'transit'
  }
}
