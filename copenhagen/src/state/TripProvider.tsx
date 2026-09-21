import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'

import { supabase } from '../lib/supabase'
import { computeOrder, voteKey } from '../lib/tally'
import type { VoteMap } from '../lib/tally'
import { parseInput } from '../lib/parseInput'
import type { Place, PlacePatch, PlaceWithVotes, Trip, TripMember, VoteValue } from '../lib/types'

type Status = 'loading' | 'signed-out' | 'not-member' | 'ready' | 'error'

type TripContextValue = {
  status: Status
  error: string | null
  notice: string | null
  dismissNotice: () => void

  userId: string | null
  trip: Trip | null
  members: TripMember[]
  memberIds: string[]

  places: Map<string, Place>
  votes: VoteMap

  /** Display order, frozen against vote changes. See `stale` / `resort`. */
  order: string[]
  stale: boolean
  resort: () => void

  addPlace: (raw: string) => Promise<boolean>
  castVote: (placeId: string, value: VoteValue) => Promise<void>
  updatePlace: (id: string, patch: PlacePatch) => Promise<boolean>
  deletePlace: (id: string) => Promise<boolean>
  signOut: () => Promise<void>
}

const TripContext = createContext<TripContextValue | null>(null)

// eslint-disable-next-line react-refresh/only-export-components
export function useTrip(): TripContextValue {
  const ctx = useContext(TripContext)
  if (!ctx) throw new Error('useTrip must be used inside <TripProvider>')
  return ctx
}

/**
 * Split a place_with_votes row into the two things we actually keep: the
 * base place row, and one entry per vote. The view's score / want_count /
 * must_count are dropped here and never enter state.
 */
function splitRow(row: PlaceWithVotes): { place: Place; votes: [string, VoteValue][] } {
  const { score: _score, want_count: _want, must_count: _must, votes, ...place } = row
  const entries = Object.entries(votes ?? {}).map(
    ([userId, value]) => [voteKey(row.id, userId), Number(value) as VoteValue] as [string, VoteValue],
  )
  return { place, votes: entries }
}

export function TripProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionReady, setSessionReady] = useState(false)
  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [trip, setTrip] = useState<Trip | null>(null)
  const [members, setMembers] = useState<TripMember[]>([])

  // Mirrored in refs so realtime handlers and rollbacks read current values
  // synchronously, without stale closures and without impure state updaters.
  const [places, setPlacesState] = useState<Map<string, Place>>(new Map())
  const [votes, setVotesState] = useState<VoteMap>(new Map())
  const placesRef = useRef(places)
  const votesRef = useRef(votes)

  const setPlaces = useCallback((fn: (m: Map<string, Place>) => Map<string, Place>) => {
    const next = fn(placesRef.current)
    placesRef.current = next
    setPlacesState(next)
  }, [])

  const setVotes = useCallback((fn: (m: VoteMap) => VoteMap) => {
    const next = fn(votesRef.current)
    votesRef.current = next
    setVotesState(next)
  }, [])

  const [order, setOrder] = useState<string[]>([])

  const userId = session?.user.id ?? null
  const memberIds = useMemo(() => members.map((m) => m.user_id), [members])

  // ---------------------------------------------------------------
  // Session
  // ---------------------------------------------------------------
  useEffect(() => {
    const apply = (s: Session | null) => {
      setSession(s)
      setSessionReady(true)
      // Load-bearing: postgres_changes on RLS-protected tables deliver
      // nothing at all without the access token on the realtime socket,
      // which is indistinguishable from "realtime is broken".
      if (s?.access_token) void supabase.realtime.setAuth(s.access_token)
    }

    void supabase.auth.getSession().then(({ data }) => apply(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => apply(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  // ---------------------------------------------------------------
  // Hydration
  // ---------------------------------------------------------------
  useEffect(() => {
    if (!sessionReady) return

    if (!session) {
      setStatus('signed-out')
      setTrip(null)
      setMembers([])
      setPlaces(() => new Map())
      setVotes(() => new Map())
      setOrder([])
      return
    }

    let cancelled = false

    void (async () => {
      setStatus('loading')
      setError(null)

      // Exactly one trip row is visible under the trip_read policy, so this
      // both resolves the trip id and doubles as the membership check: zero
      // rows means no trip_member row exists for this user yet.
      const { data: trips, error: tripErr } = await supabase.from('trip').select('*').limit(1)
      if (cancelled) return
      if (tripErr) {
        setError(tripErr.message)
        setStatus('error')
        return
      }
      if (!trips || trips.length === 0) {
        setStatus('not-member')
        return
      }
      const t = trips[0] as Trip

      const [memberRes, placeRes] = await Promise.all([
        supabase.from('trip_member').select('*').eq('trip_id', t.id),
        supabase.from('place_with_votes').select('*').eq('trip_id', t.id),
      ])
      if (cancelled) return

      if (memberRes.error || placeRes.error) {
        setError((memberRes.error ?? placeRes.error)!.message)
        setStatus('error')
        return
      }

      const nextMembers = (memberRes.data ?? []) as TripMember[]
      const nextPlaces = new Map<string, Place>()
      const nextVotes: VoteMap = new Map()
      for (const row of (placeRes.data ?? []) as PlaceWithVotes[]) {
        const { place, votes: entries } = splitRow(row)
        nextPlaces.set(place.id, place)
        for (const [k, v] of entries) nextVotes.set(k, v)
      }

      setTrip(t)
      setMembers(nextMembers)
      setPlaces(() => nextPlaces)
      setVotes(() => nextVotes)
      setOrder(
        computeOrder(
          nextPlaces,
          nextVotes,
          nextMembers.map((m) => m.user_id),
        ),
      )
      setStatus('ready')
    })()

    return () => {
      cancelled = true
    }
    // Keyed on the user id, not the session object: a token refresh swaps the
    // object roughly hourly and would otherwise refetch the whole board.
  }, [sessionReady, session?.user.id, setPlaces, setVotes])

  // ---------------------------------------------------------------
  // Realtime. Fires on the base tables, never on the view — which is
  // exactly why derived columns are not held in state.
  // ---------------------------------------------------------------
  useEffect(() => {
    if (!trip) return

    const channel = supabase
      .channel(`board:${trip.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'place', filter: `trip_id=eq.${trip.id}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const id = (payload.old as { id?: string }).id
            if (!id) return
            setPlaces((m) => {
              const n = new Map(m)
              n.delete(id)
              return n
            })
            setVotes((m) => {
              const n = new Map(m)
              for (const k of [...n.keys()]) if (k.startsWith(id + '|')) n.delete(k)
              return n
            })
            return
          }
          const row = payload.new as Place
          setPlaces((m) => new Map(m).set(row.id, row))
        },
      )
      .on(
        // vote has no trip_id to filter on; RLS scopes it for us.
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vote' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const o = payload.old as { place_id?: string; user_id?: string }
            if (!o.place_id || !o.user_id) return
            const key = voteKey(o.place_id, o.user_id)
            setVotes((m) => {
              const n = new Map(m)
              n.delete(key)
              return n
            })
            return
          }
          const v = payload.new as { place_id: string; user_id: string; value: VoteValue }
          setVotes((m) => new Map(m).set(voteKey(v.place_id, v.user_id), v.value))
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [trip, setPlaces, setVotes])

  // ---------------------------------------------------------------
  // Order. One reconciliation covers local adds, realtime adds and
  // deletes: anything new goes to the top, anything gone drops out.
  // Vote changes deliberately do not touch it.
  // ---------------------------------------------------------------
  useEffect(() => {
    setOrder((prev) => {
      const present = new Set(places.keys())
      const kept = prev.filter((id) => present.has(id))
      const known = new Set(kept)
      const added = [...places.keys()].filter((id) => !known.has(id))
      if (added.length === 0 && kept.length === prev.length) return prev
      return [...added, ...kept]
    })
  }, [places])

  const sorted = useMemo(() => computeOrder(places, votes, memberIds), [places, votes, memberIds])
  const stale = useMemo(() => sorted.join() !== order.join(), [sorted, order])
  const resort = useCallback(() => setOrder(sorted), [sorted])

  // ---------------------------------------------------------------
  // Mutations. All optimistic, all rolling back on failure, none
  // blocking the tap on a round trip.
  // ---------------------------------------------------------------
  const castVote = useCallback(
    async (placeId: string, value: VoteValue) => {
      if (!userId) return
      const key = voteKey(placeId, userId)
      const prev = votesRef.current.get(key)

      setVotes((m) => new Map(m).set(key, value))

      const { error: err } = await supabase.from('vote').upsert(
        {
          place_id: placeId,
          user_id: userId,
          value,
          // No trigger on this table, so a conflict-update would otherwise
          // leave updated_at showing the first vote's timestamp forever.
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'place_id,user_id' },
      )

      if (err) {
        setVotes((m) => {
          const n = new Map(m)
          if (prev === undefined) n.delete(key)
          else n.set(key, prev)
          return n
        })
        setNotice('Vote did not save — ' + err.message)
      }
    },
    [userId, setVotes],
  )

  const addPlace = useCallback(
    async (raw: string) => {
      if (!trip || !userId) return false
      const parsed = parseInput(raw)
      if (!parsed) return false

      // Client-generated id: the card can appear before the insert lands,
      // and the realtime echo then overwrites the same key rather than
      // arriving as a second, duplicate card.
      const id = crypto.randomUUID()
      const optimistic: Place = {
        id,
        trip_id: trip.id,
        name: parsed.name,
        category: 'see',
        neighborhood: null,
        lat: null,
        lng: null,
        address: null,
        url: parsed.url,
        note: null,
        hours_note: null,
        price_band: null,
        daylight_required: false,
        indoor: false,
        needs_reservation: false,
        book_by: null,
        booked: false,
        booking_ref: null,
        status: 'idea',
        added_by: userId,
        created_at: new Date().toISOString(),
      }

      setPlaces((m) => new Map(m).set(id, optimistic))

      const { error: err } = await supabase.from('place').insert({
        id,
        trip_id: trip.id,
        name: parsed.name,
        url: parsed.url,
        status: 'idea',
        added_by: userId,
      })

      if (err) {
        setPlaces((m) => {
          const n = new Map(m)
          n.delete(id)
          return n
        })
        setNotice('Could not add that — ' + err.message)
        return false
      }
      return true
    },
    [trip, userId, setPlaces],
  )

  const updatePlace = useCallback(
    async (id: string, patch: PlacePatch) => {
      const prev = placesRef.current.get(id)
      if (!prev) return false

      setPlaces((m) => new Map(m).set(id, { ...prev, ...patch }))

      const { error: err } = await supabase.from('place').update(patch).eq('id', id)
      if (err) {
        setPlaces((m) => new Map(m).set(id, prev))
        setNotice('Could not save — ' + err.message)
        return false
      }
      return true
    },
    [setPlaces],
  )

  const deletePlace = useCallback(
    async (id: string) => {
      const prev = placesRef.current.get(id)
      if (!prev) return false

      setPlaces((m) => {
        const n = new Map(m)
        n.delete(id)
        return n
      })

      const { error: err } = await supabase.from('place').delete().eq('id', id)
      if (err) {
        setPlaces((m) => new Map(m).set(id, prev))
        setNotice('Could not delete — ' + err.message)
        return false
      }
      return true
    },
    [setPlaces],
  )

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const dismissNotice = useCallback(() => setNotice(null), [])

  const value: TripContextValue = {
    status,
    error,
    notice,
    dismissNotice,
    userId,
    trip,
    members,
    memberIds,
    places,
    votes,
    order,
    stale,
    resort,
    addPlace,
    castVote,
    updatePlace,
    deletePlace,
    signOut,
  }

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>
}
