"use client"

import { useState } from "react"

import { CONDITION_LABELS, ItemCondition } from "@lib/types/item-details"
import {
  ItemDetailsFilters,
  MAX_PRICE_QUERY_KEY,
  MAX_YEAR_QUERY_KEY,
  MIN_PRICE_QUERY_KEY,
  MIN_YEAR_QUERY_KEY,
} from "@lib/util/item-details-filters"

const CONDITION_OPTIONS = Object.entries(CONDITION_LABELS) as [
  ItemCondition,
  string
][]

type ItemDetailsFilterProps = {
  filters: ItemDetailsFilters
  setConditions: (conditions: ItemCondition[]) => void
  setRange: (key: string, value: string) => void
}

const RangeInputs = ({
  label,
  minKey,
  maxKey,
  min,
  max,
  onCommit,
}: {
  label: string
  minKey: string
  maxKey: string
  min: string
  max: string
  onCommit: (key: string, value: string) => void
}) => {
  const [range, setRange] = useState({ min, max })

  return (
    <div className="flex flex-col gap-y-3">
      <span className="txt-compact-small-plus text-ui-fg-subtle">{label}</span>
      <div className="flex items-center gap-x-2">
        <input
          type="number"
          inputMode="numeric"
          placeholder="Od"
          value={range.min}
          onChange={(e) => setRange((r) => ({ ...r, min: e.target.value }))}
          onBlur={() => onCommit(minKey, range.min)}
          className="w-full border border-ui-border-base rounded-rounded px-2 py-1.5 txt-compact-small"
        />
        <span className="text-ui-fg-muted">–</span>
        <input
          type="number"
          inputMode="numeric"
          placeholder="Do"
          value={range.max}
          onChange={(e) => setRange((r) => ({ ...r, max: e.target.value }))}
          onBlur={() => onCommit(maxKey, range.max)}
          className="w-full border border-ui-border-base rounded-rounded px-2 py-1.5 txt-compact-small"
        />
      </div>
    </div>
  )
}

const ItemDetailsFilter = ({
  filters,
  setConditions,
  setRange,
}: ItemDetailsFilterProps) => {
  const toggleCondition = (value: ItemCondition) => {
    const isSelected = filters.conditions.includes(value)
    const next = isSelected
      ? filters.conditions.filter((c) => c !== value)
      : [...filters.conditions, value]
    setConditions(next)
  }

  return (
    <div className="flex flex-col gap-y-6">
      <div className="flex flex-col gap-y-3">
        <span className="txt-compact-small-plus text-ui-fg-subtle">Stav</span>
        <div className="flex flex-col gap-y-2">
          {CONDITION_OPTIONS.map(([value, label]) => (
            <label
              key={value}
              className="flex items-center gap-x-2 txt-compact-small cursor-pointer"
            >
              <input
                type="checkbox"
                checked={filters.conditions.includes(value)}
                onChange={() => toggleCondition(value)}
                className="accent-ui-fg-interactive"
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      <RangeInputs
        label="Cena (Kč)"
        minKey={MIN_PRICE_QUERY_KEY}
        maxKey={MAX_PRICE_QUERY_KEY}
        min={filters.minPrice?.toString() ?? ""}
        max={filters.maxPrice?.toString() ?? ""}
        onCommit={setRange}
      />

      <RangeInputs
        label="Rok vydání"
        minKey={MIN_YEAR_QUERY_KEY}
        maxKey={MAX_YEAR_QUERY_KEY}
        min={filters.minYear?.toString() ?? ""}
        max={filters.maxYear?.toString() ?? ""}
        onCommit={setRange}
      />
    </div>
  )
}

export default ItemDetailsFilter
