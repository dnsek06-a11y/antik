import type { EnrichedDetails } from "../types.js"

/** Doplní rok/label podle Discogs release ID. Nekritické selhání -> {}. */
export async function enrichFromDiscogs(
  releaseId: string,
  token?: string
): Promise<EnrichedDetails> {
  try {
    const res = await fetch(`https://api.discogs.com/releases/${releaseId}`, {
      headers: {
        "User-Agent": "AntikvariatImportScript/1.0",
        ...(token ? { Authorization: `Discogs token=${token}` } : {}),
      },
    })

    if (!res.ok) {
      console.warn(`Discogs: release ${releaseId} -> HTTP ${res.status}`)
      return {}
    }

    const data = (await res.json()) as {
      year?: number
      labels?: { name: string }[]
      notes?: string
      images?: { uri: string }[]
    }

    return {
      year: data.year,
      publisher_or_label: data.labels?.[0]?.name,
      description: data.notes,
      coverUrl: data.images?.[0]?.uri,
    }
  } catch (err) {
    console.warn(`Discogs: release ${releaseId} selhalo:`, err)
    return {}
  }
}
