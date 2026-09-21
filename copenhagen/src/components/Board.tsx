import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'

import { useTrip } from '../state/TripProvider'
import type { PlaceCategory, VoteValue } from '../lib/types'
import { CATEGORIES } from '../lib/types'
import AddBar from './AddBar'
import FilterChips from './FilterChips'
import PlaceCard from './PlaceCard'
import EditSheet from './EditSheet'
import Gate from './Gate'

export default function Board() {
  const {
    status,
    error,
    notice,
    dismissNotice,
    userId,
    members,
    places,
    votes,
    order,
    stale,
    resort,
    addPlace,
    castVote,
    updatePlace,
    deletePlace,
    signOut,
  } = useTrip()

  const [params, setParams] = useSearchParams()
  const [editingId, setEditingId] = useState<string | null>(null)

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

  if (status === 'loading') return <Centered>Loading…</Centered>
  if (status === 'signed-out') return <Gate />
  if (status === 'not-member') {
    return (
      <Centered>
        <p className="text-lg">You are not on this trip yet.</p>
        <button
          type="button"
          onClick={signOut}
          className="mt-6 min-h-[44px] rounded-xl border border-line px-5 text-muted active:bg-raised"
        >
          Sign out
        </button>
      </Centered>
    )
  }
  if (status === 'error') {
    return (
      <Centered>
        <p className="text-lg text-danger">Could not load the board.</p>
        <p className="mt-2 text-sm text-muted">{error}</p>
      </Centered>
    )
  }

  const editing = editingId ? (places.get(editingId) ?? null) : null

  return (
    <div className="mx-auto min-h-[100dvh] w-full max-w-2xl">
      <div className="sticky top-0 z-30 bg-bg">
        <AddBar onAdd={addPlace} />
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

      <ul className="space-y-3 px-4 pb-24 pt-3">
        {visible.map((p) => (
          <PlaceCard
            key={p.id}
            place={p}
            votes={votes}
            members={members}
            userId={userId}
            onVote={(v: VoteValue) => void castVote(p.id, v)}
            onOpen={() => setEditingId(p.id)}
          />
        ))}
      </ul>

      {visible.length === 0 && (
        <p className="px-4 pb-24 text-center text-muted">
          {places.size === 0
            ? 'Nothing here yet. Paste a link up top.'
            : 'Nothing matches those filters.'}
        </p>
      )}

      {editing && (
        <EditSheet
          place={editing}
          neighborhoods={neighborhoods}
          onSave={(patch) => updatePlace(editing.id, patch)}
          onDelete={() => deletePlace(editing.id)}
          onClose={() => setEditingId(null)}
        />
      )}

      {notice && (
        <button
          type="button"
          onClick={dismissNotice}
          className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-40 rounded-xl border border-danger/40 bg-danger/15 px-4 py-3 text-left text-sm text-danger"
        >
          {notice}
        </button>
      )}
    </div>
  )
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col items-center justify-center px-6 text-center">
      {children}
    </main>
  )
}
