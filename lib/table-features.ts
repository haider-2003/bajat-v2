import {
  createCoreRowModel,
  createFacetedRowModel,
  createFacetedUniqueValues,
  createFilteredRowModel,
  createSortedRowModel,
  stockFeatures,
  tableFeatures,
} from "@tanstack/react-table"

/**
 * Feature registration for TanStack Table v9.
 *
 * v9 differs from v8 in two ways that matter here:
 *  - features must be registered explicitly (no implicit "everything on"), and
 *  - row-model factories live in *slots on this object*, not in separate
 *    `getCoreRowModel()` style table options.
 *
 * `columnMeta` is also typed here rather than through v8's global
 * `declare module` augmentation.
 */
export const features = tableFeatures({
  ...stockFeatures,

  // Row-model slots (v9).
  coreRowModel: createCoreRowModel(),
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  facetedRowModel: createFacetedRowModel(),
  facetedUniqueValues: createFacetedUniqueValues(),

  columnMeta: {} as {
    /** Lower drops first as the viewport narrows (§8.12). */
    priority?: number
    /** Human label, used by the column-visibility menu. */
    label?: string
  },
})

export type Features = typeof features
