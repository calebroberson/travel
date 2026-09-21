import type { Place, VoteValue } from './types'

export type VoteMap = Map<string, VoteValue>

export const voteKey = (placeId: string, userId: string) => `${placeId}|${userId}`

export type Tally = {
  score: number
  wantCount: number
  mustCount: number
  byUser: Record<string, VoteValue>
}

/**
 * The single definition of a place's score in this client.
 *
 * It mirrors the place_with_votes view, but computes from the normalized
 * vote map instead of reading the view's columns. That is what lets an
 * optimistic tap and the realtime echo of that same tap be the identical
 * write: one entry in one map, so the echo is idempotent.
 */
export function tally(placeId: string, votes: VoteMap, memberIds: string[]): Tally {
  let score = 0
  let wantCount = 0
  let mustCount = 0
  const byUser: Record<string, VoteValue> = {}

  for (const userId of memberIds) {
    const v = votes.get(voteKey(placeId, userId))
    if (v === undefined) continue
    byUser[userId] = v
    score += v
    if (v >= 1) wantCount++
    if (v === 2) mustCount++
  }

  return { score, wantCount, mustCount, byUser }
}

/** Score desc, then created_at desc. Returns place ids. */
export function computeOrder(
  places: Map<string, Place>,
  votes: VoteMap,
  memberIds: string[],
): string[] {
  return [...places.values()]
    .sort((a, b) => {
      const sa = tally(a.id, votes, memberIds).score
      const sb = tally(b.id, votes, memberIds).score
      if (sb !== sa) return sb - sa
      return b.created_at.localeCompare(a.created_at)
    })
    .map((p) => p.id)
}
