import { HttpTypes } from "@medusajs/types"

export type ItemCondition = "mint" | "vg_plus" | "vg" | "good" | "fair"
export type CategoryType = "vinyl" | "book"

export const CONDITION_LABELS: Record<ItemCondition, string> = {
  mint: "Mint",
  vg_plus: "Velmi dobrý (VG+)",
  vg: "Dobrý (VG)",
  good: "Uspokojivý",
  fair: "Obnošený",
}

export interface ItemDetails {
  id: string
  condition: ItemCondition
  category_type: CategoryType
  creator: string
  year: number | null
  publisher_or_label: string | null
  discogs_release_id: string | null
  isbn: string | null
  language: string | null
}

export type StoreProductWithItemDetails = HttpTypes.StoreProduct & {
  item_details?: ItemDetails
}
