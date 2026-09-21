import { useRef, useState } from 'react'
import type { FormEvent } from 'react'

export default function AddBar({ onAdd }: { onAdd: (raw: string) => Promise<boolean> }) {
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const raw = text.trim()
    if (!raw) return

    // Clear first: the insert is optimistic, so the field is ready for the
    // next idea before the round trip finishes. This path has to survive
    // being used one-handed, standing up.
    setText('')
    inputRef.current?.focus()

    const ok = await onAdd(raw)
    if (!ok) setText(raw)
  }

  return (
    <form
      onSubmit={submit}
      className="flex gap-2 border-b border-line bg-bg/95 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur"
    >
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        enterKeyHint="done"
        autoCapitalize="sentences"
        autoCorrect="off"
        placeholder="Paste a link or type a name"
        aria-label="Add a place by link or name"
        className="min-h-[48px] min-w-0 flex-1 rounded-xl border border-line bg-surface px-4 text-base outline-none placeholder:text-muted/60 focus:border-accent"
      />
      <button
        type="submit"
        disabled={!text.trim()}
        className="min-h-[48px] shrink-0 rounded-xl bg-accent px-5 font-medium text-bg disabled:opacity-40"
      >
        Add
      </button>
    </form>
  )
}
