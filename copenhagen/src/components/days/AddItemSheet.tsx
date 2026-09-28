import { useMemo, useState } from 'react'
import { shortDay } from '../../lib/days'
import { titleCase } from '../../lib/labels'
import { tally } from '../../lib/tally'
import type { VoteMap } from '../../lib/tally'
import { EVENT_KINDS } from '../../lib/types'
import type { ItemKind, Place, TripDay } from '../../lib/types'
import { inputClass, Sheet } from '../ui'

type EventKind = Exclude<ItemKind, 'transit'>

const ADD_AS: Record<EventKind, string> = {
  activity: 'An activity',
  meal: 'A meal',
  logistics: 'Logistics',
}

/**
 * One field, like the board's add bar: type to filter your ideas, or add
 * what you typed as a custom stop. Stays open so a day can be filled in
 * one go.
 */
export default function AddItemSheet({
  day,
  places,
  votes,
  memberIds,
  schedule,
  onAddPlace,
  onAddCustom,
  onClose,
}: {
  day: TripDay
  places: Map<string, Place>
  votes: VoteMap
  memberIds: string[]
  schedule: Map<string, TripDay[]>
  onAddPlace: (placeId: string) => void
  onAddCustom: (title: string, kind: EventKind) => void
  onClose: () => void
}) {
  const [text, setText] = useState('')
  const query = text.trim().toLowerCase()

  // Shortlist first, then by how much you both want it. Skipped and done
  // places aren't candidates for a new day.
  const candidates = useMemo(() => {
    return [...places.values()]
      .filter((p) => p.status !== 'skipped' && p.status !== 'done')
      .map((p) => ({ p, score: tally(p.id, votes, memberIds).score }))
      .sort(
        (a, b) =>
          Number(b.p.status === 'shortlist') - Number(a.p.status === 'shortlist') ||
          b.score - a.score ||
          a.p.name.localeCompare(b.p.name),
      )
  }, [places, votes, memberIds])

  const shown = query
    ? candidates.filter(
        ({ p }) =>
          p.name.toLowerCase().includes(query) ||
          (p.neighborhood ?? '').toLowerCase().includes(query),
      )
    : candidates

  function addCustom(kind: EventKind) {
    const title = text.trim()
    if (!title) return
    onAddCustom(title, kind)
    setText('')
  }

  return (
    <Sheet label={`Add to ${shortDay(day.date)}`} onClose={onClose}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Add to {shortDay(day.date)}</h2>
        <button
          type="button"
          onClick={onClose}
          className="min-h-[44px] rounded-xl bg-accent px-5 font-medium text-bg"
        >
          Done
        </button>
      </div>

      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        enterKeyHint="search"
        placeholder="Search your ideas, or type something new"
        aria-label="Search ideas or name a custom stop"
        className={inputClass}
      />

      {query && (
        <div className="rounded-xl border border-dashed border-line p-3">
          <p className="mb-2 text-sm">
            Add <span className="font-medium">“{text.trim()}”</span> as
          </p>
          <div className="flex flex-wrap gap-2">
            {EVENT_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => addCustom(k)}
                className="min-h-[44px] rounded-full border border-line bg-raised px-4 text-sm active:bg-line"
              >
                {ADD_AS[k]}
              </button>
            ))}
          </div>
        </div>
      )}

      <ul className="-mx-4 divide-y divide-line border-y border-line">
        {shown.map(({ p, score }) => {
          const on = schedule.get(p.id) ?? []
          const here = on.some((d) => d.id === day.id)
          const elsewhere = on.filter((d) => d.id !== day.id)
          return (
            <li key={p.id} className="flex items-center gap-3 px-4 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{p.name}</div>
                <div className="truncate text-sm text-muted">
                  {titleCase(p.category)}
                  {p.neighborhood && ` · ${p.neighborhood}`}
                  {score !== 0 && ` · ${score > 0 ? '+' : ''}${score}`}
                  {p.status === 'shortlist' && ' · Shortlist'}
                  {elsewhere.length > 0 && ` · on ${elsewhere.map((d) => shortDay(d.date)).join(', ')}`}
                </div>
              </div>
              <button
                type="button"
                disabled={here}
                onClick={() => onAddPlace(p.id)}
                aria-label={here ? `${p.name} is on this day` : `Add ${p.name}`}
                className={
                  'min-h-[44px] min-w-[72px] shrink-0 rounded-xl border text-sm ' +
                  (here
                    ? 'border-transparent text-cat-do'
                    : 'border-line bg-raised font-medium active:bg-line')
                }
              >
                {here ? 'Added ✓' : 'Add'}
              </button>
            </li>
          )
        })}
        {shown.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-muted">
            {candidates.length === 0 ? 'No ideas on the board yet.' : 'No ideas match — add it as a custom stop above.'}
          </li>
        )}
      </ul>
    </Sheet>
  )
}
