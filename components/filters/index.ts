/**
 * Filter controls shared by every list screen.
 *
 * All of them are controlled and stateless — the screen owns the values, and
 * `buildFilter` (utils/api/filters.ts) turns them into query clauses. See
 * docs/filtering-sorting-pagination.md.
 */
export { TextFilter } from "./text-filter"
export { FilterButton } from "./filter-button"
export { FacetFilter, toggleKey, type FacetOption } from "./facet-filter"
export { SelectFilter, type SelectOption } from "./select-filter"
export { FilterChips, FilterChip, type ActiveFilter } from "./filter-chips"
export { FilterSheet, SHEET_CONTROL } from "./filter-sheet"
export { DateRangeFilter, describeRange } from "./date-range-filter"

// The add-a-filter kit (§12.8 / §14.5) — for screens with more filters than
// a toolbar can carry. See filter-builder.tsx.
export {
  AppliedFilters,
  FilterMenu,
  useFilterEditor,
  type FilterDefinition,
} from "./filter-builder"
export {
  ChoiceEditor,
  DateEditor,
  DateRangeEditor,
  describeFacet,
  FacetEditor,
  RangeEditor,
  TextEditor,
} from "./filter-editors"
