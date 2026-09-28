import { useEffect, useState } from 'react'
import { CATEGORIES, STATUSES } from '../lib/types'
import { titleCase } from '../lib/labels'
import { shortDay } from '../lib/days'
import type { Place, PlaceCategory, PlacePatch, PlaceStatus, TripDay } from '../lib/types'
import { blankToNull, ConfirmButton, Field, inputClass, Sheet, SheetActions, Toggle } from './ui'

type Props = {
  place: Place
  neighborhoods: string[]
  days: TripDay[]
  /** Days this place is already on. */
  scheduledOn: TripDay[]
  onSave: (patch: PlacePatch) => Promise<boolean>
  onDelete: () => Promise<boolean>
  /** Add the place to a day. Acts immediately, like a vote. */
  onSchedule: (dayId: string) => void
  onOpenDay: (date: string) => void
  onClose: () => void
}

export default function EditSheet({
  place,
  neighborhoods,
  days,
  scheduledOn,
  onSave,
  onDelete,
  onSchedule,
  onOpenDay,
  onClose,
}: Props) {
  const [form, setForm] = useState(() => toForm(place))
  // What the form looked like when it opened. Save sends only fields that
  // differ from it, so it can't write stale values over changes made while
  // the sheet was open — the other phone editing the note, or scheduling
  // from this sheet flipping the status to 'scheduled'.
  const [baseline, setBaseline] = useState(() => toForm(place))
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Reopening on a different card must not show the previous card's draft.
  useEffect(() => {
    setForm(toForm(place))
    setBaseline(toForm(place))
    setConfirmDelete(false)
  }, [place.id])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  async function save() {
    const next = toPatch(form, place.name)
    const base = toPatch(baseline, place.name)
    const patch = Object.fromEntries(
      Object.entries(next).filter(([k, v]) => base[k as keyof PlacePatch] !== v),
    ) as PlacePatch

    if (Object.keys(patch).length === 0) {
      onClose()
      return
    }
    setBusy(true)
    const ok = await onSave(patch)
    setBusy(false)
    if (ok) onClose()
  }

  async function remove() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setBusy(true)
    const ok = await onDelete()
    setBusy(false)
    if (ok) onClose()
  }

  const scheduledIds = new Set(scheduledOn.map((d) => d.id))

  return (
    <Sheet label={`Edit ${place.name}`} onClose={onClose}>
      <Field label="Name">
        <input value={form.name} onChange={(e) => set('name', e.target.value)} className={inputClass} />
      </Field>

      {days.length > 0 && (
        <div>
          <span className="mb-1.5 block text-sm text-muted">On the itinerary</span>
          <div className="no-bar -mx-4 flex gap-2 overflow-x-auto px-4">
            {days.map((d) => {
              const on = scheduledIds.has(d.id)
              return (
                <button
                  key={d.id}
                  type="button"
                  // Scheduled days open that day; the rest add to it. Removal
                  // happens in the day view, where you can see what you'd lose.
                  onClick={() => (on ? onOpenDay(d.date) : onSchedule(d.id))}
                  aria-pressed={on}
                  className={
                    'min-h-[44px] shrink-0 whitespace-nowrap rounded-full border px-4 text-sm ' +
                    (on
                      ? 'border-accent bg-accent font-medium text-bg'
                      : 'border-line bg-raised text-muted active:bg-line')
                  }
                >
                  {on ? `${shortDay(d.date)} →` : `+ ${shortDay(d.date)}`}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <Field label="Category">
        <select
          value={form.category}
          onChange={(e) => set('category', e.target.value as PlaceCategory)}
          className={inputClass}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {titleCase(c)}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Neighborhood">
        <input
          value={form.neighborhood}
          onChange={(e) => set('neighborhood', e.target.value)}
          list="neighborhood-options"
          className={inputClass}
        />
        <datalist id="neighborhood-options">
          {neighborhoods.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </Field>

      <Field label="Address" hint="Optional. Makes directions exact instead of a name search.">
        <input
          value={form.address}
          onChange={(e) => set('address', e.target.value)}
          autoCapitalize="words"
          className={inputClass}
        />
      </Field>

      <Field label="Link">
        <input
          value={form.url}
          onChange={(e) => set('url', e.target.value)}
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          className={inputClass}
        />
      </Field>

      <Field label="Note">
        <textarea
          value={form.note}
          onChange={(e) => set('note', e.target.value)}
          rows={3}
          className={inputClass + ' resize-y'}
        />
      </Field>

      <Field label="Status">
        <select
          value={form.status}
          onChange={(e) => set('status', e.target.value as PlaceStatus)}
          className={inputClass}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {titleCase(s)}
            </option>
          ))}
        </select>
      </Field>

      <Toggle
        label="Needs a reservation"
        checked={form.needs_reservation}
        onChange={(v) => set('needs_reservation', v)}
      />

      {form.needs_reservation && (
        <>
          <Toggle label="Booked" checked={form.booked} onChange={(v) => set('booked', v)} />
          {form.booked ? (
            <Field label="Confirmation #">
              <input
                value={form.booking_ref}
                onChange={(e) => set('booking_ref', e.target.value)}
                autoCapitalize="characters"
                autoCorrect="off"
                className={inputClass}
              />
            </Field>
          ) : (
            <Field label="Book by">
              <input
                type="date"
                value={form.book_by}
                onChange={(e) => set('book_by', e.target.value)}
                className={inputClass}
              />
            </Field>
          )}
        </>
      )}

      <Toggle
        label="Needs daylight"
        hint="Late November: sunset from about 15:55 down to 15:45."
        checked={form.daylight_required}
        onChange={(v) => set('daylight_required', v)}
      />

      <SheetActions onCancel={onClose} onConfirm={save} busy={busy} />

      <ConfirmButton
        armed={confirmDelete}
        onClick={remove}
        disabled={busy}
        label="Delete"
        armedLabel={
          scheduledOn.length > 0
            ? 'Tap again — it stays on the itinerary as plain text'
            : 'Tap again to delete'
        }
      />
    </Sheet>
  )
}

type FormState = {
  name: string
  category: PlaceCategory
  neighborhood: string
  address: string
  url: string
  note: string
  needs_reservation: boolean
  book_by: string
  booked: boolean
  booking_ref: string
  daylight_required: boolean
  status: PlaceStatus
}

function toPatch(f: FormState, fallbackName: string): Required<PlacePatch> {
  return {
    name: f.name.trim() || fallbackName,
    category: f.category,
    neighborhood: blankToNull(f.neighborhood),
    address: blankToNull(f.address),
    url: blankToNull(f.url),
    note: blankToNull(f.note),
    needs_reservation: f.needs_reservation,
    book_by: blankToNull(f.book_by),
    booked: f.booked,
    booking_ref: blankToNull(f.booking_ref),
    daylight_required: f.daylight_required,
    status: f.status,
  }
}

function toForm(p: Place): FormState {
  return {
    name: p.name,
    category: p.category,
    neighborhood: p.neighborhood ?? '',
    address: p.address ?? '',
    url: p.url ?? '',
    note: p.note ?? '',
    needs_reservation: p.needs_reservation,
    book_by: p.book_by ?? '',
    booked: p.booked,
    booking_ref: p.booking_ref ?? '',
    daylight_required: p.daylight_required,
    status: p.status,
  }
}
