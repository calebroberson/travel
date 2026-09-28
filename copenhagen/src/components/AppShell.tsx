import type { ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useTrip } from '../state/TripProvider'
import Gate from './Gate'

/**
 * Everything both tabs share: the auth and membership gates, the tab bar,
 * and the error notice. Screens render into the outlet only once the trip
 * has fully loaded, so they never have to handle a half-hydrated store.
 */
export default function AppShell() {
  const { status, error, notice, dismissNotice, signOut } = useTrip()

  if (status === 'loading') return <Centered>Loading…</Centered>
  if (status === 'signed-out') return <Gate />
  if (status === 'not-member') {
    return (
      <Centered>
        <p className="text-lg">You are not on this trip yet.</p>
        <button
          type="button"
          onClick={signOut}
          className="mt-6 min-h-[44px] rounded-xl border border-line px-5 text-muted active:bg-raised"
        >
          Sign out
        </button>
      </Centered>
    )
  }
  if (status === 'error') {
    return (
      <Centered>
        <p className="text-lg text-danger">Could not load the trip.</p>
        <p className="mt-2 text-sm text-muted">{error}</p>
      </Centered>
    )
  }

  return (
    <>
      {/* Clears the fixed tab bar, including the iPhone home indicator. */}
      <div className="pb-[calc(env(safe-area-inset-bottom)+4.5rem)]">
        <Outlet />
      </div>

      <nav
        aria-label="Sections"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      >
        <div className="mx-auto flex w-full max-w-2xl">
          <Tab to="/" end label="Ideas" icon={<BulbIcon />} />
          <Tab to="/days" label="Days" icon={<CalendarIcon />} />
        </div>
      </nav>

      {notice && (
        <button
          type="button"
          onClick={dismissNotice}
          className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-40 mx-auto max-w-2xl rounded-xl border border-danger/40 bg-[#2a1416] px-4 py-3 text-left text-sm text-danger"
        >
          {notice}
        </button>
      )}
    </>
  )
}

function Tab({ to, end, label, icon }: { to: string; end?: boolean; label: string; icon: ReactNode }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        'flex min-h-[60px] flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium ' +
        (isActive ? 'text-accent' : 'text-muted active:text-ink')
      }
    >
      {icon}
      {label}
    </NavLink>
  )
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col items-center justify-center px-6 text-center">
      {children}
    </main>
  )
}

const iconProps = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

function BulbIcon() {
  return (
    <svg {...iconProps}>
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V17h6v-.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  )
}
