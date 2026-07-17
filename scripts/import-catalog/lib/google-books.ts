import type { EnrichedDetails } from "../types.js"

/** Doplní obálku/popis/jazyk podle ISBN. Nekritické selhání -> {}. */
export async function enrichFromGoogleBooks(
  isbn: string,
  apiKey?: string
): Promise<EnrichedDetails> {
  try {
    const url = new URL("https://www.googleapis.com/books/v1/volumes")
    url.searchParams.set("q", `isbn:${isbn}`)
    if (apiKey) url.searchParams.set("key", apiKey)

    const res = await fetch(url)
    if (!res.ok) {
      console.warn(`Google Books: ISBN ${isbn} -> HTTP ${res.status}`)
      return {}
    }

    const data = (await res.json()) as {
      items?: {
        volumeInfo: {
          description?: string
          publishedDate?: string
          publisher?: string
          language?: string
          imageLinks?: { thumbnail?: string }
        }
      }[]
    }

    const info = data.items?.[0]?.volumeInfo
    if (!info) return {}

    return {
      description: info.description,
      year: info.publishedDate ? parseInt(info.publishedDate, 10) : undefined,
      publisher_or_label: info.publisher,
      language: info.language,
      coverUrl: info.imageLinks?.thumbnail,
    }
  } catch (err) {
    console.warn(`Google Books: ISBN ${isbn} selhalo:`, err)
    return {}
  }
}
