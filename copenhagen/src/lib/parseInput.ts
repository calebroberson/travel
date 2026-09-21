export type ParsedInput = { name: string; url: string | null }

// "maps.google.com", "noma.dk/menu" — a bare host with at least one dot.
const HOST_LIKE = /^[\w-]+(\.[\w-]+)+(\/.*)?$/

/**
 * Turn one text field into a place. Either a URL or a plain name; we never
 * fetch the page, so the hostname is the best provisional name available.
 */
export function parseInput(raw: string): ParsedInput | null {
  const text = raw.trim()
  if (!text) return null

  const candidate = /^https?:\/\//i.test(text)
    ? text
    : HOST_LIKE.test(text)
      ? `https://${text}`
      : null

  if (candidate) {
    try {
      const u = new URL(candidate)
      if (u.hostname.includes('.')) {
        return { name: u.hostname.replace(/^www\./i, ''), url: u.toString() }
      }
    } catch {
      // Not a URL after all; fall through and treat it as a name.
    }
  }

  return { name: text, url: null }
}
