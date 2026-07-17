"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useMemo } from "react"

import { ItemCondition } from "@lib/types/item-details"
import {
  CONDITION_QUERY_KEY,
  parseItemDetailsFilters,
} from "@lib/util/item-details-filters"
import ItemDetailsFilter from "./item-details-filter"
import SortProducts, { SortOptions } from "./sort-products"

type RefinementListProps = {
  sortBy: SortOptions
  search?: boolean
  "data-testid"?: string
}

const RefinementList = ({
  sortBy,
  "data-testid": dataTestId,
}: RefinementListProps) => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const updateQueryParams = useCallback(
    (updater: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString())
      updater(params)

      params.delete("page")

      const queryString = params.toString()
      const currentQuery = searchParams.toString()
      const nextPath = queryString ? `${pathname}?${queryString}` : pathname
      const currentPath = currentQuery
        ? `${pathname}?${currentQuery}`
        : pathname

      if (nextPath !== currentPath) {
        router.push(nextPath)
      }
    },
    [pathname, router, searchParams]
  )

  const setQueryParams = (name: string, value: string) =>
    updateQueryParams((params) => params.set(name, value))

  const itemDetailsFilters = useMemo(
    () => parseItemDetailsFilters(searchParams),
    [searchParams]
  )

  const setConditions = (conditions: ItemCondition[]) =>
    updateQueryParams((params) => {
      params.delete(CONDITION_QUERY_KEY)
      conditions.forEach((condition) =>
        params.append(CONDITION_QUERY_KEY, condition)
      )
    })

  const setRange = (key: string, value: string) =>
    updateQueryParams((params) => {
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
    })

  return (
    <div className="flex flex-col gap-12 py-4 mb-8 small:px-0 pl-6 small:min-w-[250px] small:ml-[1.675rem]">
      <SortProducts
        sortBy={sortBy}
        setQueryParams={setQueryParams}
        data-testid={dataTestId}
      />
      <ItemDetailsFilter
        filters={itemDetailsFilters}
        setConditions={setConditions}
        setRange={setRange}
      />
    </div>
  )
}

export default RefinementList
