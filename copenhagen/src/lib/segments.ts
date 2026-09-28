import type { ItineraryItem } from './types'
import { hhmm } from './time'

/**
 * A day is a flat, sort_order-ordered list of items in the database. The
 * planner reads it as a sequence of events, each carrying the transit legs
 * that lead *to* it.
 *
 * Legs belong to the event after them. That one rule is what keeps travel
 * plans attached to the right place: moving or re-timing an event moves its
 * inbound legs with it, so "Metro to Tivoli" never ends up sitting between
 * breakfast and lunch after Tivoli has moved to the evening.
 */

export type EventBlock = {
  event: ItineraryItem
  /** Transit items directly before the event, in order. */
  inbound: ItineraryItem[]
}

export type DayPlan = {
  blocks: EventBlock[]
  /** Legs after the last event — the way back to the hotel. */
  trailing: ItineraryItem[]
}

export function sortItems(items: ItineraryItem[]): ItineraryItem[] {
  return [...items].sort(
    (a, b) =>
      a.sort_order - b.sort_order ||
      a.created_at.localeCompare(b.created_at) ||
      a.id.localeCompare(b.id),
  )
}

export function buildPlan(items: ItineraryItem[]): DayPlan {
  const blocks: EventBlock[] = []
  let pending: ItineraryItem[] = []
  for (const item of sortItems(items)) {
    if (item.kind === 'transit') {
      pending.push(item)
    } else {
      blocks.push({ event: item, inbound: pending })
      pending = []
    }
  }
  return { blocks, trailing: pending }
}

const blockIds = (b: EventBlock) => [...b.inbound.map((i) => i.id), b.event.id]

function flatten(blocks: EventBlock[], trailing: ItineraryItem[]): string[] {
  return [...blocks.flatMap(blockIds), ...trailing.map((i) => i.id)]
}

/** The result of any rearrangement: the target order, and which ids moved. */
export type Rearrangement = { desired: string[]; moved: string[] }

/** Swap an event (with its inbound legs) with the neighbouring event. */
export function moveEvent(plan: DayPlan, eventId: string, dir: -1 | 1): Rearrangement | null {
  const i = plan.blocks.findIndex((b) => b.event.id === eventId)
  const j = i + dir
  if (i < 0 || j < 0 || j >= plan.blocks.length) return null

  const blocks = [...plan.blocks]
  ;[blocks[i], blocks[j]] = [blocks[j], blocks[i]]
  return { desired: flatten(blocks, plan.trailing), moved: blockIds(plan.blocks[i]) }
}

/**
 * Where an event with this start time belongs: directly before the first
 * *other* event that starts later, taking that event's inbound legs as part
 * of it. With no later event, after the last one — but still ahead of the
 * trailing legs home. Untimed events are left exactly where they are, which
 * is what lets loose items like "coffee somewhere" stay put between anchors.
 */
function timedIndex(blocks: EventBlock[], start: string): number {
  const idx = blocks.findIndex((b) => {
    const t = hhmm(b.event.start_time)
    return t !== null && t > start
  })
  return idx === -1 ? blocks.length : idx
}

/**
 * Re-file an existing event chronologically after its start time changed.
 * Returns null when it is already somewhere consistent with its new time —
 * nothing earlier-timed after it, nothing later-timed before it — so giving a
 * time to an item never moves it without a reason.
 */
export function fileEvent(plan: DayPlan, eventId: string, start: string): Rearrangement | null {
  const i = plan.blocks.findIndex((b) => b.event.id === eventId)
  if (i < 0) return null
  const block = plan.blocks[i]

  const timeOf = (b: EventBlock) => hhmm(b.event.start_time)
  const consistent =
    plan.blocks.slice(0, i).every((b) => (timeOf(b) ?? start) <= start) &&
    plan.blocks.slice(i + 1).every((b) => (timeOf(b) ?? start) >= start)
  if (consistent) return null

  const rest = plan.blocks.filter((b) => b !== block)
  const at = timedIndex(rest, start)
  rest.splice(at, 0, block)
  return { desired: flatten(rest, plan.trailing), moved: blockIds(block) }
}

/**
 * Slot a new event in. Timed: chronologically. Untimed: at the end of the
 * day, still ahead of the trailing legs home.
 */
export function insertEvent(plan: DayPlan, item: ItineraryItem): Rearrangement {
  const start = hhmm(item.start_time)
  const at = start ? timedIndex(plan.blocks, start) : plan.blocks.length
  const blocks = [...plan.blocks]
  blocks.splice(at, 0, { event: item, inbound: [] })
  return { desired: flatten(blocks, plan.trailing), moved: [item.id] }
}

/**
 * Add a leg leading to `eventId`, after any legs already there. A null
 * eventId means a trailing leg, appended at the very end.
 */
export function insertLeg(plan: DayPlan, leg: ItineraryItem, eventId: string | null): Rearrangement {
  if (eventId === null) {
    return {
      desired: [...flatten(plan.blocks, plan.trailing), leg.id],
      moved: [leg.id],
    }
  }
  const blocks = plan.blocks.map((b) =>
    b.event.id === eventId ? { ...b, inbound: [...b.inbound, leg] } : b,
  )
  return { desired: flatten(blocks, plan.trailing), moved: [leg.id] }
}

/** Ids removed along with an item. An event takes its inbound legs with it. */
export function removalSet(plan: DayPlan, itemId: string): string[] {
  const block = plan.blocks.find((b) => b.event.id === itemId)
  return block ? blockIds(block) : [itemId]
}
