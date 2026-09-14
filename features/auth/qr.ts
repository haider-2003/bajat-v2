/**
 * The enrolment QR from `GET /auth/2fa/setup`.
 *
 * The endpoint returns raw SVG markup — not a data URL, not a PNG (see
 * `docs/TFA-RESET-AND-QR-LOGIN.md` §2.2), so it has to be wrapped before
 * anything can render it.
 *
 * The same response carries a `secret`, and nothing formats or displays it:
 * scanning is the only enrolment path the sign-in screen offers.
 */

/**
 * Wrap the markup so an `<img>` can show it.
 *
 * `encodeURIComponent` rather than `btoa`: browser base64 is Latin-1 only and
 * throws `InvalidCharacterError` on any code point above U+00FF — which is
 * what happens the first time the server stamps an Arabic organization name
 * into the SVG's issuer label. Percent-encoding has no such ceiling.
 *
 * An `<img>` rather than `dangerouslySetInnerHTML`: SVG inlined into the
 * document can carry `<script>`, and this markup is server-supplied. Inside an
 * image it is a passive document — no script, no external fetches.
 */
export function qrCodeSrc(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
