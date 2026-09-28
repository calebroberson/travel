import { decodeLeg, MODE_ICON, MODE_LABEL } from '../../lib/legs'
import { directionsUrl } from '../../lib/directions'
import type { ItineraryItem } from '../../lib/types'

/**
 * The gap between two events: the legs planned for it, a way to plan one,
 * and a Directions hand-off to Google Maps with both ends already filled in.
 */
export default function Connector({
  legs,
  origin,
  destination,
  label,
  onAdd,
  onEdit,
}: {
  legs: ItineraryItem[]
  /** Where the trip to here starts; null means "wherever the phone is". */
  origin: string | null
  /** Where it ends; null when the destination can't be routed to. */
  destination: string | null
  /** Context for the endpoints, e.g. "From the hotel". */
  label?: string
  onAdd: () => void
  onEdit: (legId: string) => void
}) {
  const firstMode = legs.length > 0 ? decodeLeg(legs[0].title).mode : null

  return (
    <li className="flex gap-3 pl-3" aria-label={label ?? 'Travel'}>
      {/* The rail lines up under the events' time column. */}
      <div className="flex w-14 shrink-0 justify-end pr-3">
        <span aria-hidden className="w-0.5 rounded-full bg-line" />
      </div>

      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 py-2">
        {label && <span className="w-full text-xs text-muted">{label}</span>}

        {legs.map((l) => {
          const leg = decodeLeg(l.title)
          return (
            <button
              key={l.id}
              type="button"
              onClick={() => onEdit(l.id)}
              className="flex min-h-[44px] max-w-full items-center gap-2 rounded-xl border border-line bg-surface px-3 text-left text-sm active:bg-raised"
            >
              {leg.mode && <span aria-hidden>{MODE_ICON[leg.mode]}</span>}
              <span className="min-w-0 truncate">
                {[leg.mode && MODE_LABEL[leg.mode], leg.minutes && `${leg.minutes} min`, leg.detail]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </button>
          )
        })}

        <button
          type="button"
          onClick={onAdd}
          className="min-h-[44px] rounded-xl border border-dashed border-line px-3 text-sm text-muted active:bg-raised"
        >
          {legs.length === 0 ? '+ How to get there' : '+ Leg'}
        </button>

        {destination && (
          <a
            href={directionsUrl(origin, destination, firstMode)}
            target="_blank"
            rel="noreferrer noopener"
            className="flex min-h-[44px] items-center rounded-xl px-2 text-sm text-accent active:bg-raised"
          >
            Directions ↗
          </a>
        )}
      </div>
    </li>
  )
}
