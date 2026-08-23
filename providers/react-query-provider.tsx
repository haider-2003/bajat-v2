"use client"

import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { isAxiosError } from "axios"

/**
 * Server-state provider. See docs/network-layer.md §9.
 *
 * The client is created inside `useState` rather than at module scope so it is
 * not shared between requests during SSR — a module-level client would leak one
 * user's cached data into another's render.
 */
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Long enough that hydration does not immediately refetch everything.
        staleTime: 60 * 1000,
        retry: (failureCount, error) => {
          const status = isAxiosError(error) ? error.response?.status : undefined

          if (status && status >= 400 && status < 500) {
            // Client errors will fail again identically — except throttling and
            // request timeout, which are worth another go.
            return status === 408 || status === 429 ? failureCount < 3 : false
          }

          return failureCount < 3
        },
        // Exponential backoff, capped at 30s.
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      },
    },
  })
}

export function ReactQueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(makeQueryClient)

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === "development" ? (
        <ReactQueryDevtools initialIsOpen={false} />
      ) : null}
    </QueryClientProvider>
  )
}
