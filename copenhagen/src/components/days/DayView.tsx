import { Fragment, useEffect, useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'

import { useTrip } from '../../state/TripProvider'
import { buildPlan } from '../../lib/segments'
import type { EventBlock } from '../../lib/segments'
import { sunTimes } from '../../lib/sun'
import { decodeLeg } from '../../lib/legs'
import { eventLocation, qualify } from '../../lib/directions'
import { defaultDay } from '../../lib/days'
import { hhmm } from '../../lib/time'
import { scheduleByPlace } from '../../lib/schedule'
import DayStrip from './DayStrip'
import DayHeader from './DayHeader'
import EventRow from './EventRow'
import Connector from './Connector'
import ItemSheet from './ItemSheet'
import LegSheet from './LegSheet'
import AddItemSheet from './AddItemSheet'
import DayDetailsSheet from './DayDetailsSheet'

const LAST_DAY_KEY = 'cph_last_day'

type SheetState =
  | { type: 'item'; id: string }
  | { type: 'leg'; legId: string | null; toEventId: string | null }
  | { type: 'add' }
  | { type: 'details' }
  | null

/** /days — back to the day you were last looking at, else today, else day one. */
export function DaysIndex() {
  const { days } = useTrip()
  let last: string | null = null
  try {
    last = sessionStorage.getItem(LAST_DAY_KEY)
  } catch {
    // Private mode or blocked storage: fall through to the default.
  }
  const target = days.find((d) => d.date === last) ?? defaultDay(days)
  if (!target) {
    return <p className="px-4 py-16 text-center text-muted">No trip days yet.</p>
  }
  return <Navigate to={`/days/${target.date}`} replace />
}

export default function DayView() {
  const { date } = useParams()
  const t = useTrip()
  const day = t.days.find((d) => d.date === date)
  const [sheet, setSheet] = useState<SheetState>(null)

  const dayId = day?.id
  const dayItems = useMemo(
    () => [...t.items.values()].filter((i) => i.day_id === dayId),
    [t.items, dayId],
  )
  const plan = useMemo(() => buildPlan(dayItems), [dayItems])
  const sun = useMemo(
    () => (day && t.trip ? sunTimes(day.date, t.trip.tz) : null),
    [day, t.trip],
  )
  const planned = useMemo(
    () => new Set([...t.items.values()].filter((i) => i.kind !== 'transit').map((i) => i.day_id)),
    [t.items],
  )
  const schedule = useMemo(() => scheduleByPlace(t.items, t.days), [t.items, t.days])

  useEffect(() => {
    if (!day) return
    try {
      sessionStorage.setItem(LAST_DAY_KEY, day.date)
    } catch {
      // Remembering the day is a convenience; nothing breaks without it.
    }
  }, [day])

  // Switching days closes whatever was open on the previous one.
  useEffect(() => setSheet(null), [date])

  if (!day) return <Navigate to="/days" replace />

  const placeOf = (placeId: string | null) => (placeId ? t.places.get(placeId) : undefined)
  const nameOf = (b: EventBlock) => placeOf(b.event.place_id)?.name ?? b.event.title ?? 'Untitled'
  const locOf = (b: EventBlock) => eventLocation(b.event, placeOf(b.event.place_id))
  const lodgingLoc = day.lodging ? qualify(day.lodging) : null

  /** Where travel to block i starts: the last routable stop before it, else the hotel. */
  const originFor = (i: number) => {
    for (let j = i - 1; j >= 0; j--) {
      const loc = locOf(plan.blocks[j])
      if (loc) return loc
    }
    return lodgingLoc
  }

  // Flag events that start before a timed event above them. That only
  // happens when someone reorders by hand, and it's worth seeing.
  let latest: string | null = null
  const outOfOrder = plan.blocks.map((b) => {
    const s = hhmm(b.event.start_time)
    const bad = s !== null && latest !== null && s < latest
    if (s !== null && (latest === null || s > latest)) latest = s
    return bad
  })

  const travelMinutes = dayItems
    .filter((i) => i.kind === 'transit')
    .reduce((sum, i) => sum + (decodeLeg(i.title).minutes ?? 0), 0)

  const showTrailing = (plan.blocks.length > 0 && day.lodging !== null) || plan.trailing.length > 0

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="sticky top-0 z-30 bg-bg">
        <DayStrip days={t.days} current={day.date} planned={planned} />
      </div>

      <DayHeader
        day={day}
        sun={sun}
        eventCount={plan.blocks.length}
        travelMinutes={travelMinutes}
        onEdit={() => setSheet({ type: 'details' })}
      />

      {plan.blocks.length > 0 || plan.trailing.length > 0 ? (
        <ol className="px-4 pt-4">
          {plan.blocks.map((b, i) => (
            <Fragment key={b.event.id}>
              {(i > 0 || b.inbound.length > 0 || day.lodging) && (
                <Connector
                  legs={b.inbound}
                  origin={originFor(i)}
                  destination={locOf(b)}
                  label={i === 0 && day.lodging ? `From ${day.lodging}` : undefined}
                  onAdd={() => setSheet({ type: 'leg', legId: null, toEventId: b.event.id })}
                  onEdit={(legId) => setSheet({ type: 'leg', legId, toEventId: b.event.id })}
                />
              )}
              <EventRow
                item={b.event}
                place={placeOf(b.event.place_id)}
                sun={sun}
                outOfOrder={outOfOrder[i]}
                canUp={i > 0}
                canDown={i < plan.blocks.length - 1}
                onOpen={() => setSheet({ type: 'item', id: b.event.id })}
                onMove={(dir) => void t.moveEvent(b.event.id, dir)}
              />
            </Fragment>
          ))}

          {showTrailing && (
            <Connector
              legs={plan.trailing}
              origin={originFor(plan.blocks.length)}
              destination={lodgingLoc}
              label={day.lodging ? `Back to ${day.lodging}` : 'After the last stop'}
              onAdd={() => setSheet({ type: 'leg', legId: null, toEventId: null })}
              onEdit={(legId) => setSheet({ type: 'leg', legId, toEventId: null })}
            />
          )}
        </ol>
      ) : (
        <p className="px-4 pt-8 text-center text-muted">Nothing planned yet.</p>
      )}

      <div className="px-4 pb-6 pt-4">
        <button
          type="button"
          onClick={() => setSheet({ type: 'add' })}
          className="min-h-[52px] w-full rounded-xl border border-dashed border-line text-muted active:bg-raised"
        >
          + Add to this day
        </button>
      </div>

      {sheet?.type === 'item' &&
        (() => {
          const item = t.items.get(sheet.id)
          if (!item) return null
          const place = placeOf(item.place_id)
          const block = plan.blocks.find((b) => b.event.id === item.id)
          return (
            <ItemSheet
              key={item.id}
              item={item}
              place={place}
              sun={sun}
              hasLegs={(block?.inbound.length ?? 0) > 0}
              onSave={(patch) => t.updateItem(item.id, patch)}
              onSavePlace={(patch) => (place ? t.updatePlace(place.id, patch) : Promise.resolve(true))}
              onRemove={() => t.removeItem(item.id)}
              onClose={() => setSheet(null)}
            />
          )
        })()}

      {sheet?.type === 'leg' &&
        (() => {
          const legItem = sheet.legId ? t.items.get(sheet.legId) : null
          if (sheet.legId && !legItem) return null
          const i = sheet.toEventId
            ? plan.blocks.findIndex((b) => b.event.id === sheet.toEventId)
            : plan.blocks.length
          if (i < 0) return null
          const toBlock = sheet.toEventId ? plan.blocks[i] : null
          const destination = toBlock ? locOf(toBlock) : lodgingLoc
          const heading = toBlock
            ? `Getting to ${nameOf(toBlock)}`
            : day.lodging
              ? `Back to ${day.lodging}`
              : 'After the last stop'
          const legId = sheet.legId
          return (
            <LegSheet
              key={legId ?? `new-${sheet.toEventId}`}
              leg={legItem ? decodeLeg(legItem.title) : null}
              heading={heading}
              route={destination ? { origin: originFor(i), destination } : null}
              onSave={(leg) => t.saveLeg(day.id, legId, sheet.toEventId, leg)}
              onDelete={legId ? () => t.removeItem(legId) : null}
              onClose={() => setSheet(null)}
            />
          )
        })()}

      {sheet?.type === 'add' && (
        <AddItemSheet
          day={day}
          places={t.places}
          votes={t.votes}
          memberIds={t.memberIds}
          schedule={schedule}
          onAddPlace={(placeId) => void t.addEvent(day.id, { placeId })}
          onAddCustom={(title, kind) => void t.addEvent(day.id, { title, kind })}
          onClose={() => setSheet(null)}
        />
      )}

      {sheet?.type === 'details' && (
        <DayDetailsSheet
          key={day.id}
          day={day}
          onSave={(patch) => t.updateDay(day.id, patch)}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  )
}
