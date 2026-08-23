import * as React from "react"

/**
 * The value, held back until it has stopped changing for `delay` ms.
 *
 * Used to keep a text filter's input responsive while the *request* it drives
 * fires only once the typing stops. See
 * docs/filtering-sorting-pagination.md §6.
 *
 * The debounced value is what belongs in a query key — the raw input is not,
 * or every keystroke is a cache entry and a round trip.
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = React.useState(value)

  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])

  return debounced
}
