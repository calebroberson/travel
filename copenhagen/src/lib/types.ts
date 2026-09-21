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

/** The subset of Place the edit sheet can write. */
export type PlacePatch = Partial<
  Pick<
    Place,
    | 'name'
    | 'category'
    | 'neighborhood'
    | 'url'
    | 'note'
    | 'needs_reservation'
    | 'book_by'
    | 'daylight_required'
    | 'status'
  >
>
