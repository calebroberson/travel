import { useEffect, useRef } from 'react'
import { NavLink } from 'react-router-dom'
import { shortDay } from '../../lib/days'
import type { TripDay } from '../../lib/types'

/** Horizontal date picker. One tap switches days; no drill-down. */
export default function DayStrip({
  days,
  current,
  planned,
}: {
  days: TripDay[]
  current: string
  /** Day ids that have at least one event, for the dot under the date. */
  planned: Set<string>
}) {
  const activeRef = useRef<HTMLAnchorElement>(null)

  // Keep the selected day in view when arriving from a deep link.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [current])

  return (
    <nav
      aria-label="Trip days"
      className="no-bar flex gap-2 overflow-x-auto border-b border-line px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]"
    >
      {days.map((d) => {
        const [weekday, dayNum] = shortDay(d.date).split(' ')
        const active = d.date === current
        return (
          <NavLink
            key={d.id}
            ref={active ? activeRef : undefined}
            to={`/days/${d.date}`}
            replace
            aria-current={active ? 'date' : undefined}
            className={
              'flex min-h-[64px] min-w-[56px] shrink-0 flex-col items-center justify-center rounded-xl border ' +
              (active
                ? 'border-accent bg-accent text-bg'
                : 'border-line bg-surface text-ink active:bg-raised')
            }
          >
            <span className={'text-xs ' + (active ? 'text-bg/80' : 'text-muted')}>{weekday}</span>
            <span className="text-lg font-semibold leading-tight">{dayNum}</span>
            <span
              aria-hidden
              className={
                'mt-0.5 h-1 w-1 rounded-full ' +
                (planned.has(d.id) ? (active ? 'bg-bg' : 'bg-accent') : 'bg-transparent')
              }
            />
          </NavLink>
        )
      })}
    </nav>
  )
}
