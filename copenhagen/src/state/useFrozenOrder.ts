import { useCallback, useEffect, useMemo, useState } from 'react'
import { computeOrder } from '../lib/tally'
import type { VoteMap } from '../lib/tally'
import type { Place } from '../lib/types'

/**
 * The board's display order, frozen against vote changes.
 *
 * With two voters a single tap swings a score by up to 3 — enough to throw a
 * card off screen from under the thumb that tapped it. So the order is a
 * snapshot: taken when the board mounts, kept in step with adds and deletes,
 * and re-sorted only when asked. `stale` says when the snapshot no longer
 * matches the scores.
 *
 * This is view state, so it lives with the board rather than in the trip
 * store. Leaving the tab and coming back re-sorts, which is the right
 * moment for it.
 */
export function useFrozenOrder(places: Map<string, Place>, votes: VoteMap, memberIds: string[]) {
  const sorted = useMemo(() => computeOrder(places, votes, memberIds), [places, votes, memberIds])
  const [order, setOrder] = useState<string[]>(sorted)

  // One reconciliation covers local adds, realtime adds and deletes: anything
  // new goes to the top, anything gone drops out.
  useEffect(() => {
    setOrder((prev) => {
      const kept = prev.filter((id) => places.has(id))
      const known = new Set(kept)
      const added = [...places.keys()].filter((id) => !known.has(id))
      if (added.length === 0 && kept.length === prev.length) return prev
      return [...added, ...kept]
    })
  }, [places])

  const stale = useMemo(() => sorted.join() !== order.join(), [sorted, order])
  const resort = useCallback(() => setOrder(sorted), [sorted])

  return { order, stale, resort }
}
