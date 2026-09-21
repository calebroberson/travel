import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { supabase } from '../lib/supabase'

type Phase = 'idle' | 'sending' | 'sent' | 'error'

export default function Gate() {
  const [email, setEmail] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [message, setMessage] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const address = email.trim()
    if (!address) return

    setPhase('sending')
    const { error } = await supabase.auth.signInWithOtp({
      email: address,
      // Must be on the Supabase redirect allowlist, or the link bounces.
      options: { emailRedirectTo: window.location.origin },
    })

    if (error) {
      setPhase('error')
      setMessage(error.message)
      return
    }
    setPhase('sent')
  }

  if (phase === 'sent') {
    return (
      <Shell>
        <h1 className="text-2xl font-semibold">Check your email</h1>
        <p className="mt-3 text-muted">
          A sign-in link is on its way to <span className="text-ink">{email.trim()}</span>. Open it
          on this device.
        </p>
        <button
          type="button"
          onClick={() => setPhase('idle')}
          className="mt-8 min-h-[44px] w-full rounded-xl border border-line px-4 text-muted active:bg-raised"
        >
          Use a different email
        </button>
      </Shell>
    )
  }

  return (
    <Shell>
      <h1 className="text-3xl font-semibold tracking-tight">København</h1>
      <p className="mt-2 text-muted">Sign in to open the board.</p>

      <form onSubmit={onSubmit} className="mt-8">
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="off"
          autoCorrect="off"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          aria-label="Email address"
          className="min-h-[52px] w-full rounded-xl border border-line bg-surface px-4 text-lg outline-none placeholder:text-muted/60 focus:border-accent"
        />
        <button
          type="submit"
          disabled={phase === 'sending'}
          className="mt-3 min-h-[52px] w-full rounded-xl bg-accent px-4 text-lg font-medium text-bg disabled:opacity-60"
        >
          {phase === 'sending' ? 'Sending…' : 'Send me a link'}
        </button>
      </form>

      {phase === 'error' && <p className="mt-4 text-danger">{message}</p>}
    </Shell>
  )
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-center px-6 py-10">
      {children}
    </main>
  )
}
