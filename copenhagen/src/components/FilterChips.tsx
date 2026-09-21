import type { ReactNode } from 'react'
import { CATEGORIES } from '../lib/types'

type Props = {
  neighborhoods: string[]
  category: string | null
  neighborhood: string | null
  onChange: (next: { category?: string | null; neighborhood?: string | null }) => void
}

export default function FilterChips({ neighborhoods, category, neighborhood, onChange }: Props) {
  return (
    <div className="space-y-2 border-b border-line px-4 py-3">
      <Row label="Category">
        <Chip active={category === null} onClick={() => onChange({ category: null })}>
          All
        </Chip>
        {CATEGORIES.map((c) => (
          <Chip key={c} active={category === c} onClick={() => onChange({ category: c })}>
            {c}
          </Chip>
        ))}
      </Row>

      {neighborhoods.length > 0 && (
        <Row label="Neighborhood">
          <Chip active={neighborhood === null} onClick={() => onChange({ neighborhood: null })}>
            All
          </Chip>
          {neighborhoods.map((n) => (
            <Chip key={n} active={neighborhood === n} onClick={() => onChange({ neighborhood: n })}>
              {n}
            </Chip>
          ))}
        </Row>
      )}
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="no-bar -mx-4 flex gap-2 overflow-x-auto px-4" role="group" aria-label={label}>
      {children}
    </div>
  )
}

function Chip({
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
        'min-h-[38px] shrink-0 whitespace-nowrap rounded-full border px-4 text-sm capitalize transition-colors ' +
        (active
          ? 'border-accent bg-accent text-bg font-medium'
          : 'border-line bg-surface text-muted active:bg-raised')
      }
    >
      {children}
    </button>
  )
}
