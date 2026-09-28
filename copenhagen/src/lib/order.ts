/**
 * Sort keys for itinerary_item.sort_order.
 *
 * The column is a plain integer and the schema is fixed, so this uses spaced
 * integers: new keys go at the midpoint between neighbours, and a day is
 * renumbered only when a gap closes. With a gap of 1024 that takes about ten
 * inserts between the same two items, which a trip day never gets near.
 *
 * Everything here is pure: callers describe the order they want, and get
 * back only the keys that have to change.
 */

export const GAP = 1024

/**
 * `count` evenly spaced integer keys strictly between `lo` and `hi`, or null
 * when they do not fit. A null bound means open-ended on that side.
 */
export function keysBetween(lo: number | null, hi: number | null, count: number): number[] | null {
  if (count === 0) return []
  const low = lo ?? (hi !== null ? hi - GAP * (count + 1) : 0)
  const high = hi ?? low + GAP * (count + 1)
  if (high <= low) return null

  const step = (high - low) / (count + 1)
  if (step < 1) return null

  const out: number[] = []
  let prev = low
  for (let i = 1; i <= count; i++) {
    const k = Math.round(low + step * i)
    if (k <= prev || k >= high) return null
    out.push(k)
    prev = k
  }
  return out
}

/**
 * New keys for a block of ids that now sits somewhere in `desired` (the full
 * target order of the day). Only the block moves if it fits between its new
 * neighbours; otherwise the whole day is renumbered. Either way the result is
 * verified strictly increasing across the entire day — keys can already be
 * tied or out of step if both phones reordered the same day at once, and this
 * is the point where that gets repaired.
 *
 * Returns id → new key, for changed ids only.
 */
export function planKeys(
  desired: string[],
  block: string[],
  current: Map<string, number>,
): Map<string, number> {
  const next = new Map(current)

  if (block.length > 0) {
    const start = desired.indexOf(block[0])
    const before = start > 0 ? desired[start - 1] : null
    const after = desired[start + block.length] ?? null
    const lo = before !== null ? (current.get(before) ?? null) : null
    const hi = after !== null ? (current.get(after) ?? null) : null
    const keys = keysBetween(lo, hi, block.length)
    if (keys) block.forEach((id, i) => next.set(id, keys[i]))
  }

  if (!strictlyIncreasing(desired, next)) {
    desired.forEach((id, i) => next.set(id, (i + 1) * GAP))
  }

  const changed = new Map<string, number>()
  for (const id of desired) {
    const k = next.get(id)!
    if (current.get(id) !== k) changed.set(id, k)
  }
  return changed
}

function strictlyIncreasing(ids: string[], keys: Map<string, number>): boolean {
  let prev = -Infinity
  for (const id of ids) {
    const k = keys.get(id)
    if (k === undefined || k <= prev) return false
    prev = k
  }
  return true
}
