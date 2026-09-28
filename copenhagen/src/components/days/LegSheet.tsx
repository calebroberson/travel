import { useState } from 'react'
import { MODE_ICON, MODE_LABEL, MODES } from '../../lib/legs'
import type { Leg, TravelMode } from '../../lib/legs'
import { directionsUrl } from '../../lib/directions'
import { Choice, ConfirmButton, Field, inputClass, Sheet, SheetActions } from '../ui'

/** Plan how to get from one stop to the next. */
export default function LegSheet({
  leg,
  heading,
  route,
  onSave,
  onDelete,
  onClose,
}: {
  /** The leg being edited, or null for a new one. */
  leg: Leg | null
  heading: string
  /** Endpoints for the Maps check; null when the destination can't be routed. */
  route: { origin: string | null; destination: string } | null
  onSave: (leg: Leg) => Promise<boolean>
  onDelete: (() => Promise<boolean>) | null
  onClose: () => void
}) {
  const [mode, setMode] = useState<TravelMode>(leg?.mode ?? 'walk')
  const [minutes, setMinutes] = useState(leg?.minutes ? String(leg.minutes) : '')
  const [detail, setDetail] = useState(leg?.detail ?? '')
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function save() {
    const n = Number.parseInt(minutes, 10)
    setBusy(true)
    const ok = await onSave({ mode, minutes: Number.isFinite(n) && n > 0 ? n : null, detail })
    setBusy(false)
    if (ok) onClose()
  }

  async function remove() {
    if (!onDelete) return
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
    <Sheet label={heading} onClose={onClose}>
      <h2 className="break-words text-xl font-semibold leading-snug">{heading}</h2>

      <div className="flex flex-wrap gap-2" role="group" aria-label="How">
        {MODES.map((m) => (
          <Choice key={m} active={mode === m} onClick={() => setMode(m)}>
            <span aria-hidden>{MODE_ICON[m]}</span> {MODE_LABEL[m]}
          </Choice>
        ))}
      </div>

      <div className="grid grid-cols-[7rem_1fr] gap-3">
        <Field label="Minutes">
          <input
            value={minutes}
            onChange={(e) => setMinutes(e.target.value.replace(/\D/g, '').slice(0, 3))}
            inputMode="numeric"
            placeholder="15"
            className={inputClass}
          />
        </Field>
        <Field label="Details">
          <input
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder={mode === 'metro' ? 'M3 from Nørreport' : mode === 'bus' ? '5C toward Husum' : 'Optional'}
            className={inputClass}
          />
        </Field>
      </div>

      {route && (
        <a
          // Follows the selected mode, so "Walk" opens walking directions.
          href={directionsUrl(route.origin, route.destination, mode)}
          target="_blank"
          rel="noreferrer noopener"
          className="flex min-h-[44px] items-center justify-center rounded-xl border border-line text-sm text-accent active:bg-raised"
        >
          Check the route in Google Maps ↗
        </a>
      )}

      <SheetActions onCancel={onClose} onConfirm={save} busy={busy} />

      {onDelete && (
        <ConfirmButton
          armed={confirmDelete}
          onClick={remove}
          disabled={busy}
          label="Delete leg"
          armedLabel="Tap again to delete"
        />
      )}
    </Sheet>
  )
}
