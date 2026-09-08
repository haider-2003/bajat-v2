/**
 * Dictionary loading.
 *
 * Each language is a dynamic `import()` rather than a static one, so a build
 * splits them: an English visitor never downloads the Arabic strings.
 *
 * The `: Dictionary` return annotation on the Arabic loader is load-bearing.
 * English is the reference shape (see `Dictionary` in ./translate), so a key
 * added to `en.json` and forgotten in `ar.json` fails the type check here
 * rather than rendering a bare `members.title` to an Arabic reader.
 */

import type { Locale } from "./config"
import type { Dictionary } from "./translate"

const loaders: Record<Locale, () => Promise<Dictionary>> = {
  en: () => import("./dictionaries/en.json").then((m): Dictionary => m.default),
  ar: () => import("./dictionaries/ar.json").then((m): Dictionary => m.default),
}

export function getDictionary(locale: Locale): Promise<Dictionary> {
  return loaders[locale]()
}
