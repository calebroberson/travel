import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. ' +
      'Copy .env.example to .env and fill both in, then restart the dev server.',
  )
}

// Defaults are what we want: the session persists in localStorage and
// detectSessionInUrl consumes the magic-link hash on return.
export const supabase = createClient(url, anonKey)
