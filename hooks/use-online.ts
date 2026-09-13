import * as React from "react"

/**
 * Whether the browser believes it has a network.
 *
 * `navigator.onLine` is a coarse signal — true means "not definitely
 * offline", never "the server is reachable" — which is exactly the right
 * grain for two things: telling someone their Wi-Fi is off rather than
 * blaming the server, and knowing the moment it comes back so a failed
 * request can be retried without a press. The server snapshot is `true`,
 * so a page never renders as offline before it has hydrated.
 */
export function useOnline() {
  return React.useSyncExternalStore(subscribe, getSnapshot, () => true)
}

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange)
  window.addEventListener("offline", onChange)
  return () => {
    window.removeEventListener("online", onChange)
    window.removeEventListener("offline", onChange)
  }
}

function getSnapshot() {
  return navigator.onLine
}
