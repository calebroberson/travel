import { googleTravelMode } from './legs'
import type { TravelMode } from './legs'
import type { ItineraryItem, Place } from './types'

/**
 * Directions hand off to Google Maps rather than computing anything here:
 * real transit routing and times, no API key, no dependency. On an iPhone
 * the link opens the Maps app when it's installed.
 */
export function directionsUrl(
  origin: string | null,
  destination: string,
  mode: TravelMode | null,
): string {
  const p = new URLSearchParams({
    api: '1',
    destination,
    travelmode: googleTravelMode(mode),
  })
  // Without an origin, Maps starts from wherever the phone is.
  if (origin) p.set('origin', origin)
  return `https://www.google.com/maps/dir/?${p.toString()}`
}

/**
 * Bare names are ambiguous from Alabama ("Baest" is not only a restaurant),
 * so anchor them to the city. Anything already qualified — it has a comma,
 * or already names the city — is passed through untouched.
 */
export function qualify(text: string): string {
  const t = text.trim()
  if (t.includes(',') || /copenhagen|københavn|kobenhavn/i.test(t)) return t
  return `${t}, Copenhagen`
}

/** A searchable location for an event, or null when it has none. */
export function eventLocation(item: ItineraryItem, place: Place | undefined): string | null {
  if (place) {
    if (place.address) return qualify(place.address)
    // Built here rather than passed through qualify(): the comma joining name
    // and neighborhood would otherwise read as "already qualified".
    return [place.name, place.neighborhood, 'Copenhagen'].filter(Boolean).join(', ')
  }
  // "Check out of hotel" is not somewhere Maps can route to.
  if (item.kind === 'logistics' || !item.title) return null
  return qualify(item.title)
}
