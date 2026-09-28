import { useCallback } from 'react'
import type { MutableRefObject } from 'react'

import { supabase } from '../lib/supabase'
import { planKeys } from '../lib/order'
import {
  buildPlan,
  fileEvent,
  insertEvent,
  insertLeg,
  moveEvent as planMove,
  removalSet,
} from '../lib/segments'
import { encodeLeg } from '../lib/legs'
import type { Leg } from '../lib/legs'
import { hhmm } from '../lib/time'
import type {
  DayPatch,
  ItemKind,
  ItemPatch,
  ItineraryItem,
  Place,
  PlaceCategory,
  PlacePatch,
  TripDay,
} from '../lib/types'

type MapSetter<V> = (fn: (m: Map<string, V>) => Map<string, V>) => void

type Deps = {
  itemsRef: MutableRefObject<Map<string, ItineraryItem>>
  daysRef: MutableRefObject<Map<string, TripDay>>
  placesRef: MutableRefObject<Map<string, Place>>
  setItems: MapSetter<ItineraryItem>
  setDays: MapSetter<TripDay>
  updatePlace: (id: string, patch: PlacePatch) => Promise<boolean>
  setNotice: (text: string) => void
  /** Forced background refetch — the recovery path for multi-row writes. */
  resync: () => void
}

export type NewEvent = {
  placeId?: string
  title?: string
  kind?: Exclude<ItemKind, 'transit'>
  start_time?: string | null
  end_time?: string | null
  note?: string | null
}

/** Default event kind for a place, from its category. */
export function kindFor(category: PlaceCategory): Exclude<ItemKind, 'transit'> {
  return category === 'eat' ? 'meal' : 'activity'
}

/**
 * Every itinerary write, optimistic like the board's.
 *
 * Anything that rearranges a day goes out as ONE request: a multi-row upsert,
 * which PostgREST runs as a single transaction. That matters more than it
 * looks. With a request per row, a failure partway through a move could land
 * an event's new position but not its leg's — silently re-attaching "Metro
 * to Tivoli" to whatever event now follows it. All-or-nothing makes that
 * impossible. On failure the local state is restored by a forced refetch,
 * which rebuilds everything from the server wholesale.
 *
 * Single-row edits that don't move anything stay plain updates and roll back
 * precisely.
 */
export function useItineraryActions({
  itemsRef,
  daysRef,
  placesRef,
  setItems,
  setDays,
  updatePlace,
  setNotice,
  resync,
}: Deps) {
  const dayItems = useCallback(
    (dayId: string) => [...itemsRef.current.values()].filter((i) => i.day_id === dayId),
    [itemsRef],
  )

  /** Apply sort_order changes locally, plus an optional full replacement row. */
  const applyLocal = useCallback(
    (changes: Map<string, number>, upsert?: ItineraryItem) => {
      setItems((m) => {
        const n = new Map(m)
        if (upsert) n.set(upsert.id, upsert)
        for (const [id, k] of changes) {
          const cur = n.get(id)
          if (cur && cur.sort_order !== k) n.set(id, { ...cur, sort_order: k })
        }
        return n
      })
    },
    [setItems],
  )

  /**
   * Write rows atomically, in one upsert. Rows are sent whole because
   * Postgres checks NOT NULL and item_has_subject on the proposed row even
   * when it conflicts and becomes an update — `{id, sort_order}` alone would
   * be rejected. created_at is left out so existing rows keep theirs and new
   * ones take the server default.
   */
  const persist = useCallback(
    async (ids: string[]) => {
      const rows = ids.flatMap((id) => {
        const row = itemsRef.current.get(id)
        if (!row) return []
        const { created_at: _c, ...rest } = row
        return [rest]
      })
      if (rows.length === 0) return null
      const { error } = await supabase.from('itinerary_item').upsert(rows, { onConflict: 'id' })
      return error
    },
    [itemsRef],
  )

  /**
   * Scheduling a place marks it scheduled on the board; removing it from
   * the last day it's on puts it back on the shortlist. Only moves between
   * idea/shortlist/scheduled — never overrides 'done' or 'skipped'.
   */
  const syncStatus = useCallback(
    (placeId: string) => {
      const place = placesRef.current.get(placeId)
      if (!place) return
      const onItinerary = [...itemsRef.current.values()].some((i) => i.place_id === placeId)
      if (onItinerary && (place.status === 'idea' || place.status === 'shortlist')) {
        void updatePlace(placeId, { status: 'scheduled' })
      } else if (!onItinerary && place.status === 'scheduled') {
        void updatePlace(placeId, { status: 'shortlist' })
      }
    },
    [placesRef, itemsRef, updatePlace],
  )

  const addEvent = useCallback(
    async (dayId: string, input: NewEvent) => {
      const place = input.placeId ? placesRef.current.get(input.placeId) : undefined
      const title = place?.name ?? input.title?.trim()
      if (!title) return false

      const existing = dayItems(dayId)
      const item: ItineraryItem = {
        id: crypto.randomUUID(),
        day_id: dayId,
        place_id: place?.id ?? null,
        // Snapshotted even for places: see the note on ItineraryItem.title.
        title,
        kind: input.kind ?? (place ? kindFor(place.category) : 'activity'),
        start_time: input.start_time ?? null,
        end_time: input.end_time ?? null,
        note: input.note ?? null,
        sort_order: 0,
        created_at: new Date().toISOString(),
      }

      const r = insertEvent(buildPlan(existing), item)
      const changes = planKeys(
        r.desired,
        r.moved,
        new Map(existing.map((i) => [i.id, i.sort_order])),
      )
      item.sort_order = changes.get(item.id) ?? item.sort_order

      applyLocal(changes, item)

      // The new row and any renumbering of its neighbours, together.
      const err = await persist([item.id, ...[...changes.keys()].filter((id) => id !== item.id)])
      if (err) {
        setNotice('Could not add that — ' + err.message)
        resync()
        return false
      }
      if (place) syncStatus(place.id)
      return true
    },
    [placesRef, dayItems, applyLocal, persist, setNotice, resync, syncStatus],
  )

  const updateItem = useCallback(
    async (id: string, patch: ItemPatch) => {
      const prev = itemsRef.current.get(id)
      if (!prev) return false

      // A new start time re-files an event chronologically. Legs have no
      // times of their own worth sorting by; they ride with their event.
      let changes = new Map<string, number>()
      const newStart = 'start_time' in patch ? hhmm(patch.start_time) : null
      if (prev.kind !== 'transit' && newStart && newStart !== hhmm(prev.start_time)) {
        const existing = dayItems(prev.day_id)
        const r = fileEvent(buildPlan(existing), id, newStart)
        if (r) {
          changes = planKeys(r.desired, r.moved, new Map(existing.map((i) => [i.id, i.sort_order])))
        }
      }

      const next: ItineraryItem = {
        ...prev,
        ...patch,
        sort_order: changes.get(id) ?? prev.sort_order,
      }
      applyLocal(changes, next)

      if (changes.size === 0) {
        // Nothing moved: a plain update of just the edited fields.
        const { error } = await supabase.from('itinerary_item').update(patch).eq('id', id)
        if (error) {
          setItems((m) => new Map(m).set(id, prev))
          setNotice('Could not save — ' + error.message)
          return false
        }
        return true
      }

      // Re-filed: the edit and the move land together or not at all.
      const err = await persist([id, ...[...changes.keys()].filter((k) => k !== id)])
      if (err) {
        setNotice('Could not save — ' + err.message)
        resync()
        return false
      }
      return true
    },
    [itemsRef, dayItems, applyLocal, persist, setNotice, setItems, resync],
  )

  const moveEvent = useCallback(
    async (id: string, dir: -1 | 1) => {
      const item = itemsRef.current.get(id)
      if (!item) return
      const existing = dayItems(item.day_id)
      const r = planMove(buildPlan(existing), id, dir)
      if (!r) return
      const changes = planKeys(r.desired, r.moved, new Map(existing.map((i) => [i.id, i.sort_order])))
      applyLocal(changes)
      const err = await persist([...changes.keys()])
      if (err) {
        setNotice('Could not reorder — ' + err.message)
        resync()
      }
    },
    [itemsRef, dayItems, applyLocal, persist, setNotice, resync],
  )

  /** Removing an event takes its inbound legs with it; a leg goes alone. */
  const removeItem = useCallback(
    async (id: string) => {
      const item = itemsRef.current.get(id)
      if (!item) return false
      const ids = removalSet(buildPlan(dayItems(item.day_id)), id)
      const removed = ids.flatMap((i) => itemsRef.current.get(i) ?? [])

      setItems((m) => {
        const n = new Map(m)
        for (const i of ids) n.delete(i)
        return n
      })

      const { error } = await supabase.from('itinerary_item').delete().in('id', ids)
      if (error) {
        setItems((m) => {
          const n = new Map(m)
          for (const r of removed) n.set(r.id, r)
          return n
        })
        setNotice('Could not remove — ' + error.message)
        return false
      }
      for (const r of removed) if (r.place_id) syncStatus(r.place_id)
      return true
    },
    [itemsRef, dayItems, setItems, setNotice, syncStatus],
  )

  /**
   * Create or edit a leg. `legId` edits an existing one; otherwise a new leg
   * is added leading to `toEventId`, or trailing the day when that's null.
   */
  const saveLeg = useCallback(
    async (dayId: string, legId: string | null, toEventId: string | null, leg: Leg) => {
      const title = encodeLeg(leg)
      if (legId) return updateItem(legId, { title })

      const existing = dayItems(dayId)
      const item: ItineraryItem = {
        id: crypto.randomUUID(),
        day_id: dayId,
        place_id: null,
        title,
        kind: 'transit',
        start_time: null,
        end_time: null,
        note: null,
        sort_order: 0,
        created_at: new Date().toISOString(),
      }
      const r = insertLeg(buildPlan(existing), item, toEventId)
      const changes = planKeys(r.desired, r.moved, new Map(existing.map((i) => [i.id, i.sort_order])))
      item.sort_order = changes.get(item.id) ?? item.sort_order
      applyLocal(changes, item)

      const err = await persist([item.id, ...[...changes.keys()].filter((id) => id !== item.id)])
      if (err) {
        setNotice('Could not save that leg — ' + err.message)
        resync()
        return false
      }
      return true
    },
    [dayItems, updateItem, applyLocal, persist, setNotice, resync],
  )

  const updateDay = useCallback(
    async (id: string, patch: DayPatch) => {
      const prev = daysRef.current.get(id)
      if (!prev) return false
      setDays((m) => new Map(m).set(id, { ...prev, ...patch }))
      const { error } = await supabase.from('trip_day').update(patch).eq('id', id)
      if (error) {
        setDays((m) => new Map(m).set(id, prev))
        setNotice('Could not save the day — ' + error.message)
        return false
      }
      return true
    },
    [daysRef, setDays, setNotice],
  )

  return { addEvent, updateItem, moveEvent, removeItem, saveLeg, updateDay }
}
