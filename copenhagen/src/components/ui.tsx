import { useEffect } from 'react'
import type { ReactNode } from 'react'

/** Bottom sheet: backdrop, Escape to close, safe-area padding, one animation. */
export function Sheet({
  label,
  onClose,
  children,
}: {
  label: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

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
        aria-label={label}
        // dvh so the iOS keyboard does not crop the Save button.
        className="absolute inset-x-0 bottom-0 mx-auto max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border-t border-line bg-surface pb-[calc(env(safe-area-inset-bottom)+1rem)] motion-safe:animate-[sheet_180ms_ease-out]"
      >
        <div className="sticky top-0 z-10 flex items-center border-b border-line bg-surface px-4 py-3">
          <span className="mx-auto h-1 w-10 rounded-full bg-line" aria-hidden />
        </div>
        <div className="space-y-4 px-4 pt-4">{children}</div>
      </div>
    </div>
  )
}

export const inputClass =
  'min-h-[48px] w-full rounded-xl border border-line bg-raised px-3 text-base outline-none focus:border-accent'

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

export function Toggle({
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

/** A selectable pill, used for single-choice rows (kinds, travel modes). */
export function Choice({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        'min-h-[44px] shrink-0 whitespace-nowrap rounded-full border px-4 text-sm transition-colors ' +
        (active
          ? 'border-accent bg-accent font-medium text-bg'
          : 'border-line bg-raised text-muted active:bg-line')
      }
    >
      {children}
    </button>
  )
}

/** Cancel + primary action, the standard sheet footer. */
export function SheetActions({
  onCancel,
  onConfirm,
  busy,
  confirmLabel = 'Save',
}: {
  onCancel: () => void
  onConfirm: () => void
  busy?: boolean
  confirmLabel?: string
}) {
  return (
    <div className="flex gap-3 pt-2">
      <button
        type="button"
        onClick={onCancel}
        className="min-h-[52px] flex-1 rounded-xl border border-line text-muted active:bg-raised"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={busy}
        className="min-h-[52px] flex-[2] rounded-xl bg-accent font-medium text-bg disabled:opacity-60"
      >
        {busy ? 'Saving…' : confirmLabel}
      </button>
    </div>
  )
}

/** Destructive button that asks once: first tap arms it, second tap acts. */
export function ConfirmButton({
  armed,
  onClick,
  disabled,
  label,
  armedLabel,
}: {
  armed: boolean
  onClick: () => void
  disabled?: boolean
  label: string
  armedLabel: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        'min-h-[52px] w-full rounded-xl border text-center disabled:opacity-60 ' +
        (armed
          ? 'border-danger bg-danger font-medium text-bg'
          : 'border-line text-danger active:bg-raised')
      }
    >
      {armed ? armedLabel : label}
    </button>
  )
}

export const blankToNull = (s: string) => (s.trim() === '' ? null : s.trim())
