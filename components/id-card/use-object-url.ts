"use client"

import * as React from "react"

/**
 * One blob URL for a picked file, released when the file changes or the
 * component unmounts.
 *
 * ### Why a hook and not a cache
 *
 * A form holding three photos wants three URLs, and the obvious shape for that
 * is one map kept in a ref. It is the wrong shape twice over: reading a ref
 * during render is what `react-hooks/refs` forbids (a render React discards
 * would still have mutated the cache), and a map keyed on anything but the
 * `File` object itself mints a fresh URL every time the *rest* of the form
 * changes — so the photo's `<img>` reloads on every keystroke in the name box.
 *
 * Keyed on the file object, one hook per slot, both problems go away:
 * `useMemo` mints exactly one URL per file, and the effect's cleanup is what
 * releases it — after the commit, never during the render that replaced it.
 *
 * The caller passes `null` for an empty slot; hooks cannot be conditional, so
 * the "no file" case is a value rather than a missing call.
 */
export function useObjectUrl(file: File | null | undefined): string | null {
  const url = React.useMemo(
    () => (file ? URL.createObjectURL(file) : null),
    [file]
  )

  React.useEffect(() => {
    if (!url) return
    return () => URL.revokeObjectURL(url)
  }, [url])

  return url
}
