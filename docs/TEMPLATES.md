# Templates — status and queue

A template is **a whole palette in one pick**: page, surfaces, text ramp, borders, sidebar and
button colour, applied together from Settings → Appearance. Colours only — no fonts, no radius,
no spacing, no layout.

This file is the handoff: what already works, how to add the next one, and a queue of reference
palettes with values ready to paste. Written August 2026.

Companion doc: [CLAUDE-CHAT-DESIGN-SYSTEM.md](CLAUDE-CHAT-DESIGN-SYSTEM.md) — where Clay's values
come from. Governing spec: [DESIGN.md](DESIGN.md).

---

## 1. Status

**Shipped.** Four templates, a picker, and a reset. Build and typecheck pass.

| Template | Ramp | Accent | Primary | Notes |
|---|---|---|---|---|
| **Graphite** | `:root` / `.dark` defaults | blue | neutral | The shipped design. No CSS block — it *is* the fallback, which is what makes it a safe reset target. |
| **Clay** | `[data-template="clay"]` | clay `#D97757` | accent | claude.ai's warm paper. Cream page, warmer rail, orange buttons. |
| **Ink** | `[data-template="ink"]` | blue | neutral | High contrast. Borders at ~3× the usual, white rail on a tinted page. Structure from outlines, not fills. |
| **Ledger** | `[data-template="ledger"]` | **indigo** `#635BFF` | accent | The Stripe dashboard. Blue-cast neutrals, navy ink, indigo buttons. Closest of the four to what Bajat actually is. |

The four are deliberately far apart — warm, neutral, hard, blue. A fifth has to earn its place
against them; two templates that read as similar make the picker look like noise.

**Ledger added an eighth accent.** `indigo` is Stripe's `#635BFF` carried in exactly, following
the precedent already set for Claude's clay and n8n's pink. Its `--accent-strong` steps down two
stops to `#4F46D9`, not one: the hue clears 4.5:1 on white (4.7) so a button would have been fine,
but the same property is the label colour on `--accent-soft`, where `#635BFF` lands at 4.07.
`#4F46D9` clears both (6.4 and 5.7). The four edits are the worked example for §2's recipe.

### Ink's two documented departures

Both are in the CSS comments, repeated here because they are the kind of thing that looks like a
bug later:

- **The rail is lighter than the page in *both* themes.** §5.3 says the sidebar is the darkest
  surface in dark mode. Ink inverts it so the rail is the raised element consistently; flipping
  that relationship between light and dark would read as two designs.
- **`--soft-bot` takes the page value, not `--surface-sunken`** (against §5's derivation rule).
  Ink's sunken is a full slate-200 — a control made of it looks pressed at rest.

### Files

| File | What it holds |
|---|---|
| [app/globals.css](../app/globals.css) | The `data-template` blocks — the neutral ramp, light and dark. Search for "Templates — a whole palette in one choice". |
| [components/layout/brand.tsx](../components/layout/brand.tsx) | `TEMPLATES`, the store, `applyTemplate`, `matchTemplate`, the pre-paint script. |
| [components/ui/template-picker.tsx](../components/ui/template-picker.tsx) | The card picker and its miniature-app thumbnail. |
| [app/settings/components/appearance-section.tsx](../app/settings/components/appearance-section.tsx) | The Template block and the Reset row. |
| [components/ui/control-style.tsx](../components/ui/control-style.tsx) | `SOFT_SURFACE` now reads `--soft-*` instead of hardcoded hex, so the `raised` face follows the template. |

### How it works, in three sentences

Selecting a template writes three attributes on `<html>` — `data-template`, `data-accent`,
`data-primary` — in one go, then notifies once. `data-template` owns the neutral ramp; the accent
and primary blocks that already existed keep owning the accent tokens, so nothing overlaps and
nothing fights in the cascade. Components need no changes because they were already reading
tokens (`bg-sidebar`, `text-text`), not hex.

### Two behaviours worth remembering

- **"Custom" is derived, never stored.** `matchTemplate` compares the stored template against the
  live accent and primary; change either by hand and no card claims to be active. There is no
  "custom template" value in localStorage.
- **Reset does not touch light/dark.** It restores template, accent, primary, control style and
  flat variant. Theme is a comfort choice, not a styling one. If that ever needs to change, it is
  one line in `reset` in appearance-section.tsx.

---

## 2. Adding a template

Five steps, ~30 minutes each once the palette is chosen.

1. **Pick the 10 decisive values per theme** (§4 has them for five candidates), then expand to the
   full token set with the derivation rules in §5.
2. **Add the CSS blocks** to [globals.css](../app/globals.css) beside the Clay block —
   `:root[data-template="x"]` first, then `.dark[data-template="x"]`. The dark block **must** come
   second: both score (0,2,0) on the same element, so source order decides.
3. **Add the entry** to `TEMPLATES` in [brand.tsx](../components/layout/brand.tsx) — `value`,
   `label`, `description`, `accent`, `primary`, and the six preview hexes per theme (`page`,
   `rail`, `surface`, `line`, `ink`, `button`). Add the value to the `Template` union.
4. **Nothing else.** The picker renders from `TEMPLATES`, the init script validates against it,
   the store handles it.
5. **Verify** against §6's checklist.

### If a template needs an accent that doesn't exist yet

The eight accents are violet, indigo, blue, cyan, green, orange, clay, pink. Adding a ninth is
four edits, all mechanical — `indigo` was added exactly this way, so copy it:

1. `ACCENTS` array in brand.tsx — `value`, `label`, `tone` (light/dark text classes), `tile` (the
   four `--sw-*` stops for the swatch).
2. `:root[data-accent="x"]` in globals.css — `--accent-violet`, `--accent-soft`,
   `--accent-border`, `--accent-strong`, `--ring`, `--sidebar-ring`.
3. `.dark[data-accent="x"]` — the 400-level partner. Must come after the light block.
4. `:root[data-primary="accent"][data-accent="x"]` — the `--pb-*` tone stops for solid controls.

`--accent-strong` is the hue darkened until **white text clears 4.5:1** on it. That is the one
value people get wrong: the accent tone is judged at 3:1 as a ring colour, and reusing it behind a
label fails contrast.

---

## 3. Rules a template must obey

| Allowed | Forbidden |
|---|---|
| `--background`, `--background-subtle` | `--primary`, `--primary-foreground` — owned by `data-primary` |
| `--surface`, `--surface-elevated`, `--surface-sunken` | `--accent-violet`, `--accent-soft`, `--accent-border`, `--accent-strong`, `--ring` — owned by `data-accent` |
| `--text`, `--text-secondary`, `--text-muted`, `--text-placeholder`, `--foreground` | `--pb-*`, `--ctl-face-*` — same reason |
| `--card*`, `--popover*`, `--secondary*` | `--success`, `--warning`, `--danger`, `--info` and their `-bg` — §2.2: a warm page must not warm a danger badge |
| `--muted*`, `--accent`, `--accent-foreground` (the neutral hover wash) | `--chart-1..5` — §2.3 says theme-stable |
| `--border`, `--border-strong`, `--border-subtle`, `--input` | `--radius*`, `--spacing-*` — no template may move a control by a pixel |
| `--sidebar*` (except `--sidebar-ring`) | fonts — deliberately out of scope |
| `--soft-top/mid/bot`, `--overlay` | |

Both halves of every template are required. Dark mode is **not** an inversion (§16): surfaces step
*lighter* as they elevate, text stops short of pure white, and the sidebar is the darkest surface.
Writing only the light block leaves dark mode with light backgrounds and dark-mode text.

---

## 4. Reference palettes — the queue

Ranked by fit for a data dashboard. Each gives the 10 decisive values per theme; §5 expands them
to the full set.

Sidebar relationship is called out per template because it changes the app's character more than
the hue does: **A** = rail matches the page, **B** = rail darker/warmer than the page, **C** = rail
white/light against a tinted page.

### 4.1 Ink — high-contrast slate  ✅ SHIPPED

Built. Values below are what actually landed; see §1 for its two documented departures from the
derivation rules. Kept here as the worked example to copy when authoring the next one.

| | Light | Dark |
|---|---|---|
| page | `#eef2f6` | `#0d1117` |
| background-subtle | `#f4f7fa` | `#121a24` |
| surface | `#ffffff` | `#161d27` |
| surface-sunken | `#e2e8f0` | `#0a0f16` |
| text | `#0f172a` | `#e6edf3` |
| text-secondary | `#334155` | `#b4c0cc` |
| text-muted | `#64748b` | `#8b98a5` |
| border | `#cbd5e1` ← deliberately strong | `#30363d` |
| border-strong | `#94a3b8` | `#4a525c` |
| sidebar | `#ffffff` | `#161d27` |

### 4.2 Paper — warm, after Notion

Warm like Clay but cooler and quieter; no orange. Good if Clay reads as too much personality.
Rail **B**. Pair with: accent `blue`, primary `neutral`.

| | Light | Dark |
|---|---|---|
| page | `#f7f6f3` | `#191919` |
| background-subtle | `#fbfaf8` | `#1e1e1e` |
| surface | `#ffffff` | `#252525` |
| surface-sunken | `#f1f0ed` | `#141414` |
| text | `#37352f` | `#ededec` |
| text-secondary | `#5f5b53` | `#b4b2ad` |
| text-muted | `#8b8579` | `#8a8880` |
| border | `#e9e7e2` | `#333331` |
| border-strong | `#d9d6cf` | `#454542` |
| sidebar | `#f1f0ed` | `#141414` |

### 4.3 Ledger — finance blue, after the Stripe dashboard  ✅ SHIPPED

Built, with a new `indigo` accent rather than approximating with violet — see §1. Rail **C**,
primary `accent`. Values below are what landed.

| | Light | Dark |
|---|---|---|
| page | `#f6f8fa` | `#0f1116` |
| background-subtle | `#fafbfc` | `#161922` |
| surface | `#ffffff` | `#1c1f2a` |
| surface-sunken | `#eef2f7` | `#0b0d11` |
| text | `#1a1f36` | `#e6e9f0` |
| text-secondary | `#4f566b` | `#a9b1c6` |
| text-muted | `#8792a2` | `#7c869c` |
| border | `#e3e8ee` | `#2a2f3d` |
| border-strong | `#cdd5df` | `#3c4353` |
| sidebar | `#ffffff` | `#161922` |

### 4.4 Midnight — dark-first, after Linear

The look people ask for by name. Cool, tight, low-contrast chrome. Its light half exists only so
the template isn't broken in light mode — it is not the point of it. Rail **A**.
Pair with: accent `violet`, primary `accent`.

| | Light | Dark |
|---|---|---|
| page | `#f7f8f8` | `#08090a` |
| background-subtle | `#fbfbfb` | `#0e0f11` |
| surface | `#ffffff` | `#141516` |
| surface-sunken | `#f0f1f2` | `#050506` |
| text | `#101012` | `#f7f8f8` |
| text-secondary | `#45464b` | `#b8babf` |
| text-muted | `#6b6d76` | `#8a8f98` |
| border | `#e6e7e9` | `#232527` |
| border-strong | `#d0d2d6` | `#34363a` |
| sidebar | `#f7f8f8` | `#08090a` |

### 4.5 Terminal — after Supabase

Neutral greys with a distinctive green. Only worth shipping if the users skew technical.
Rail **B**. Pair with: accent `green`, primary `accent`.

| | Light | Dark |
|---|---|---|
| page | `#fcfcfc` | `#1c1c1c` |
| background-subtle | `#fdfdfd` | `#212121` |
| surface | `#ffffff` | `#262626` |
| surface-sunken | `#f4f4f4` | `#171717` |
| text | `#171717` | `#ededed` |
| text-secondary | `#4d4d4d` | `#b4b4b4` |
| text-muted | `#7a7a7a` | `#898989` |
| border | `#e4e4e4` | `#333333` |
| border-strong | `#cfcfcf` | `#444444` |
| sidebar | `#f8f8f8` | `#171717` |

### 4.6 Considered and skipped

| Source | Why not |
|---|---|
| GitHub Primer | Fine, but reads as generic corporate blue next to Ledger. Redundant. |
| Shopify Polaris | Excellent for commerce admin, but its neutrals are so close to Graphite that nobody would perceive the difference in a picker. |
| Vercel / Geist | That *is* Graphite. |
| Arc, Superhuman, gradient-heavy marketing sites | Built for hero screens, not 40-row tables. Actively bad here. |
| Anything with a red accent | Red is deliberately absent from `ACCENTS`: an accent sharing the danger hue makes destructive confirmations unreadable as warnings. |

**Ship at most five total.** The moment two templates look similar in the picker, the feature
reads as noise rather than choice.

---

## 5. Deriving the full token set from the 10

Mechanical. Follow the Clay block as the worked example.

```
--foreground              = --text
--text-placeholder        = one step lighter than --text-muted
--card                    = --surface
--card-foreground         = --text
--popover                 = --surface-elevated
--popover-foreground      = --text
--surface-elevated        = --surface (light) | one step lighter than --surface (dark)
--secondary               = --surface (light) | rgba(255,255,255,0.05) (dark)
--secondary-foreground    = --text
--muted, --accent         = the hover wash: --surface-sunken (light) | rgba(255,255,255,0.05) (dark)
--muted-foreground        = --text-muted
--accent-foreground       = --text
--border-subtle           = one step lighter than --border
--input                   = --border (light) | one step lighter than --border (dark)
--soft-top                = --surface           ┐ light only — the dark `raised` face is
--soft-mid                = between top and bot │ built from additive white overlays and
--soft-bot                = --surface-sunken    ┘ needs no per-template values
--sidebar-foreground      = --text-secondary
--sidebar-accent          = rgba(<ink>, 0.05) (light) | rgba(255,255,255,0.08) (dark)
--sidebar-accent-foreground = --text
--sidebar-border          = one step from --border, toward the sidebar's own ground
--overlay                 = <ink> at 0.32 (light) | rgba(0,0,0,0.6) (dark)
```

Never set `--sidebar-ring` — it belongs to the accent.

---

## 6. Verification checklist

Run through this in **both themes** before calling a template done:

- [ ] `/members-requests` — the table. Zebra striping, header row, hover, selected row.
- [ ] Status badges on the new ground — success/warning/danger still read as themselves.
- [ ] Focus a filter input — the accent ring is visible against the new border colour.
- [ ] The `raised` control style — the secondary face (`--soft-*`) doesn't look like it came from
      a different palette.
- [ ] Disabled controls — still legibly disabled, not invisible.
- [ ] The sidebar's active item on the new rail.
- [ ] Dropdowns and dialogs — `--popover` against `--overlay`.
- [ ] Reload the page — no colour flash before paint (the init script covers it, but a typo in the
      template value silently falls back to graphite).
- [ ] `--text-muted` on `--background` still clears ~4.5:1.

---

## 7. Open questions for next session

1. **Which template next — if any?** Ink and Ledger are done. Four is already at the point where
   the picker is a choice rather than a gallery, so the honest answer is **stop here unless one of
   the four is failing in use**. If a fifth happens, **Midnight** is the candidate: the only
   dark-first look, and the one people ask for by name. Paper overlaps Clay; Terminal only pays
   off if the users skew technical.
2. **Font weight.** Asked for, deferred. Components hardcode `font-medium` / `font-semibold`;
   making weight themeable means routing those through a token (`--weight-label`) across every
   component. If it happens, it should be its own Appearance row, not part of a template.
3. **Should templates carry a control style?** Currently no — picking a template never changes the
   button material. Revisit once the control-style experiment in
   [control-style.tsx](../components/ui/control-style.tsx) is resolved; that file is marked
   TEMPORARY and is meant to be deleted once a winner is picked.
4. **Per-account vs per-device.** Every appearance preference is localStorage only and says so in
   the section description. If templates should follow the account, that is an API question, not a
   CSS one.
5. ~~**Ledger's accent.**~~ Resolved: added `indigo` at Stripe's exact `#635BFF` rather than
   approximating with violet. See §1 for the contrast reasoning behind `--accent-strong`.
