# Claude.ai — Design System Analysis

> **Provenance.** claude.ai is auth-walled and ships obfuscated Tailwind output, so the values
> below are a *reconstruction from observation of the shipped UI*, not scraped tokens. Hex values
> are accurate to within a shade or two; the structure, ratios and rules are the reliable part.
> Treat it as a spec you can build against, not as Anthropic's internal source of truth.
>
> Scope: the chat product (claude.ai) — sidebar, conversation, composer, menus, code blocks,
> artifacts panel. Not the marketing site, not Console.

---

## Table of contents

1. [Design language](#1-design-language)
2. [Color](#2-color)
3. [Typography](#3-typography)
4. [Layout & spacing](#4-layout--spacing)
5. [Radius, borders, elevation](#5-radius-borders-elevation)
6. [Components](#6-components)
7. [Motion](#7-motion)
8. [Iconography](#8-iconography)
9. [Accessibility notes](#9-accessibility-notes)
10. [Copy-paste token block (Tailwind v4)](#10-copy-paste-token-block-tailwind-v4)
11. [What this means for bajat-v2](#11-what-this-means-for-bajat-v2)

---

## 1. Design language

**One sentence:** warm paper, near-zero chrome, a single orange accent used sparingly, and
typography doing the work that borders and shadows do in most SaaS UIs.

Five rules that explain almost every decision in the product:

1. **Paper, not glass.** Light mode is cream (`#FAF9F5`), not white. White is reserved for
   *raised* surfaces — the composer, cards, menus. Most dashboards do the inverse (grey page,
   white cards); Claude keeps both warm, so the contrast between page and card is ~3%, not 8%.
2. **Chrome recedes, content leads.** No app-wide toolbar, no breadcrumb bar, no card frames
   around messages. The top bar is ~56px and often holds only a model picker and two icon
   buttons. Structure is carried by whitespace and type weight.
3. **One accent, used rarely.** Orange (`#D97757`) appears on the send button, active/branded
   states, and links — and essentially nowhere else. Hover, selection and "active nav item" are
   *neutral* tints (a 4–6% ink wash), not accent tints. This is why the accent still reads as
   meaningful after an hour of use.
4. **Hairlines over shadows.** Elevation is expressed with a 1px border at ~8% ink. Real shadows
   only appear on floating layers (menus, dialogs, toasts), and even there they are soft and wide,
   never dark.
5. **Editorial serif for moments, sans for work.** A serif display face shows up exactly once per
   screen — the greeting/empty state, occasionally artifact titles. Everything operational is sans.

**Feel:** calm, literary, slightly analog. The closest reference points are Things 3 and Readwise,
not Linear or Vercel (both of which are colder and higher-contrast).

---

## 2. Color

### 2.1 Brand lineage

Anthropic's brand palette is the parent of the product palette — clay, kraft paper, manilla folder:

| Name       | Hex       | Role |
|------------|-----------|------|
| Book Cloth | `#CC785C` | brand orange (marketing) |
| Kraft      | `#D4A27F` | warm secondary |
| Manilla    | `#EBDBBC` | warm tint / illustration |
| Slate Dark | `#191919` | ink |
| Ivory      | `#F0F0EB` | paper |

The product shifts the orange slightly brighter (`#D97757`) so it survives on cream and on the
dark charcoal background at the same value.

### 2.2 Light mode

```
Surfaces
  page background        #FAF9F5   cream — the default canvas
  sidebar                #F0EEE6   one step warmer/darker than page
  raised surface         #FFFFFF   composer, menus, cards, code chrome
  sunken / user bubble   #F0EEE6   same value as sidebar (deliberate rhyme)

Text
  primary                #141413   near-black with a warm bias, never #000
  secondary              #5C5B57   labels, metadata
  muted                  #8A8880   timestamps, helper text
  placeholder            #A8A69E

Borders
  hairline               #E5E3DC   ~8% ink on cream
  strong                 #D6D3C9   inputs, dividers that must read

Accent
  accent                 #D97757   send button, links, brand marks
  accent hover           #C2603F
  accent tint            #F6EBE5   selected / branded row background
  accent border          #EAD3C7

Status (used very sparingly — mostly in settings/billing)
  danger                 #BF4D43
  success                #4A7C59
  warning                #B7791F
```

### 2.3 Dark mode

Dark mode is **warm charcoal, not blue-black** — the single most copied and most often
mis-copied part of this system. There is no pure black anywhere.

```
Surfaces
  page background        #262624
  sidebar                #1F1E1D   darker than page (inverse of light mode's relationship)
  raised surface         #30302E   menus, dialogs, composer
  sunken / user bubble   #1F1E1D

Text
  primary                #F5F4EE   warm off-white, never #FFF
  secondary              #C2C0B6
  muted                  #8F8D86

Borders
  hairline               #3B3A37   ~10% white
  strong                 #4A4844

Accent
  accent                 #D97757   unchanged — chosen to work on both grounds
  accent hover           #E08A6C
  accent tint            rgba(217, 119, 87, 0.15)
```

### 2.4 Interaction tints (both themes)

| State | Light | Dark |
|-------|-------|------|
| hover (nav, list, ghost button) | `rgba(0,0,0,0.04)` | `rgba(255,255,255,0.06)` |
| pressed | `rgba(0,0,0,0.07)` | `rgba(255,255,255,0.10)` |
| active nav item | sidebar +1 step (`#E8E5DA`) | `rgba(255,255,255,0.08)` |
| focus ring | 2px `rgba(217,119,87,0.45)`, 2px offset | same |

Note the discipline: **the active conversation in the sidebar is a neutral wash, not orange.**

---

## 3. Typography

### 3.1 Families

| Role | Face | Fallback stack |
|------|------|----------------|
| UI / body | **Styrene B** (Anthropic's brand grotesque; Styrene A for tighter display) | `ui-sans-serif, -apple-system, "Segoe UI", system-ui, sans-serif` |
| Display / editorial | **Copernicus** (headline serif); **Tiempos Text** in longer-form contexts | `ui-serif, Georgia, "Times New Roman", serif` |
| Code | system mono | `ui-monospace, SFMono-Regular, "JetBrains Mono", Consolas, monospace` |

Styrene and Copernicus are licensed. If you are reproducing the feel, the closest free
substitutes are **Inter Tight / Geist** for the sans and **Instrument Serif / Source Serif 4** or
**Newsreader** for the display serif.

### 3.2 Scale

| Token | Size / line-height | Where |
|-------|--------------------|-------|
| display | 32–40px / 1.15, serif, weight 400 | greeting, empty states |
| title | 20px / 1.3, weight 500 | dialog titles, artifact titles |
| body-lg | 16px / **1.65**, weight 400 | **message text — the most important value in the system** |
| body | 14px / 1.5 | all UI chrome, sidebar, menus, buttons |
| small | 13px / 1.45 | metadata, model name, helper text |
| micro | 11–12px / 1.4, +0.02em tracking | sidebar section headers ("Recents"), badges |
| code | 13px / 1.6 | code blocks and inline code |

Two rules that matter more than the numbers:

- **Message line-height is 1.6–1.7 and the measure is capped at ~68–72ch.** That combination is
  most of why long answers feel readable. UI chrome stays at 1.5.
- **Weights are 400 / 500 only.** There is effectively no bold in the chrome — emphasis comes
  from color and size. 600 appears only inside rendered markdown (`**bold**`) and headings.

### 3.3 Markdown rendering inside messages

Claude's own answers are styled prose, and the rules are worth stealing verbatim:

- h1/h2 → 18–20px weight 500, `margin-top: 1.75em`, `margin-bottom: 0.5em`
- paragraphs → `margin-bottom: 1em`, no top margin
- lists → 1.5em indent, 0.35em between items, markers in `text-muted`
- inline code → 0.9em, `rgba(0,0,0,0.05)` background, 4px radius, 0.2em horizontal padding, **no border**
- blockquote → 2px left border in `border-strong`, 1em padding, text in `text-secondary`
- tables → hairline borders, 8/12px cell padding, header row weight 500 on the sunken surface
- first and last child margins collapse to zero — the bubble owns the padding

---

## 4. Layout & spacing

Base unit **4px**; the ladder actually used is `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64`.

### 4.1 App shell

```
+------------+----------------------------------------------+
|  sidebar   |  top bar  56px  (model picker | share | ...) |
|  260-288px +----------------------------------------------+
|  (rail 56) |            conversation column               |
|            |            max-width ~768px, centered        |
|            +----------------------------------------------+
|            |  composer (sticky, same 768px column)        |
+------------+----------------------------------------------+
```

| Metric | Value |
|--------|-------|
| sidebar expanded | 260–288px |
| sidebar collapsed rail | 56px (icons only, labels on hover tooltip) |
| top bar height | 56px |
| conversation column max-width | **768px** (~48rem) |
| column gutters | 16px mobile / 24–32px desktop |
| composer max-width | matches the column exactly — the alignment is load-bearing |
| gap between messages | 24–32px |
| artifacts side panel | ~40–50% viewport, min ~420px, pushes (not overlays) the column on desktop |

### 4.2 Vertical rhythm inside the conversation

- User turn and assistant turn are separated by 32px; consecutive blocks inside one turn by 16px.
- The assistant turn has **no bubble** — plain text on the page background, full column width.
  Only the *user* turn gets a container.
- The composer floats 16–24px above the viewport bottom with a soft fade of page background
  behind it (a gradient/mask, not a hard edge).

### 4.3 Responsive

| Breakpoint | Behavior |
|------------|----------|
| < 768px | sidebar becomes an overlay drawer + scrim; column is full-width with 16px gutters; artifacts open full-screen |
| 768–1279px | sidebar collapses to the 56px rail by default |
| ≥ 1280px | sidebar expanded; conversation column stays 768px and centers in the remaining space |

The column **never widens past 768px** regardless of viewport. Extra width becomes margin.

---

## 5. Radius, borders, elevation

### 5.1 Radius

| Token | Value | Applied to |
|-------|-------|------------|
| xs | 4px | inline code, tiny badges |
| sm | 6px | checkboxes, small chips |
| md | 8px | buttons, inputs, sidebar nav items |
| lg | 12px | cards, menus, code blocks, user message bubble |
| xl | 16px | dialogs, artifact panel |
| composer | 16–24px | the composer is the roundest thing on screen — deliberately |
| full | 9999px | avatars, model pills, icon buttons, the send button |

### 5.2 Borders

1px, always. Light `#E5E3DC`, dark `#3B3A37`. Two subtleties:

- Menus and dialogs in dark mode get a *lighter* top border (`rgba(255,255,255,0.08)`) to fake a
  light source. That one line does most of the work shadows would.
- Dividers inside menus are inset 8px from the edges, not full-bleed.

### 5.3 Elevation

| Level | Use | Shadow |
|-------|-----|--------|
| 0 | page, messages, sidebar | none |
| 1 | composer, cards | `0 1px 2px rgba(0,0,0,0.04)` + hairline |
| 2 | dropdowns, popovers, tooltips | `0 4px 16px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06)` |
| 3 | dialogs | `0 16px 48px rgba(0,0,0,0.14)` + scrim `rgba(0,0,0,0.4)` with 2px backdrop blur |

In dark mode shadow alpha roughly doubles and borders carry more of the separation.

---

## 6. Components

### 6.1 Sidebar

- Sections: **logo → New chat → search → Chats / Projects / Artifacts → Recents list → account footer**.
- Nav item: 34–36px tall, 8px radius, 8px horizontal padding, 10px gap between a 16px icon and a
  14px label, full-width click target, one-line truncate with ellipsis.
- Section header ("Recents"): 11–12px, `text-muted`, 16px top margin, 4px bottom.
- Recents rows show a per-row `...` menu on hover only (opacity 0 → 1, 120ms) — no persistent affordance.
- Footer: avatar + name + plan badge, opens the account menu upward.
- Collapse animates width over 200ms; labels fade at 100ms so text never squashes.

### 6.2 Message turns

| | User | Assistant |
|---|---|---|
| container | bubble, sunken surface, 12–16px radius | none — bare text |
| padding | 12px 16px | 0 |
| alignment | right-aligned bubble, max ~85% of column | full column width |
| actions | edit (hover) | copy · retry · thumbs, 13px icons, revealed on hover, pinned bottom-left |

Streaming text fades in per chunk (~120ms opacity ramp) with a caret block at the tail. No layout
shift while streaming — the scroll container pins to the bottom until the user scrolls up, then
releases and shows a "jump to latest" pill.

### 6.3 Composer

The single most designed element in the product:

- White (light) / `#30302E` (dark) surface, 1px hairline, 16–24px radius, level-1 shadow.
- Auto-growing textarea, min ~52px, max ~40% viewport then scrolls internally.
- Bottom row: attach `+` and model/tool pills on the left, send button on the right.
- Send button: 32px circle, accent fill, white glyph; **disabled = neutral muted fill**, not a
  faded orange.
- Focus: border darkens one step and the accent ring appears — the whole composer is the focus
  target, not the inner textarea.
- Attachments render as 8px-radius chips above the input with filename, type icon and remove `x`.

### 6.4 Buttons

| Variant | Fill | Text | Border | Use |
|---------|------|------|--------|-----|
| primary | accent `#D97757` | white | none | send, upgrade, confirm |
| secondary | surface | primary text | hairline | dialog cancel, secondary CTAs |
| ghost | transparent → neutral hover tint | secondary text | none | ~80% of buttons in the product |
| danger | transparent → `rgba(191,77,67,0.1)` | danger | none | delete |

Sizes: **sm** 28px (icon buttons in message actions), **md** 32–36px (default), **lg** 40px
(dialog CTAs). Horizontal padding 12/14/16px. Label is 14px/500. Icon buttons are square at the
same heights with a 16px centered icon.

### 6.5 Menus and popovers

12px radius, 4–6px internal padding, raised surface, level-2 shadow. Items are 32px tall, 8px
radius, 8px padding, 14px label with an optional 16px leading icon and a trailing shortcut hint in
`text-muted`. Selected items show a trailing check, **not** a filled background. Menus animate in
with `opacity 0→1` + `scale 0.97→1` over 120ms from the trigger edge.

### 6.6 Code blocks

- 12px radius, sunken surface, hairline border.
- Header strip: language label (13px, muted) left, copy button right, 36px tall, own hairline bottom.
- Body: 13px mono, 1.6 line-height, 12–16px padding, horizontal scroll (never wrap).
- Syntax colors are muted and warm — desaturated relative to typical editor themes so the block
  does not out-shout the prose.

### 6.7 Artifacts panel

Slides in from the right (240ms ease-out), pushing the conversation column left rather than
overlaying it. Header: title + version chevron + copy/download/close. Footer: preview ⇄ code
segmented control. 16px radius on the outer panel, square inner edge against the viewport.

### 6.8 Empty state

Centered, roughly 40% down the viewport: serif greeting ("Good evening, *name*") at 32–40px, the
composer directly under it, and a row of suggestion chips (pill radius, hairline, ghost fill,
13px) below. No illustration, no empty-state card.

---

## 7. Motion

| Interaction | Duration | Easing |
|-------------|----------|--------|
| hover / color change | 100–150ms | `ease-out` |
| menu, tooltip, popover | 120–160ms | `cubic-bezier(0.16, 1, 0.3, 1)` |
| sidebar collapse | 200ms | `ease-in-out` |
| artifacts panel | 240ms | `cubic-bezier(0.16, 1, 0.3, 1)` |
| dialog | 180ms fade + `scale 0.98 → 1` | `ease-out` |
| streaming text | ~120ms per-chunk fade | linear |

Principles: nothing moves more than ~8px; opacity carries most transitions; there are no
spring/bounce effects anywhere; everything respects `prefers-reduced-motion` (transitions drop to
opacity-only).

---

## 8. Iconography

Lucide-style line icons: 1.5–1.75px stroke, rounded caps and joins, 16px in dense UI, 20px in the
composer, 24px only for the logo mark. Icons inherit `text-secondary` and take `text-primary` only
on hover/active. No filled icons except the send glyph and status indicators.

---

## 9. Accessibility notes

- Text contrast: primary ink on cream ≈ **15:1**; secondary ≈ 7:1; muted ≈ 4.6:1 (reserved for
  non-essential metadata).
- **The accent orange on white is ~3.1:1** — below AA for text. That is why it is used as a
  *background* with white text and for links at 14px+ with an underline on hover. If you adopt
  this palette, darken to `#B85C3E` for accent-colored body text.
- Focus is always visible via a 2px accent ring at 2px offset — never `outline: none` without a
  replacement.
- Hover-revealed message actions stay reachable by keyboard (they also appear on `:focus-within`).

---

## 10. Copy-paste token block (Tailwind v4)

Drop-in for a `@theme` + `:root` setup like this repo's:

```css
:root {
  /* surfaces */
  --background:        #faf9f5;
  --surface:           #ffffff;
  --surface-sunken:    #f0eee6;
  --sidebar:           #f0eee6;

  /* text */
  --text:              #141413;
  --text-secondary:    #5c5b57;
  --text-muted:        #8a8880;
  --text-placeholder:  #a8a69e;

  /* lines */
  --border:            #e5e3dc;
  --border-strong:     #d6d3c9;

  /* accent */
  --accent:            #d97757;
  --accent-hover:      #c2603f;
  --accent-tint:       #f6ebe5;
  --accent-border:     #ead3c7;
  --ring:              rgba(217, 119, 87, 0.45);

  /* interaction */
  --hover:             rgba(0, 0, 0, 0.04);
  --pressed:           rgba(0, 0, 0, 0.07);
}

.dark {
  --background:        #262624;
  --surface:           #30302e;
  --surface-sunken:    #1f1e1d;
  --sidebar:           #1f1e1d;

  --text:              #f5f4ee;
  --text-secondary:    #c2c0b6;
  --text-muted:        #8f8d86;
  --text-placeholder:  #6f6d66;

  --border:            #3b3a37;
  --border-strong:     #4a4844;

  --accent:            #d97757;
  --accent-hover:      #e08a6c;
  --accent-tint:       rgba(217, 119, 87, 0.15);
  --accent-border:     rgba(217, 119, 87, 0.35);

  --hover:             rgba(255, 255, 255, 0.06);
  --pressed:           rgba(255, 255, 255, 0.10);
}

@theme inline {
  --font-sans:    "Inter Tight", ui-sans-serif, -apple-system, "Segoe UI", sans-serif;
  --font-display: "Instrument Serif", ui-serif, Georgia, serif;
  --font-mono:    ui-monospace, "JetBrains Mono", Consolas, monospace;

  --radius-xs: 4px;  --radius-sm: 6px;  --radius-md: 8px;
  --radius-lg: 12px; --radius-xl: 16px; --radius-2xl: 24px;

  --shadow-1: 0 1px 2px rgba(0,0,0,0.04);
  --shadow-2: 0 4px 16px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06);
  --shadow-3: 0 16px 48px rgba(0,0,0,0.14);

  --spacing-column: 768px;
  --spacing-sidebar: 272px;
  --spacing-sidebar-collapsed: 56px;
  --spacing-header: 56px;
}
```

---

## 11. What this means for bajat-v2

Our [DESIGN.md](DESIGN.md) and Claude's system agree on more than they differ — both are
neutral-first, hairline-bordered, one-accent, 4px-grid systems with a fixed radius ladder. The
real differences, and what is worth porting:

| Dimension | bajat-v2 today | claude.ai | Verdict |
|-----------|----------------|-----------|---------|
| Neutral temperature | cool grey (`#f4f4f5` / `#171717`) | warm cream + warm charcoal | **Portable and high-impact.** Swapping the neutral ramp warm is a ~20-line change in `globals.css` and is most of "the Claude look". |
| Page vs. card | grey page, white cards (§2.2) | cream page, white raised surfaces | Same idea, lower contrast delta. Ours reads better behind dense tables — keep ours. |
| Accent | violet `#7c3aed`, focus/selection only | orange `#D97757`, brand + primary CTA | Ours is deliberate (§2.1 Strategy A). Don't change the hue; do copy the *discipline* — neutral hover tints, accent reserved. Already our rule. |
| Radius | 4/6/8/12/14/16/20/24, controls pinned at 8px | 4/6/8/12/16 + a very round composer | Effectively identical. No change. |
| Typography | Geist sans, 13–14px UI | Styrene sans + a serif display accent | The serif-for-empty-states move is cheap and adds real character. Worth trying on dashboard empty states. |
| Content width | dashboard grid, full-bleed tables | hard 768px cap | Not applicable — we are a data app, not a reading app. |
| Elevation | shadows per §1.5 | hairlines, shadows only for floating layers | Claude's is stricter. Worth tightening ours for cards. |
| Motion | unspecified | 100–240ms, opacity-led, no springs | Directly adoptable as our motion spec. |

**If you want a "Claude-warm" theme variant**, the minimum viable change is: replace the neutral
ramp in `:root` / `.dark` in [app/globals.css](../app/globals.css) with §10's surface/text/border
values, leave `--accent-violet` and every component untouched, then check table zebra striping and
status-badge backgrounds against the new cream — those are the two places warm neutrals usually
break.
