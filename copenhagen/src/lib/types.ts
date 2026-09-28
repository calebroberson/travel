// Mirrors schema.sql. The schema is fixed for this app; treat it as read-only.

export type PlaceCategory = 'eat' | 'drink' | 'see' | 'do' | 'shop'
export type PlaceStatus = 'idea' | 'shortlist' | 'scheduled' | 'done' | 'skipped'
export type VoteValue = -1 | 0 | 1 | 2

export const CATEGORIES: PlaceCategory[] = ['eat', 'drink', 'see', 'do', 'shop']
export const STATUSES: PlaceStatus[] = ['idea', 'shortlist', 'scheduled', 'done', 'skipped']

export type Trip = {
  id: string
  name: string
  start_date: string
  end_date: string
  tz: string
  created_at: string
}

export type TripMember = {
  trip_id: string
  user_id: string
  display_name: string
  color: string
}

export type Place = {
  id: string
  trip_id: string
  name: string
  category: PlaceCategory
  neighborhood: string | null
  lat: number | null
  lng: number | null
  address: string | null
  url: string | null
  note: string | null
  hours_note: string | null
  price_band: number | null
  daylight_required: boolean
  indoor: boolean
  needs_reservation: boolean
  book_by: string | null
  booked: boolean
  booking_ref: string | null
  status: PlaceStatus
  added_by: string | null
  created_at: string
}

/**
 * Row shape of the place_with_votes view: a Place plus aggregates.
 * The aggregates are consumed once, at hydration, and then dropped —
 * see TripProvider for why they are never held in state.
 */
export type PlaceWithVotes = Place & {
  score: number
  want_count: number
  must_count: number
  votes: Record<string, number> | null
}

/** The subset of Place the edit sheets can write. */
export type PlacePatch = Partial<
  Pick<
    Place,
    | 'name'
    | 'category'
    | 'neighborhood'
    | 'address'
    | 'url'
    | 'note'
    | 'needs_reservation'
    | 'book_by'
    | 'booked'
    | 'booking_ref'
    | 'daylight_required'
    | 'status'
  >
>

// ------------------------------------------------------------------
// Itinerary
// ------------------------------------------------------------------

/** 'transit' items are the legs between events; the other three are events. */
export type ItemKind = 'activity' | 'meal' | 'transit' | 'logistics'
export const EVENT_KINDS: Exclude<ItemKind, 'transit'>[] = ['activity', 'meal', 'logistics']

export type TripDay = {
  id: string
  trip_id: string
  date: string
  title: string | null
  lodging: string | null
  neighborhood_focus: string | null
  rain_plan: string | null
}

export type DayPatch = Partial<
  Pick<TripDay, 'title' | 'lodging' | 'neighborhood_focus' | 'rain_plan'>
>

export type ItineraryItem = {
  id: string
  day_id: string
  place_id: string | null
  /**
   * Always set, even for place-linked items, where it snapshots the place
   * name. The schema requires place_id or title, and place_id is ON DELETE
   * SET NULL — so without the snapshot, deleting a scheduled place would
   * null the link, violate item_has_subject, and fail the whole delete.
   */
  title: string | null
  kind: ItemKind
  /** Postgres `time` — arrives as 'HH:MM:SS'. Normalise with hhmm(). */
  start_time: string | null
  end_time: string | null
  note: string | null
  sort_order: number
  created_at: string
}

export type ItemPatch = Partial<
  Pick<ItineraryItem, 'title' | 'kind' | 'start_time' | 'end_time' | 'note'>
>
