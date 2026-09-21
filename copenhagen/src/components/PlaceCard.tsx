import { bookingDue, shortDate } from '../lib/dates'
import { titleCase } from '../lib/labels'
import { tally } from '../lib/tally'
import type { VoteMap } from '../lib/tally'
import type { Place, PlaceCategory, TripMember, VoteValue } from '../lib/types'
import VoteButtons from './VoteButtons'

const CATEGORY_CLASS: Record<PlaceCategory, string> = {
  eat: 'text-cat-eat',
  drink: 'text-cat-drink',
  see: 'text-cat-see',
  do: 'text-cat-do',
  shop: 'text-cat-shop',
}

/** Ring opacity stands in for how strongly someone feels. */
const VOTE_STYLE: Record<VoteValue, { opacity: number; ring: boolean }> = {
  [-1]: { opacity: 0.25, ring: false },
  0: { opacity: 0.45, ring: false },
  1: { opacity: 0.85, ring: false },
  2: { opacity: 1, ring: true },
}

export default function PlaceCard({
  place,
  votes,
  members,
  userId,
  onVote,
  onOpen,
}: {
  place: Place
  votes: VoteMap
  members: TripMember[]
  userId: string | null
  onVote: (value: VoteValue) => void
  onOpen: () => void
}) {
  const t = tally(
    place.id,
    votes,
    members.map((m) => m.user_id),
  )
  const mine = userId ? (t.byUser[userId] as VoteValue | undefined) : undefined
  const due = bookingDue(place.needs_reservation, place.book_by)

  return (
    <li className="rounded-2xl border border-line bg-surface">
      {/* Body is the tap target for editing. */}
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onOpen()
          }
        }}
        className="w-full cursor-pointer px-4 pb-3 pt-4 text-left active:bg-raised"
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="break-words text-lg font-medium leading-snug">{place.name}</h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
              <span className={CATEGORY_CLASS[place.category]}>{titleCase(place.category)}</span>
              {place.neighborhood && (
                <>
                  <span aria-hidden>·</span>
                  <span>{place.neighborhood}</span>
                </>
              )}
              {place.status !== 'idea' && (
                <>
                  <span aria-hidden>·</span>
                  <span>{titleCase(place.status)}</span>
                </>
              )}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {place.url && (
              <a
                href={place.url}
                target="_blank"
                rel="noreferrer noopener"
                onClick={(e) => e.stopPropagation()}
                aria-label={`Open link for ${place.name}`}
                className="grid h-11 w-11 place-items-center rounded-lg border border-line text-muted active:bg-raised"
              >
                <LinkIcon />
              </a>
            )}
            <div className="flex gap-1.5">
              {members.map((m) => {
                const v = t.byUser[m.user_id] as VoteValue | undefined
                const style = v === undefined ? null : VOTE_STYLE[v]
                return (
                  <span
                    key={m.user_id}
                    title={`${m.display_name}: ${v === undefined ? 'no vote yet' : labelFor(v)}`}
                    className={
                      'grid h-7 w-7 place-items-center rounded-full text-xs font-semibold ' +
                      (style?.ring ? 'ring-2 ring-ink/70' : '')
                    }
                    style={
                      style
                        ? { backgroundColor: m.color, opacity: style.opacity, color: '#0b0f14' }
                        : { border: `1px dashed ${m.color}`, color: m.color }
                    }
                  >
                    {m.display_name.charAt(0).toUpperCase()}
                  </span>
                )
              })}
            </div>
          </div>
        </div>

        {(due || t.score !== 0) && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {due && (
              <span className="rounded-full bg-danger/15 px-2.5 py-1 text-xs font-medium text-danger">
                Book by {place.book_by ? shortDate(place.book_by) : 'soon'}
              </span>
            )}
            {t.score !== 0 && (
              <span className="rounded-full bg-raised px-2.5 py-1 text-xs text-muted">
                {t.score > 0 ? `+${t.score}` : t.score}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="px-4 pb-4">
        <VoteButtons mine={mine} onVote={onVote} />
      </div>
    </li>
  )
}

function labelFor(v: VoteValue) {
  return v === -1 ? 'no' : v === 0 ? 'meh' : v === 1 ? 'want' : 'must'
}

function LinkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  )
}
