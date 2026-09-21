import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { CATEGORIES, STATUSES } from '../lib/types'
import type { Place, PlaceCategory, PlacePatch, PlaceStatus } from '../lib/types'

type Props = {
  place: Place
  neighborhoods: string[]
  onSave: (patch: PlacePatch) => Promise<boolean>
  onDelete: () => Promise<boolean>
  onClose: () => void
}

export default function EditSheet({ place, neighborhoods, onSave, onDelete, onClose }: Props) {
  const [form, setForm] = useState(() => toForm(place))
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Reopening on a different card must not show the previous card's draft.
  useEffect(() => {
    setForm(toForm(place))
    setConfirmDelete(false)
  }, [place.id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  async function save() {
    setBusy(true)
    const ok = await onSave({
      name: form.name.trim() || place.name,
      category: form.category,
      neighborhood: blankToNull(form.neighborhood),
      url: blankToNull(form.url),
      note: blankToNull(form.note),
      needs_reservation: form.needs_reservation,
      book_by: blankToNull(form.book_by),
      daylight_required: form.daylight_required,
      status: form.status,
    })
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

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 h-full w-full bg-black/60"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Edit ${place.name}`}
        // dvh so the iOS keyboard does not crop the Save button.
        className="absolute inset-x-0 bottom-0 max-h-[92dvh] translate-y-0 overflow-y-auto rounded-t-2xl border-t border-line bg-surface pb-[calc(env(safe-area-inset-bottom)+1rem)] motion-safe:animate-[sheet_180ms_ease-out]"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface px-4 py-3">
          <span className="mx-auto h-1 w-10 rounded-full bg-line" aria-hidden />
        </div>

        <div className="space-y-4 px-4 pt-4">
          <Field label="Name">
            <input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Category">
            <select
              value={form.category}
              onChange={(e) => set('category', e.target.value as PlaceCategory)}
              className={inputClass}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
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
                  {s}
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
            <Field label="Book by">
              <input
                type="date"
                value={form.book_by}
                onChange={(e) => set('book_by', e.target.value)}
                className={inputClass}
              />
            </Field>
          )}

          <Toggle
            label="Needs daylight"
            hint="Copenhagen in late November: sunset around 15:45."
            checked={form.daylight_required}
            onChange={(v) => set('daylight_required', v)}
          />

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[52px] flex-1 rounded-xl border border-line text-muted active:bg-raised"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="min-h-[52px] flex-[2] rounded-xl bg-accent font-medium text-bg disabled:opacity-60"
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>

          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className={
              'min-h-[52px] w-full rounded-xl border text-center disabled:opacity-60 ' +
              (confirmDelete
                ? 'border-danger bg-danger text-bg font-medium'
                : 'border-line text-danger active:bg-raised')
            }
          >
            {confirmDelete ? 'Tap again to delete' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

type FormState = {
  name: string
  category: PlaceCategory
  neighborhood: string
  url: string
  note: string
  needs_reservation: boolean
  book_by: string
  daylight_required: boolean
  status: PlaceStatus
}

function toForm(p: Place): FormState {
  return {
    name: p.name,
    category: p.category,
    neighborhood: p.neighborhood ?? '',
    url: p.url ?? '',
    note: p.note ?? '',
    needs_reservation: p.needs_reservation,
    book_by: p.book_by ?? '',
    daylight_required: p.daylight_required,
    status: p.status,
  }
}

const blankToNull = (s: string) => (s.trim() === '' ? null : s.trim())

const inputClass =
  'min-h-[48px] w-full rounded-xl border border-line bg-raised px-3 text-base outline-none focus:border-accent'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-muted">{label}</span>
      {children}
    </label>
  )
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-[52px] w-full items-center justify-between gap-4 rounded-xl border border-line bg-raised px-3 text-left"
    >
      <span>
        <span className="block">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
      </span>
      <span
        className={
          'relative h-7 w-12 shrink-0 rounded-full transition-colors ' +
          (checked ? 'bg-accent' : 'bg-line')
        }
      >
        <span
          className={
            'absolute top-1 h-5 w-5 rounded-full bg-ink transition-all ' +
            (checked ? 'left-6' : 'left-1')
          }
        />
      </span>
    </button>
  )
}
