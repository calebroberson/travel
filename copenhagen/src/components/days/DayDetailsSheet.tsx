import { useState } from 'react'
import { longDay } from '../../lib/days'
import type { DayPatch, TripDay } from '../../lib/types'
import { blankToNull, Field, inputClass, Sheet, SheetActions } from '../ui'

export default function DayDetailsSheet({
  day,
  onSave,
  onClose,
}: {
  day: TripDay
  onSave: (patch: DayPatch) => Promise<boolean>
  onClose: () => void
}) {
  const [initial] = useState(() => ({
    title: day.title ?? '',
    lodging: day.lodging ?? '',
    focus: day.neighborhood_focus ?? '',
    rain: day.rain_plan ?? '',
  }))
  const [f, setF] = useState(initial)
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof typeof f>(k: K, v: string) => setF((x) => ({ ...x, [k]: v }))

  async function save() {
    // Only what changed, so an edit on the other phone isn't overwritten.
    const patch: DayPatch = {}
    if (f.title !== initial.title) patch.title = blankToNull(f.title)
    if (f.lodging !== initial.lodging) patch.lodging = blankToNull(f.lodging)
    if (f.focus !== initial.focus) patch.neighborhood_focus = blankToNull(f.focus)
    if (f.rain !== initial.rain) patch.rain_plan = blankToNull(f.rain)
    if (Object.keys(patch).length === 0) return onClose()

    setBusy(true)
    const ok = await onSave(patch)
    setBusy(false)
    if (ok) onClose()
  }

  return (
    <Sheet label={`Edit ${longDay(day.date)}`} onClose={onClose}>
      <h2 className="text-xl font-semibold">{longDay(day.date)}</h2>

      <Field label="Title">
        <input
          value={f.title}
          onChange={(e) => set('title', e.target.value)}
          placeholder="Arrival day, Malmö trip…"
          className={inputClass}
        />
      </Field>
      <Field label="Staying at" hint="Used as the start and end point for the day's directions.">
        <input value={f.lodging} onChange={(e) => set('lodging', e.target.value)} className={inputClass} />
      </Field>
      <Field label="Neighborhood focus">
        <input value={f.focus} onChange={(e) => set('focus', e.target.value)} className={inputClass} />
      </Field>
      <Field label="Rain plan">
        <textarea
          value={f.rain}
          onChange={(e) => set('rain', e.target.value)}
          rows={3}
          className={inputClass + ' resize-y'}
        />
      </Field>

      <SheetActions onCancel={onClose} onConfirm={save} busy={busy} />
    </Sheet>
  )
}
