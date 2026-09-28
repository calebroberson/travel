import type { ItineraryItem, TripDay } from './types'

/** For each place, the days it's scheduled on, in date order. */
export function scheduleByPlace(
  items: Map<string, ItineraryItem>,
  days: TripDay[],
): Map<string, TripDay[]> {
  const byId = new Map(days.map((d) => [d.id, d]))
  const out = new Map<string, TripDay[]>()
  for (const item of items.values()) {
    if (!item.place_id) continue
    const day = byId.get(item.day_id)
    if (!day) continue
    const list = out.get(item.place_id) ?? []
    if (!list.includes(day)) list.push(day)
    out.set(item.place_id, list)
  }
  for (const list of out.values()) list.sort((a, b) => a.date.localeCompare(b.date))
  return out
}
