import type { VoteValue } from '../lib/types'

const OPTIONS: { value: VoteValue; label: string }[] = [
  { value: -1, label: 'no' },
  { value: 0, label: 'meh' },
  { value: 1, label: 'want' },
  { value: 2, label: 'must' },
]

const FILL: Record<VoteValue, string> = {
  [-1]: 'bg-danger/85 text-bg border-danger/85',
  0: 'bg-muted/70 text-bg border-muted/70',
  1: 'bg-accent/85 text-bg border-accent/85',
  2: 'bg-cat-do text-bg border-cat-do',
}

export default function VoteButtons({
  mine,
  onVote,
}: {
  mine: VoteValue | undefined
  onVote: (value: VoteValue) => void
}) {
  return (
    <div className="flex gap-2" role="group" aria-label="Your vote">
      {OPTIONS.map((o) => {
        const active = mine === o.value
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            // The card body opens the edit sheet; a vote must not.
            onClick={(e) => {
              e.stopPropagation()
              onVote(o.value)
            }}
            className={
              'min-h-[44px] flex-1 rounded-lg border text-sm font-medium transition-colors ' +
              (active ? FILL[o.value] : 'border-line bg-raised text-muted active:bg-line')
            }
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
