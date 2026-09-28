import { useState } from 'react'
import { titleCase } from '../../lib/labels'
import { hhmm } from '../../lib/time'
import type { SunTimes } from '../../lib/sun'
import { EVENT_KINDS } from '../../lib/types'
import type { ItemKind, ItemPatch, ItineraryItem, Place, PlacePatch } from '../../lib/types'
import { blankToNull, Choice, ConfirmButton, Field, inputClass, Sheet, SheetActions, Toggle } from '../ui'

type EventKind = Exclude<ItemKind, 'transit'>

/** Edit one event: its time, note, and — for places — the booking. */
export default function ItemSheet({
  item,
  place,
  sun,
  hasLegs,
  onSave,
  onSavePlace,
  onRemove,
  onClose,
}: {
  item: ItineraryItem
  place: Place | undefined
  sun: SunTimes | null
  /** Whether removing this event also removes a travel leg into it. */
  hasLegs: boolean
  onSave: (patch: ItemPatch) => Promise<boolean>
  onSavePlace: (patch: PlacePatch) => Promise<boolean>
  onRemove: () => Promise<boolean>
  onClose: () => void
}) {
  // Snapshot of what opened, so Save sends only what actually changed.
  const [initial] = useState(() => ({
    title: item.title ?? '',
    kind: item.kind as EventKind,
    start: hhmm(item.start_time) ?? '',
    end: hhmm(item.end_time) ?? '',
    note: item.note ?? '',
    booked: place?.booked ?? false,
    ref: place?.booking_ref ?? '',
  }))
  const [f, setF] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }))

  const badRange = f.start !== '' && f.end !== '' && f.end <= f.start

  async function save() {
    if (badRange) return
    const patch: ItemPatch = {}
    if (!place && f.title.trim() && f.title.trim() !== initial.title) patch.title = f.title.trim()
    if (!place && f.kind !== initial.kind) patch.kind = f.kind
    if (f.start !== initial.start) patch.start_time = f.start || null
    if (f.end !== initial.end) patch.end_time = f.end || null
    if (f.note !== initial.note) patch.note = blankToNull(f.note)

    const placePatch: PlacePatch = {}
    if (place && f.booked !== initial.booked) placePatch.booked = f.booked
    if (place && f.ref !== initial.ref) placePatch.booking_ref = blankToNull(f.ref)

    setBusy(true)
    const results = await Promise.all([
      Object.keys(patch).length ? onSave(patch) : true,
      Object.keys(placePatch).length ? onSavePlace(placePatch) : true,
    ])
    setBusy(false)
    if (results.every(Boolean)) onClose()
  }

  async function remove() {
    if (!confirmRemove) {
      setConfirmRemove(true)
      return
    }
    setBusy(true)
    const ok = await onRemove()
    setBusy(false)
    if (ok) onClose()
  }

  const name = place?.name ?? item.title ?? 'Untitled'

  return (
    <Sheet label={`Edit ${name}`} onClose={onClose}>
      {place ? (
        <div>
          <h2 className="break-words text-xl font-semibold leading-snug">{place.name}</h2>
          <p className="mt-0.5 text-sm text-muted">
            {titleCase(place.category)}
            {place.neighborhood && ` · ${place.neighborhood}`}
            {place.url && (
              <>
                {' · '}
                <a href={place.url} target="_blank" rel="noreferrer noopener" className="text-accent">
                  Link ↗
                </a>
              </>
            )}
          </p>
        </div>
      ) : (
        <>
          <Field label="What">
            <input value={f.title} onChange={(e) => set('title', e.target.value)} className={inputClass} />
          </Field>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Kind">
            {EVENT_KINDS.map((k) => (
              <Choice key={k} active={f.kind === k} onClick={() => set('kind', k)}>
                {titleCase(k)}
              </Choice>
            ))}
          </div>
        </>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Starts">
          <input type="time" value={f.start} onChange={(e) => set('start', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Ends">
          <input type="time" value={f.end} onChange={(e) => set('end', e.target.value)} className={inputClass} />
        </Field>
      </div>
      {badRange && <p className="-mt-2 text-sm text-danger">Ends before it starts.</p>}
      {!badRange && f.start !== initial.start && f.start && (
        <p className="-mt-2 text-xs text-muted">It will move into time order among the day's other timed stops.</p>
      )}

      {place?.daylight_required && sun && (
        <p className="rounded-xl bg-raised px-3 py-2 text-sm text-muted">
          ☀️ Needs daylight. Light from {sun.sunrise} to {sun.sunset}.
        </p>
      )}

      <Field label="Note">
        <textarea value={f.note} onChange={(e) => set('note', e.target.value)} rows={3} className={inputClass + ' resize-y'} />
      </Field>

      {place?.needs_reservation && (
        <>
          <Toggle label="Booked" checked={f.booked} onChange={(v) => set('booked', v)} />
          {f.booked && (
            <Field label="Confirmation #">
              <input
                value={f.ref}
                onChange={(e) => set('ref', e.target.value)}
                autoCapitalize="characters"
                autoCorrect="off"
                className={inputClass}
              />
            </Field>
          )}
        </>
      )}

      <SheetActions onCancel={onClose} onConfirm={save} busy={busy} />

      <ConfirmButton
        armed={confirmRemove}
        onClick={remove}
        disabled={busy}
        label="Remove from this day"
        armedLabel={hasLegs ? 'Tap again — removes its travel leg too' : 'Tap again to remove'}
      />
    </Sheet>
  )
}
