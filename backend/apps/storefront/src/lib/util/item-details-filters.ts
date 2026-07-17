import { ItemCondition } from "@lib/types/item-details"

export const CONDITION_QUERY_KEY = "condition"
export const MIN_PRICE_QUERY_KEY = "minPrice"
export const MAX_PRICE_QUERY_KEY = "maxPrice"
export const MIN_YEAR_QUERY_KEY = "minYear"
export const MAX_YEAR_QUERY_KEY = "maxYear"

export type ItemDetailsFilters = {
  conditions: ItemCondition[]
  minPrice?: number
  maxPrice?: number
  minYear?: number
  maxYear?: number
}

type SearchParamsLike =
  | URLSearchParams
  | Record<string, string | string[] | undefined>

const getAll = (searchParams: SearchParamsLike, key: string): string[] => {
  if (typeof (searchParams as URLSearchParams).getAll === "function") {
    return (searchParams as URLSearchParams).getAll(key).filter(Boolean)
  }

  const value = (
    searchParams as Record<string, string | string[] | undefined>
  )[key]

  if (Array.isArray(value)) return value.filter(Boolean)
  if (typeof value === "string" && value.length > 0) {
    return value.split(",").filter(Boolean)
  }
  return []
}

const getOne = (
  searchParams: SearchParamsLike,
  key: string
): string | undefined => {
  if (typeof (searchParams as URLSearchParams).get === "function") {
    return (searchParams as URLSearchParams).get(key) ?? undefined
  }

  const value = (
    searchParams as Record<string, string | string[] | undefined>
  )[key]

  return Array.isArray(value) ? value[0] : value
}

export const parseItemDetailsFilters = (
  searchParams: SearchParamsLike
): ItemDetailsFilters => {
  const conditions = Array.from(
    new Set(getAll(searchParams, CONDITION_QUERY_KEY))
  ) as ItemCondition[]

  const minPriceRaw = getOne(searchParams, MIN_PRICE_QUERY_KEY)
  const maxPriceRaw = getOne(searchParams, MAX_PRICE_QUERY_KEY)
  const minYearRaw = getOne(searchParams, MIN_YEAR_QUERY_KEY)
  const maxYearRaw = getOne(searchParams, MAX_YEAR_QUERY_KEY)

  return {
    conditions,
    minPrice: minPriceRaw ? Number(minPriceRaw) : undefined,
    maxPrice: maxPriceRaw ? Number(maxPriceRaw) : undefined,
    minYear: minYearRaw ? Number(minYearRaw) : undefined,
    maxYear: maxYearRaw ? Number(maxYearRaw) : undefined,
  }
}
