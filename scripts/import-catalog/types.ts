export type ItemCondition = "mint" | "vg_plus" | "vg" | "good" | "fair"
export type CategoryType = "vinyl" | "book"

/** Jeden řádek vstupního CSV katalogu (viz README sekce "Formát CSV"). */
export interface CatalogRow {
  title: string
  creator: string
  year?: string
  condition: ItemCondition
  category_type: CategoryType
  /** Název leaf kategorie z taxonomie (např. "Rock", "Beletrie"). */
  category: string
  price_czk: string
  isbn?: string
  discogs_release_id?: string
  publisher_or_label?: string
  language?: string
  description?: string
  /** Cesty k fotkám oddělené středníkem, relativně k --photos-dir. */
  photos?: string
}

export interface EnrichedDetails {
  description?: string
  coverUrl?: string
  year?: number
  publisher_or_label?: string
  language?: string
}
