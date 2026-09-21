const pad = (n: number) => String(n).padStart(2, '0')

/** Local calendar date as yyyy-mm-dd. Not toISOString(), which is UTC. */
export function isoPlusDays(days = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * True when a reservation is overdue or falls due within `days`.
 *
 * Compares ISO date strings lexically on purpose: new Date('2026-11-21')
 * parses as UTC midnight, which lands on the previous day for anyone west
 * of Greenwich and would flip this pill a day early or late.
 */
export function bookingDue(
  needsReservation: boolean,
  bookBy: string | null,
  days = 7,
): boolean {
  if (!needsReservation || !bookBy) return false
  return bookBy <= isoPlusDays(days)
}

/** "Nov 21" for the card pill. Parsed from parts to stay timezone-free. */
export function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[m - 1]} ${d}`
}
