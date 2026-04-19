// Wikipedia REST summary client for park hero imagery + descriptions.
//
// Single endpoint: `/api/rest_v1/page/summary/{title}` returns a thumbnail,
// 1-paragraph extract, and canonical page URL in one CORS-friendly call.
// Documented at https://en.wikipedia.org/api/rest_v1/.
//
// We cache results in-memory keyed on the queried title (positive AND
// negative — a 404 caches as NULL_MEDIA so we don't re-hammer the API for
// parks Wikipedia doesn't know about). Concurrent calls for the same title
// share a single in-flight Promise via an `inflight` map.

export interface ParkMedia {
  imageUrl: string | null
  summary: string | null
  wikiUrl: string | null
}

const NULL_MEDIA: ParkMedia = { imageUrl: null, summary: null, wikiUrl: null }

const cache = new Map<string, ParkMedia>()
const inflight = new Map<string, Promise<ParkMedia>>()

interface WikiSummaryResponse {
  type?: string
  extract?: string
  thumbnail?: { source: string; width?: number; height?: number }
  originalimage?: { source: string; width?: number; height?: number }
  content_urls?: { desktop?: { page?: string } }
}

async function doFetch(title: string): Promise<ParkMedia> {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) return NULL_MEDIA

  const data = (await res.json()) as WikiSummaryResponse

  // Disambiguation pages have no real content — treat as a miss.
  if (data.type === 'disambiguation') return NULL_MEDIA

  return {
    imageUrl: data.originalimage?.source ?? data.thumbnail?.source ?? null,
    summary: data.extract ?? null,
    wikiUrl: data.content_urls?.desktop?.page ?? null,
  }
}

export async function fetchParkMedia(rawName: string): Promise<ParkMedia> {
  const title = rawName.trim()
  if (!title) return NULL_MEDIA

  const cached = cache.get(title)
  if (cached) return cached

  const existing = inflight.get(title)
  if (existing) return existing

  const promise = doFetch(title)
    .catch(() => NULL_MEDIA)
    .then((result) => {
      cache.set(title, result)
      return result
    })
    .finally(() => {
      inflight.delete(title)
    })

  inflight.set(title, promise)
  return promise
}
