import { NextResponse, type NextRequest } from "next/server"

/**
 * `GET /api/download-image?url=<storage URL>&filename=<name>` — a same-origin
 * proxy for the card artwork (docs/IDS-FLOW-EXPORTS-ROUTES.md §2.4d).
 *
 * ### Why the browser cannot just download the picture
 *
 * `front_image` / `back_image` are pre-signed URLs on the storage host. A
 * link to one *opens* it — `<a download>` is ignored cross-origin — and a
 * `fetch` of one is subject to that host's CORS policy, which is not ours to
 * set. So the file is pulled here, on the server, and handed back from this
 * origin with `Content-Disposition: attachment`, which is the one thing that
 * makes every browser save it under the name we choose.
 *
 * ### It is an open proxy unless it is not
 *
 * A route that fetches any URL it is given is a way to make this server
 * request things on the caller's behalf. So the target is checked before a
 * byte moves: `http(s)` only, no embedded credentials, a host on the
 * allowlist below, and no literal loopback / private / link-local address.
 * Redirects are not followed — a 3xx from an allowed host to somewhere else
 * is treated as a failure — and the upstream must say it is an image.
 *
 * ### It also shows the pictures, not only saves them
 *
 * The storage host has no TLS, so its `http://` URLs are mixed content on the
 * deployed `https` site and the browser drops them. `displayImageSrc`
 * (utils/download-image.ts) sends those — and only those — through here with
 * no `filename`, so the response is `inline` and the `<img>` is same-origin.
 *
 * ### No authentication, on purpose
 *
 * The dashboard token never reaches this route; the storage URLs are
 * pre-signed and must be fetchable anonymously, which they are. The caller
 * is not checked either: the worst an anonymous caller can do here is fetch
 * an image they already had the URL to.
 *
 * Excluded from the locale proxy by its matcher (proxy.ts) — `/api/…` is
 * never redirected to `/en/api/…`.
 */

/** Storage hosts the artwork is served from. Extend with the env var below. */
const ALLOWED_HOSTS = new Set([
  "identities.g4t.io",
  "82.25.101.56:9000",
  "82.25.101.56:9100",
  ...(process.env.DOWNLOAD_IMAGE_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean),
])

const IMAGE_TYPES = /^image\/(png|jpe?g|webp|gif)(;|$)/i

/** A dotted-quad IPv4 that must never be proxied to. */
function isPrivateIPv4(host: string): boolean {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host)
  if (!match) return false
  const [a, b] = [Number(match[1]), Number(match[2])]
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  )
}

function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  if (host === "localhost" || host.endsWith(".localhost")) return true
  // IPv6 loopback / unspecified / link-local / unique-local.
  if (host === "[::1]" || host === "::1" || host === "[::]" || host === "::") {
    return true
  }
  if (/^\[?f[cd][0-9a-f]{2}:/i.test(host) || /^\[?fe[89ab][0-9a-f]:/i.test(host)) {
    return true
  }
  return isPrivateIPv4(host)
}

/** A `filename=` that cannot break out of the header it is quoted into. */
function safeFilename(value: string | null): string | null {
  if (!value) return null
  const cleaned = value.replace(/[\r\n"\\/]/g, "_").trim().slice(0, 200)
  return cleaned || null
}

function reject(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("url")
  if (!raw) return reject("Missing url", 400)

  let target: URL
  try {
    target = new URL(raw)
  } catch {
    return reject("Invalid url", 400)
  }

  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return reject("URL is not allowed", 400)
  }
  if (target.username || target.password) return reject("URL is not allowed", 400)
  if (isBlockedHost(target.hostname)) return reject("URL is not allowed", 400)
  // `host` carries the port when there is one — the allowlist names ports.
  if (!ALLOWED_HOSTS.has(target.host.toLowerCase())) {
    return reject("URL is not allowed", 400)
  }

  let upstream: Response
  try {
    upstream = await fetch(target, {
      redirect: "manual",
      cache: "no-store",
      headers: { Accept: "image/*" },
    })
  } catch {
    return reject("Upstream unreachable", 502)
  }

  // A redirect from an allowed host is not followed: where it points has not
  // been checked, and following it would be the open-proxy hole in one hop.
  if (!upstream.ok) {
    const status =
      upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502
    return reject("Upstream request failed", status)
  }

  const contentType = upstream.headers.get("content-type") ?? ""
  if (!IMAGE_TYPES.test(contentType)) return reject("Not an image", 415)

  const filename = safeFilename(request.nextUrl.searchParams.get("filename"))

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": filename
        ? `attachment; filename="${filename}"`
        : "inline",
      // The link behind it expires in minutes; the bytes do not.
      "Cache-Control": "public, max-age=86400",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  })
}
