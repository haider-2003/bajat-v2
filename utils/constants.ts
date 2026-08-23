/**
 * Table constants. See docs/filtering-sorting-pagination.md §4.
 *
 * These are the project-wide values every list screen uses — a page size that
 * differs per screen makes "page 3" mean different things in different tables.
 */

export const DEFAULT_PAGE_SIZE = 10

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const
