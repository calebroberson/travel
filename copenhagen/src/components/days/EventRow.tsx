import type { ReactNode } from 'react'
import { titleCase } from '../../lib/labels'
import { shortDate } from '../../lib/dates'
import { daylightFlag } from '../../lib/sun'
import type { SunTimes } from '../../lib/sun'
import { hhmm } from '../../lib/time'
import type { ItineraryItem, Place } from '../../lib/types'

export default function EventRow({
  item,
  place,
  sun,
  outOfOrder,
  canUp,
  canDown,
  onOpen,
  onMove,
}: {
  item: ItineraryItem
  place: Place | undefined
  sun: SunTimes | null
  /** Starts earlier than a timed event above it — the user moved it by hand. */
  outOfOrder: boolean
  canUp: boolean
  canDown: boolean
  onOpen: () => void
  onMove: (dir: -1 | 1) => void
}) {
  const start = hhmm(item.start_time)
  const end = hhmm(item.end_time)
  // A deleted place leaves its title snapshot behind; show that.
  const name = place?.name ?? item.title ?? 'Untitled'
  const kindLabel = place ? titleCase(place.category) : titleCase(item.kind)
  const where = place?.neighborhood

  const daylight = place?.daylight_required && sun ? daylightFlag(start, end, sun) : null
  const unbooked = place?.needs_reservation && !place.booked
  const booked = place?.needs_reservation && place.booked

  return (
    <li className="flex rounded-2xl border border-line bg-surface">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 gap-3 rounded-l-2xl px-3 py-3 text-left active:bg-raised"
      >
        <div className="w-14 shrink-0 text-right tabular-nums">
          <div
            className={'text-base font-medium ' + (outOfOrder ? 'text-warn' : start ? 'text-ink' : 'text-muted')}
            title={outOfOrder ? 'Earlier than the event above it' : undefined}
          >
            {start ?? '—'}
          </div>
          {end && <div className="text-xs text-muted">{end}</div>}
        </div>

        <div className="min-w-0 flex-1">
          <div className="break-words text-lg font-medium leading-snug">{name}</div>
          <div className="mt-0.5 text-sm text-muted">
            {kindLabel}
            {where && ` · ${where}`}
          </div>

          {(daylight || unbooked || booked || outOfOrder) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {outOfOrder && <Flag tone="warn">Out of time order</Flag>}
              {daylight && <Flag tone={daylight.level}>{daylight.text}</Flag>}
              {unbooked && (
                <Flag tone="warn">
                  Not booked{place?.book_by ? ` · book by ${shortDate(place.book_by)}` : ''}
                </Flag>
              )}
              {booked && (
                <Flag tone="ok">Booked{place?.booking_ref ? ` · ${place.booking_ref}` : ''}</Flag>
              )}
            </div>
          )}

          {item.note && <p className="mt-2 line-clamp-2 text-sm text-muted">{item.note}</p>}
        </div>
      </button>

      <div className="flex shrink-0 flex-col border-l border-line">
        <MoveButton label={`Move ${name} earlier`} disabled={!canUp} onClick={() => onMove(-1)}>
          ↑
        </MoveButton>
        <MoveButton label={`Move ${name} later`} disabled={!canDown} onClick={() => onMove(1)}>
          ↓
        </MoveButton>
      </div>
    </li>
  )
}

function MoveButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex min-h-[44px] w-12 flex-1 items-center justify-center text-lg text-muted active:bg-raised disabled:opacity-25"
    >
      {children}
    </button>
  )
}

function Flag({ tone, children }: { tone: 'warn' | 'info' | 'ok'; children: ReactNode }) {
  const cls =
    tone === 'warn'
      ? 'bg-warn/15 text-warn'
      : tone === 'ok'
        ? 'bg-cat-do/15 text-cat-do'
        : 'bg-raised text-muted'
  return <span className={'rounded-full px-2.5 py-1 text-xs font-medium ' + cls}>{children}</span>
}
