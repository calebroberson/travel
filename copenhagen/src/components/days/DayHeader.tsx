import { longDay } from '../../lib/days'
import { formatDuration } from '../../lib/time'
import type { SunTimes } from '../../lib/sun'
import type { TripDay } from '../../lib/types'

export default function DayHeader({
  day,
  sun,
  eventCount,
  travelMinutes,
  onEdit,
}: {
  day: TripDay
  sun: SunTimes | null
  eventCount: number
  /** Sum of the minutes on this day's planned legs. */
  travelMinutes: number
  onEdit: () => void
}) {
  const date = longDay(day.date)

  return (
    <header className="space-y-3 px-4 pt-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {day.title ? (
            <>
              <p className="text-sm text-muted">{date}</p>
              <h1 className="break-words text-2xl font-semibold leading-tight">{day.title}</h1>
            </>
          ) : (
            <h1 className="text-2xl font-semibold leading-tight">{date}</h1>
          )}
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="min-h-[44px] shrink-0 rounded-xl border border-line px-4 text-sm text-muted active:bg-raised"
        >
          Edit day
        </button>
      </div>

      <ul className="space-y-1.5 text-sm">
        {sun && (
          <li className="flex gap-2">
            <span aria-hidden>☀️</span>
            <span>
              {sun.sunrise}–{sun.sunset}
              <span className="text-muted"> · {formatDuration(sun.daylightMinutes)} of light</span>
            </span>
          </li>
        )}
        {day.lodging && (
          <li className="flex gap-2">
            <span aria-hidden>🛏️</span>
            <span className="min-w-0 break-words">{day.lodging}</span>
          </li>
        )}
        {day.neighborhood_focus && (
          <li className="flex gap-2">
            <span aria-hidden>📍</span>
            <span className="min-w-0 break-words">{day.neighborhood_focus}</span>
          </li>
        )}
        {eventCount > 0 && (
          <li className="flex gap-2 text-muted">
            <span aria-hidden>🗓️</span>
            <span>
              {eventCount} {eventCount === 1 ? 'stop' : 'stops'}
              {travelMinutes > 0 && ` · ${formatDuration(travelMinutes)} planned travel`}
            </span>
          </li>
        )}
      </ul>

      {day.rain_plan && (
        <details className="rounded-xl border border-line bg-surface px-3 py-2 text-sm">
          <summary className="min-h-[32px] cursor-pointer py-1 text-muted">☔ Rain plan</summary>
          <p className="whitespace-pre-wrap pb-1 pt-1">{day.rain_plan}</p>
        </details>
      )}
    </header>
  )
}
