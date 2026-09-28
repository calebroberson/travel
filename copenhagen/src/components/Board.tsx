import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { useTrip } from '../state/TripProvider'
import { useFrozenOrder } from '../state/useFrozenOrder'
import { scheduleByPlace } from '../lib/schedule'
import type { PlaceCategory, VoteValue } from '../lib/types'
import { CATEGORIES } from '../lib/types'
import AddBar from './AddBar'
import FilterChips from './FilterChips'
import PlaceCard from './PlaceCard'
import EditSheet from './EditSheet'

export default function Board() {
  const {
    userId,
    members,
    memberIds,
    places,
    votes,
    days,
    items,
    addPlace,
    castVote,
    updatePlace,
    deletePlace,
    addEvent,
  } = useTrip()

  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [editingId, setEditingId] = useState<string | null>(null)
  const { order, stale, resort } = useFrozenOrder(places, votes, memberIds)

  // Filters live in the query string so a filtered view is linkable.
  const rawCategory = params.get('cat')
  const category = CATEGORIES.includes(rawCategory as PlaceCategory)
    ? (rawCategory as PlaceCategory)
    : null
  const neighborhood = params.get('hood')

  const neighborhoods = useMemo(() => {
    const set = new Set<string>()
    for (const p of places.values()) if (p.neighborhood) set.add(p.neighborhood)
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [places])

  const schedule = useMemo(() => scheduleByPlace(items, days), [items, days])

  const visible = useMemo(() => {
    return order
      // flatMap rather than map+filter: narrows away the undefined without
      // depending on inferred type predicates.
      .flatMap((id) => {
        const p = places.get(id)
        return p ? [p] : []
      })
      .filter((p) => (category ? p.category === category : true))
      .filter((p) => (neighborhood ? p.neighborhood === neighborhood : true))
  }, [order, places, category, neighborhood])

  function setFilter(next: { category?: string | null; neighborhood?: string | null }) {
    const p = new URLSearchParams(params)
    if ('category' in next) {
      if (next.category) p.set('cat', next.category)
      else p.delete('cat')
    }
    if ('neighborhood' in next) {
      if (next.neighborhood) p.set('hood', next.neighborhood)
      else p.delete('hood')
    }
    setParams(p, { replace: true })
  }

  const editing = editingId ? (places.get(editingId) ?? null) : null

  return (
    <div className="mx-auto min-h-[100dvh] w-full max-w-2xl">
      <div className="sticky top-0 z-30 bg-bg">
        <AddBar
          // New places inherit the active filters, so what you add stays
          // where you added it instead of being filtered straight back out.
          onAdd={(raw) => addPlace(raw, { category: category ?? undefined, neighborhood })}
        />
        <FilterChips
          neighborhoods={neighborhoods}
          category={category}
          neighborhood={neighborhood}
          onChange={setFilter}
        />
      </div>

      {stale && (
        <div className="px-4 pt-3">
          <button
            type="button"
            onClick={resort}
            className="min-h-[40px] w-full rounded-xl border border-accent/40 bg-accent/10 px-4 text-sm text-accent"
          >
            Votes changed — re-sort by score
          </button>
        </div>
      )}

      <ul className="space-y-3 px-4 pb-6 pt-3">
        {visible.map((p) => (
          <PlaceCard
            key={p.id}
            place={p}
            votes={votes}
            members={members}
            userId={userId}
            scheduledOn={schedule.get(p.id) ?? []}
            onVote={(v: VoteValue) => void castVote(p.id, v)}
            onOpen={() => setEditingId(p.id)}
          />
        ))}
      </ul>

      {visible.length === 0 && (
        <p className="px-4 pb-6 text-center text-muted">
          {places.size === 0
            ? 'Nothing here yet. Paste a link up top.'
            : 'Nothing matches those filters.'}
        </p>
      )}

      {editing && (
        <EditSheet
          place={editing}
          neighborhoods={neighborhoods}
          days={days}
          scheduledOn={schedule.get(editing.id) ?? []}
          onSave={(patch) => updatePlace(editing.id, patch)}
          onDelete={() => deletePlace(editing.id)}
          onSchedule={(dayId) => void addEvent(dayId, { placeId: editing.id })}
          onOpenDay={(date) => navigate(`/days/${date}`)}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  )
}
