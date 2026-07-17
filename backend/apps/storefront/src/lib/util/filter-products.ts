import { StoreProductWithItemDetails } from "@lib/types/item-details"
import { ItemDetailsFilters } from "./item-details-filters"

/**
 * item_details (stav/rok) a cena nejsou nativní Store API filtry (jde o
 * vlastní module link, cena se navíc už dnes řadí in-memory, viz sort-products.ts),
 * proto se filtrují až po fetchi nad max. 100 položkami z listProductsWithSort.
 */
export function filterProductsByItemDetails(
  products: StoreProductWithItemDetails[],
  filters: ItemDetailsFilters
): StoreProductWithItemDetails[] {
  const { conditions, minPrice, maxPrice, minYear, maxYear } = filters

  return products.filter((product) => {
    if (conditions.length) {
      const condition = product.item_details?.condition
      if (!condition || !conditions.includes(condition)) {
        return false
      }
    }

    if (minYear !== undefined || maxYear !== undefined) {
      const year = product.item_details?.year
      if (year == null) return false
      if (minYear !== undefined && year < minYear) return false
      if (maxYear !== undefined && year > maxYear) return false
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      const amounts = (product.variants ?? []).map(
        (variant) => variant.calculated_price?.calculated_amount ?? 0
      )
      if (!amounts.length) return false
      const price = Math.min(...amounts)
      if (minPrice !== undefined && price < minPrice) return false
      if (maxPrice !== undefined && price > maxPrice) return false
    }

    return true
  })
}
