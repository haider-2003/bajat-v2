import NextLink from "next/link"

import { lang } from "next/root-params"

import { defaultLocale, isLocale } from "./config"
import { localizeHref } from "./href"

/**
 * `next/link` with the locale prefix, for **Server Components**.
 *
 * The client-side `Link` in ./navigation.tsx reads the locale from React
 * context, which a server component has none of. This one reads the same value
 * from the root param instead, so a server-rendered page can link without
 * being handed the locale as a prop.
 *
 * Client components should keep importing `Link` from ./navigation.
 */
export async function LocaleLink({
  href,
  ...props
}: Omit<React.ComponentProps<typeof NextLink>, "href"> & { href: string }) {
  const value = await lang()
  const locale = isLocale(value) ? value : defaultLocale

  return <NextLink href={localizeHref(href, locale)} {...props} />
}
