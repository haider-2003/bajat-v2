# DESIGN.md

A design specification derived from a set of reference screenshots of modern
SaaS product UIs (task managers, CRM tables, AI dashboards, workflow builders,
billing panels). This document is the source of truth for rebuilding the
application's visual language.

**How to read this document**

- Values marked **(measured)** are read directly off the references, scaled to
  logical CSS pixels (references were captured at ~2x DPR; pixel readings were
  divided accordingly).
- Values marked **(inferred)** are reasoned extrapolations — the references
  don't show the state, so a rule consistent with everything else visible is
  proposed.
- Values marked **(derived)** are snapped to the nearest step of the spacing or
  type scale defined here, so the system stays internally consistent even where
  the reference is a pixel or two off.

---

## Table of contents

1. [Overall Design Language](#1-overall-design-language)
2. [Color System](#2-color-system)
3. [Typography](#3-typography)
4. [Layout & Spacing](#4-layout--spacing)
5. [Sidebar](#5-sidebar)
6. [Header / Top Navigation](#6-header--top-navigation)
7. [Buttons](#7-buttons)
8. [Tables](#8-tables)
9. [Cards](#9-cards)
10. [Forms & Inputs](#10-forms--inputs)
11. [Calendar / Date Picker](#11-calendar--date-picker)
12. [Dropdowns / Menus](#12-dropdowns--menus)
13. [Modals / Dialogs](#13-modals--dialogs)
14. [Badges / Statuses](#14-badges--statuses)
15. [Icons](#15-icons)
16. [Dark Mode](#16-dark-mode)
17. [Light Mode](#17-light-mode)
18. [Responsive Design](#18-responsive-design)
19. [Design Tokens](#19-design-tokens)
20. [Component Design Rules](#20-component-design-rules)

---

## 1. Overall Design Language

### 1.1 Philosophy

The references share one coherent style, best described as **quiet, dense,
data-first product UI with one loud accent**. Every screen follows the same
underlying contract:

1. **The chrome recedes; the data advances.** Sidebar, headers, toolbars and
   filters are rendered in muted greys with low-contrast type. The only
   high-contrast black text in a view is the *content*: task names, account
   names, metric values. Nothing in the chrome ever out-shouts a data row.
2. **Structure comes from background steps, not from lines.** Panels are
   separated primarily by a subtle background-value change (page grey vs. card
   white) plus a hairline. Heavy borders and heavy shadows are absent
   everywhere.
3. **Color is a signal, never a decoration.** The interfaces are 90–95%
   neutral. Color appears only in: status badges, status dots, avatar
   gradients, chart series, brand marks, and exactly one primary action button
   per screen. A screen never has two competing primary buttons.
4. **One high-contrast anchor per view.** Each screen has a single solid black
   (light mode) or solid white/violet (dark mode) button — `Add`, `New Agent`,
   `Add Balance`, `Create Account`, `Upgrade Plan`. This is the visual anchor of
   the whole layout.
5. **Density with air.** Rows are compact (44–52px) so a lot of data fits, but
   generous horizontal padding (16–24px) and a large empty right-hand gutter in
   toolbars keep it from feeling cramped.
6. **Rounded, but not soft.** Radii sit in the 6–12px band for controls and
   cards. Nothing is a sharp rectangle; nothing is a pill except badges,
   avatars, and search fields.

The overall character: **calm, precise, "expensive-looking" productivity
software.** It reads closer to Linear/Notion/Vercel than to Bootstrap or
Material.

### 1.2 Visual hierarchy

Hierarchy is built with **four levers, in this order of strength**:

| Lever | How it is used |
| --- | --- |
| 1. Text color | Primary content near-black (`#171717`); labels/meta at ~45–55% grey; placeholders at ~35%. This does most of the hierarchy work. |
| 2. Font weight | Only 400 / 500 / 600 are used. 600 is reserved for page titles, metric values, and section group names. Body and table cells are 400–500. |
| 3. Surface elevation | Page background (grey) → card (white) → popover (white + shadow). Three steps, never more. |
| 4. Size | The type scale is narrow: 11 → 30px. Big jumps are rare; a page title is only ~1.6x body size. |

Note what is **not** used: color for hierarchy (headings are never blue),
uppercase for headings (only for tiny sidebar section labels), or heavy rules
between sections.

### 1.3 Spacing and density

- Base unit: **4px**. Nearly every measurement lands on a multiple of 4, with
  6px and 10px appearing as half-steps inside small controls.
- **Control density is compact:** sidebar nav item 34–36px, toolbar buttons
  32–36px, table rows 44–52px. This is deliberately tighter than default
  Tailwind/shadcn sizing (h-10 = 40px) — buttons here are h-8/h-9.
- **Content density is comfortable:** card padding 20–24px, gaps between cards
  16–20px, page gutter 20–24px.
- The rule that emerges: **tight vertically, generous horizontally.** A table
  row is 48px tall but has 16–24px of padding on each side of its cells.

### 1.4 Border radius philosophy

Radius scales with the size and "physicality" of the element:

| Element | Radius | Note |
| --- | --- | --- |
| Badges, status pills, avatars, search field | `999px` (full) | Only truly pill-shaped things |
| Small chips / filter tokens | 6px | e.g. removable filter chips |
| Inputs, buttons, nav items, dropdown items | 8px | The workhorse radius |
| Cards, panels, table containers, dropdowns | 12px | |
| Modals, large panels, app window frame | 14–16px | |

Rule: **inner radius = outer radius − padding.** A 12px card with 8px padding
holding a nested block gives that block 6–8px. Never nest a larger radius
inside a smaller one.

### 1.5 Shadows and elevation

Shadows are **very soft, very low-opacity, and short-throw**. They imply a
millimeter of lift, not a floating card.

- **Cards and table containers: no shadow at all**, or at most a 1px hairline
  border plus `0 1px 2px rgba(0,0,0,0.04)`. Structure comes from the border.
- **Popovers, dropdowns, dialogs: real but soft shadow** — a large blur with
  ~8–12% black, layered with a tight 1px ambient shadow. This is the *only*
  place elevation is obvious.
- **Dark mode barely uses shadow at all** — see §16. Elevation there is
  communicated by making the surface *lighter*, not by casting a shadow.

Elevation ladder (light mode):

```
0  page background      no shadow
1  card / table         border only, optional 0 1px 2px rgba(0,0,0,.04)
2  sticky toolbar       0 1px 0 border-bottom (appears on scroll)  [inferred]
3  dropdown / popover   0 12px 32px rgba(0,0,0,.10), 0 1px 3px rgba(0,0,0,.06)
4  modal / dialog       0 24px 64px rgba(0,0,0,.16), 0 2px 8px rgba(0,0,0,.06)
```

### 1.6 Borders

- **Always 1px. Never 2px** except focus rings.
- Light mode borders are extremely light: `#EAEAEA` to `#EDEDED` — roughly 7%
  black. They read as a "seam", not a line.
- Dark mode borders are `#262626`–`#2A2A2A` — a *lightening* of the background
  rather than a darkening.
- Table interiors in light mode use **row separators only, no vertical column
  rules**. The dark CRM table is the exception: it uses a full grid (both
  horizontal and vertical hairlines) to sell the "spreadsheet" feeling.
- Borders and background steps are used **together but redundantly** — the
  card is both slightly lighter *and* outlined, so the boundary survives either
  cue failing.

### 1.7 Background treatments

- **Page background, light mode: a warm-neutral off-white/light grey**
  (`#F2F2F3`–`#F5F5F5`), never pure white. Cards on top are pure white. This
  inversion (grey page / white card) is a defining trait — do not build white
  pages with grey cards.
- **Page background, dark mode: near-black** (`#0A0A0A`–`#0F0F0F`) with cards
  at `#151515`–`#1A1A1A`.
- The workflow canvas uses a **subtle dot grid** on the page background (dots
  ~1px, ~20px pitch, at ~8% black) to signal "infinite canvas".
- One reference uses a **saturated multi-color gradient window frame** (violet
  → magenta → orange) behind a white app card — a marketing/hero treatment, not
  a product-chrome treatment. Keep gradients out of the app shell.
- Group headers in tables get a **tinted full-bleed band** matching their status
  color at ~6% opacity (grey / orange / green).

### 1.8 Surface / card hierarchy

Three surfaces, and only three:

| Level | Light | Dark | Used for |
| --- | --- | --- | --- |
| `background` | `#F4F4F5` | `#0A0A0A` | Page canvas, area behind cards |
| `surface` | `#FFFFFF` | `#161616` | Cards, tables, sidebar-adjacent panels |
| `surface-elevated` | `#FFFFFF` + shadow | `#1E1E1E` | Dropdowns, popovers, dialogs, tooltips |

The sidebar is a **fourth, special case**: in light mode it is often the *same*
grey as the page (`#F4F4F5`) with the content area white — so the content panel
appears to float. In dark mode the sidebar is the *darkest* surface.

### 1.9 Typography style

A single **geometric/neo-grotesque sans** across the entire UI — Inter-class
letterforms: tall x-height, open apertures, tabular-friendly digits, no
humanist calligraphy. Weights are restricted to 400/500/600; 700 never appears
in product chrome.

Two deliberate exceptions:

- **Monospace** for record identifiers (`XY-473`, `AB-156`) and command
  placeholders — a slightly narrower, tabular face at ~12px, letterspaced +0.2px.
- **A high-contrast serif display face** for the marketing hero headline only.
  It never appears inside the product.

### 1.10 Whitespace

Whitespace is used **asymmetrically and intentionally**:

- Toolbars leave a large empty middle gutter — left group (view tabs) and
  right group (Sort/Filter/View) are pushed apart, never centered.
- Tables end with a full-width empty column band on the right before the last
  column; the last column (avatars / actions) is right-aligned with 20–24px of
  trailing padding.
- Empty states get enormous vertical air — roughly 30–35% of the panel height
  above the illustration.
- Cards do *not* get generous whitespace; card padding is a tight, consistent
  20px. The air lives *between* cards, not inside them.

### 1.11 Overall feeling

> Precise, unhurried, and confident. Neutral to the point of austerity, then
> punctuated by a few saturated status colors and one solid black button. Every
> element sits on a 4px grid. Nothing glows, nothing bounces, nothing has a
> gradient except the avatars and the charts.

---

## 2. Color System

Colors are given as hex, with **semantic role first**. Names like `--blue-500`
are avoided except where the references genuinely imply a scale (status colors,
chart series).

### 2.1 Core brand / primary

The references use two distinct primary strategies. Pick one per product; do
not mix.

| Strategy | Primary | Where seen | Notes |
| --- | --- | --- | --- |
| **A — Neutral-primary (default, recommended)** | `#111111` black (light) / `#FFFFFF` white (dark) | Task app, CRM, AI dashboard, marketing hero | The "Add", "New Agent", "Create Account", "Upgrade Plan" buttons are solid black with white text. Highest possible contrast, zero hue. |
| **B — Violet-primary** | `#7C3AED` | Workflow builder ("Add new item", "Run"); documents app uses blue `#2563EB` | Used when a product wants a hue identity. |

**Recommendation:** use Strategy A for actions, and reserve a single accent hue
(`--color-accent`) for selection, focus, links, and active chart series. This
matches the majority of the references and keeps status colors unambiguous.

```
--color-primary            #111111   solid action buttons, primary text-on-light
--color-primary-hover      #000000
--color-primary-foreground #FFFFFF
--color-accent             #7C3AED   focus rings, selected borders, links
--color-accent-soft        #F3EEFF   accent-tinted backgrounds (selected rows)
```

### 2.2 Light mode palette

#### Backgrounds & surfaces

| Token | Hex | Usage |
| --- | --- | --- |
| `--color-background` | `#F4F4F5` | Page canvas. Also the sidebar background in the "floating panel" layout. Never pure white. |
| `--color-background-subtle` | `#FAFAFA` | Table group-header bands, sticky column tints, secondary strips. |
| `--color-surface` | `#FFFFFF` | Cards, table bodies, main content panel, sidebar in the "white sidebar" layout. |
| `--color-surface-elevated` | `#FFFFFF` | Dropdowns, popovers, modals — distinguished from `surface` by shadow, not hue. |
| `--color-surface-sunken` | `#F7F7F8` | Search input fill, command bar fill, segmented-control track. |
| `--color-overlay` | `rgba(15,15,15,0.32)` | Modal scrim. Note it is fairly *light* — the underlying table stays legible behind the share dialog. |

#### Borders

| Token | Hex | Usage |
| --- | --- | --- |
| `--color-border` | `#EAEAEA` | Default hairline: card outlines, table row separators, sidebar divider, input borders at rest. |
| `--color-border-strong` | `#D4D4D4` | Hovered inputs, focused-but-not-active controls, avatar ring. |
| `--color-border-subtle` | `#F1F1F1` | Separators *inside* a card where the default border is too loud (e.g. between metric rows). |

#### Text

| Token | Hex | Approx. opacity vs. white | Usage |
| --- | --- | --- | --- |
| `--color-text` | `#171717` | ~92% | Task names, account names, metric values, page titles, active nav item. |
| `--color-text-secondary` | `#525252` | ~68% | Inactive nav items, secondary cell values (dates, list names), card descriptions. |
| `--color-text-muted` | `#737373` | ~55% | Table column headers, timestamps, helper text, counts, "vs last 7 days". |
| `--color-text-placeholder` | `#A3A3A3` | ~36% | Input placeholders, "Add date" empty-cell affordance, disabled labels. |
| `--color-text-inverse` | `#FFFFFF` | — | Text on black primary buttons. |
| `--color-text-on-accent` | `#FFFFFF` | — | Text on violet/blue buttons. |

Note the **"Add date" empty-cell pattern**: an empty date cell is not blank —
it renders a muted calendar icon plus placeholder-grey "Add date" text, making
the empty cell an affordance rather than a hole.

#### Interaction states

| Token | Value | Usage |
| --- | --- | --- |
| `--color-hover` | `rgba(0,0,0,0.035)` → resolves ~`#F5F5F5` | Row hover, nav item hover, ghost button hover. A whisper, not a highlight. |
| `--color-active` | `rgba(0,0,0,0.06)` → ~`#EFEFEF` | Pressed state, selected nav item background. |
| `--color-selected` | `#F5F3FF` (accent-tinted) or `#F0F0F0` (neutral) | Selected table row. In the references the selected row is neutral-tinted *plus* gets a visible 1px outline on all four sides. |
| `--color-focus-ring` | `rgba(124,58,237,0.35)` | 2–3px outer ring on focused inputs. |

#### Status / semantic

Status colors always appear as **soft-tinted badge backgrounds with a saturated
text color**, never as saturated fills — except the small round status dots,
which are solid.

| Role | Text/dot | Background tint | Border (optional) | Seen as |
| --- | --- | --- | --- | --- |
| `success` | `#16A34A` | `#E8F8EE` | `#C6EFD6` | "Low" priority, "Completed" status, green dot on "In review", green resolution bars |
| `warning` | `#EA580C` | `#FFF1E7` | `#FFD9BF` | "In progress" group band + orange dot, usage-meter warning |
| `error` / `danger` | `#DC2626` | `#FEECEC` | `#FBD0D0` | "High" priority badge, escalations metric, negative delta `▼12.6%` |
| `info` | `#2563EB` | `#EAF1FE` | `#CFE0FD` | "Medium" priority badge, "In-review" status, blue chart bars |
| `neutral` | `#525252` | `#F2F2F2` | `#E5E5E5` | "Not set", "To-do", "Backlog" group, count chips |
| `accent` | `#7C3AED` | `#F3EEFF` | `#E3D8FF` | Selected/current items, "ORG" tag, primary workflow actions |

**Delta colors** (metric change indicators): positive `#16A34A` with `▲`,
negative `#DC2626` with `▼`. Rendered at 11–12px/500 next to the small
comparison label.

#### Gradients

Gradients appear in exactly four places, all decorative:

1. **Avatar/identity gradients** — every avatar and project icon is a
   2–3 stop diagonal (135°) gradient orb: violet→pink, cyan→blue, orange→red,
   green→teal, magenta→amber. Fully round for people, 6px-rounded square for
   projects/workspaces. This is the single most recognizable trait of the
   reference set.
   ```
   --gradient-avatar-1: linear-gradient(135deg, #A78BFA 0%, #F472B6 100%);
   --gradient-avatar-2: linear-gradient(135deg, #38BDF8 0%, #6366F1 100%);
   --gradient-avatar-3: linear-gradient(135deg, #FB923C 0%, #EF4444 100%);
   --gradient-avatar-4: linear-gradient(135deg, #34D399 0%, #06B6D4 100%);
   --gradient-avatar-5: linear-gradient(135deg, #F472B6 0%, #FBBF24 100%);
   ```
2. **Chart bar gradients** — vertical fade from full-saturation at top to
   ~35% at the baseline: `linear-gradient(180deg, #3B82F6 0%, #93C5FD 100%)`.
   Sparklines use a matching area fill fading to transparent.
3. **Brand/logo marks** — small rounded-square gradient tiles.
4. **Marketing hero frame** — a large violet→magenta→orange ambient gradient
   behind the browser chrome. Product-internal UI never does this.

### 2.3 Dark mode palette

Dark mode is **not an inversion**. The key differences from a naive invert:

- Backgrounds go to near-black, but **surfaces get *lighter* as they elevate**,
  the reverse of light mode where elevated surfaces stay white and gain shadow.
- Borders **lighten** the background rather than darkening it.
- Status colors are **desaturated slightly and lightened** so they hit ~4.5:1
  against a near-black background; their tinted backgrounds become *very* low
  alpha (10–14%) rather than the pastel tints used in light mode.
- Body text is **not pure white** — it sits at `#EDEDED` to avoid halation.

#### Backgrounds & surfaces

| Token | Hex | Usage |
| --- | --- | --- |
| `--color-background` | `#0A0A0A` | Page canvas / app frame. Nearly true black in the CRM reference. |
| `--color-background-subtle` | `#121212` | Table footer/summary bar, group-header bands. |
| `--color-surface` | `#161616` | Cards, table bodies, content panel. |
| `--color-surface-elevated` | `#1E1E1E` | Dropdowns, popovers, modals — **lighter**, plus a faint border. |
| `--color-surface-sunken` | `#111111` | Search field fill, input fill (inputs are *darker* than the card they sit on). |
| `--color-sidebar` | `#0D0D0D` | Sidebar is darker than the content panel. |
| `--color-overlay` | `rgba(0,0,0,0.60)` | Modal scrim — heavier than in light mode. |

Note the inversion of the input relationship: **light mode inputs are the same
white as the card with a border; dark mode inputs are darker than the card.**
Sunken-in-dark, flush-in-light.

#### Borders

| Token | Hex | Usage |
| --- | --- | --- |
| `--color-border` | `#262626` | Default hairline. In the CRM table this forms a full visible grid. |
| `--color-border-strong` | `#3A3A3A` | Hover borders, focused inputs, selected-row outline. |
| `--color-border-subtle` | `#1C1C1C` | Whisper-separators inside cards. |

#### Text

| Token | Hex | Usage |
| --- | --- | --- |
| `--color-text` | `#EDEDED` | Primary content. Never `#FFFFFF` for body copy. |
| `--color-text-secondary` | `#A1A1A1` | Secondary values, inactive nav. |
| `--color-text-muted` | `#7A7A7A` | Column headers, meta, footer aggregates ("Count", "Total: 120 accounts"). |
| `--color-text-placeholder` | `#5A5A5A` | Placeholders, disabled menu items (note the greyed-out "Settings / Support / Logout" rows in the account menu). |
| `--color-text-inverse` | `#0A0A0A` | Text on white primary buttons. |

#### Interaction states

| Token | Value | Usage |
| --- | --- | --- |
| `--color-hover` | `rgba(255,255,255,0.045)` | Row/nav hover. Additive white, not a hue. |
| `--color-active` | `rgba(255,255,255,0.08)` | Pressed / active nav background (visible on "Customers" and "Billing"). |
| `--color-selected` | `rgba(255,255,255,0.06)` + `--color-border-strong` outline | Selected row (the "Vertex Financial Services" row). |
| `--color-focus-ring` | `rgba(139,92,246,0.45)` | Focus ring, slightly brighter than light mode. |

#### Status / semantic (dark)

| Role | Text/dot | Background tint |
| --- | --- | --- |
| `success` | `#4ADE80` | `rgba(74,222,128,0.12)` |
| `warning` | `#FB923C` | `rgba(251,146,60,0.12)` |
| `error` | `#F87171` | `rgba(248,113,113,0.12)` |
| `info` | `#60A5FA` | `rgba(96,165,250,0.12)` |
| `neutral` | `#A1A1A1` | `rgba(255,255,255,0.07)` |
| `accent` | `#A78BFA` | `rgba(167,139,250,0.14)` |

Avatar and chart gradients stay **identical between modes** — they are already
mid-tone and read correctly on both. This is intentional: the identity colors
are theme-independent.

---

## 3. Typography

### 3.1 Font families

```
--font-sans: "Inter", "SF Pro Text", -apple-system, "Segoe UI", Roboto,
             "Helvetica Neue", Arial, sans-serif;
--font-mono: "JetBrains Mono", "SF Mono", "Roboto Mono", ui-monospace,
             Menlo, Consolas, monospace;
--font-display: "Instrument Serif", "Playfair Display", Georgia, serif;  /* marketing only */
```

- `--font-sans` carries ~98% of the UI.
- `--font-mono` is used for **record IDs** (`XY-473`, `CH-400`), keyboard hints
  (`⌘F`, `/`, `⌘,`), and command-palette placeholder text. It is set slightly
  smaller than adjacent sans text and letterspaced +0.2px.
- `--font-display` appears **only** in the marketing hero. Do not use it in the
  product.

Enable `font-feature-settings: "cv11", "ss01"; font-variant-numeric: tabular-nums;`
for all numeric table columns — the references show perfectly column-aligned
currency figures (`120,800.90` / `230,555.55`), which requires tabular figures.

### 3.2 Weights

| Weight | Where |
| --- | --- |
| 400 Regular | Table cell secondary values, descriptions, helper text, menu items |
| 500 Medium | Nav items, button labels, table primary cells, badges, column headers, tab labels |
| 600 Semibold | Page titles, metric values, card titles, group names, sidebar section labels, workspace name |

**700 is never used in product chrome.** If something needs more emphasis than
600, increase size or contrast instead.

### 3.3 Type scale

| Token | Size / Line-height | Weight | Tracking | Usage |
| --- | --- | --- | --- | --- |
| `--text-display` | 30px / 36px | 600 | −0.02em | Big metric values (`12,842`, `$184,290`, `94.6%`) |
| `--text-h1` | 20px / 28px | 600 | −0.015em | Page title ("Overview", "Customers", "Task views") |
| `--text-h2` | 16px / 24px | 600 | −0.01em | Card titles ("AI Inbox", "Top Performing Agents"), modal title, empty-state headline |
| `--text-h3` | 14px / 20px | 600 | −0.005em | Group headers ("Backlog", "In progress"), project-row titles in table views |
| `--text-body` | 14px / 20px | 400–500 | 0 | Table cells, nav items, menu items, button labels, input values |
| `--text-body-sm` | 13px / 18px | 400 | 0 | Card descriptions, secondary cell content, chat message text |
| `--text-caption` | 12px / 16px | 400–500 | 0 | Column headers, meta, timestamps, badges, helper text, breadcrumb |
| `--text-micro` | 11px / 14px | 500 | +0.04em | Count chips, delta indicators, chart axis labels, "Not signed up" tags |
| `--text-overline` | 11px / 14px | 600 | +0.08em, UPPERCASE | Sidebar section labels ("WORKSPACE", "PROJECTS", "SPACES"), metric-card labels |
| `--text-mono-id` | 12px / 16px | 500 | +0.02em, mono | Record IDs, keyboard shortcuts |

The scale is deliberately **compressed**: page title (20px) is only 1.43x body
(14px). Hierarchy is carried by weight and color, not by dramatic size jumps.

### 3.4 Line height & tracking rules

- UI text (single-line: nav, cells, buttons, badges) → line-height 1.4 or fixed
  to the control height.
- Prose (descriptions, chat bubbles, empty-state copy) → line-height 1.5–1.55.
- Display numbers → line-height 1.15–1.2, tight tracking (`−0.02em`).
- Uppercase micro-labels → always add letter-spacing (+0.06 to +0.08em);
  uppercase without tracking looks cramped at 11px.
- Never letterspace body text.

### 3.5 Contextual typography

**Table typography**

- Column header: 12px / 500 / `--color-text-muted`, sentence case (`Name`,
  `Due date`, `Start Date`), often followed by a 12px info icon.
- Primary cell (the identifying column): 14px / 500 / `--color-text`.
- Secondary cells (dates, list names, amounts): 14px / 400 /
  `--color-text-secondary`.
- Numeric cells: 14px / 400 / tabular-nums, right-aligned or currency-icon-led.
- ID cell: 12px mono / 500 / `--color-text-muted`.
- Footer aggregate row: 13px / 400 / `--color-text-muted`
  (`Total: 120 accounts`, `Sum: $20,530,760.90`).

**Button typography**

- 14px / 500 for default and large; 13px / 500 for small.
- No uppercase, no letterspacing.
- Icon-bearing buttons keep the label at the same weight; the icon does not get
  bolder.

**Navigation typography**

- Sidebar item: 14px / 500. Active item stays 500 — it changes *color and
  background*, not weight. (Important: do not bold the active nav item.)
- Sidebar section label: 11px / 600 / uppercase / +0.08em / muted.
- Trailing count: 11–12px / 400 / muted, right-aligned.
- Breadcrumb: 13–14px / 500, separator `/` at muted color.
- Tabs (List / Kanban / Gantt / Calendar): 14px / 500; active gains full text
  color + surface chip; inactive is `--color-text-secondary`.

---

## 4. Layout & Spacing

### 4.1 Spacing scale

A strict 4px base with two half-steps:

```
--space-0    0
--space-1    2px    hairline gaps, icon nudges
--space-2    4px    icon-to-count, badge inner vertical
--space-3    6px    badge inner horizontal, chip padding
--space-4    8px    icon-to-text, gap between adjacent buttons
--space-5   10px    nav item vertical padding
--space-6   12px    input horizontal padding, small card padding
--space-7   16px    table cell horizontal padding, card gap
--space-8   20px    card padding, page gutter (compact)
--space-9   24px    card padding (roomy), page gutter, section gap
--space-10  32px    major section separation
--space-11  40px    empty-state vertical rhythm
--space-12  48px    hero/empty-state top offset
--space-14  64px    large empty-state air
```

Rule: **any two adjacent components must be separated by a value from this
scale.** Never use 5, 7, 9, 11, 13, 15px.

### 4.2 App shell dimensions

| Region | Size | Notes |
| --- | --- | --- |
| App max width | fluid, no max | The shell fills the viewport; only marketing content is centered/constrained. |
| Rail (icon-only nav) | **48px** | Present in one reference as a slim icon strip left of the main sidebar. |
| Sidebar | **240–260px** (use **248px**) | Measured 240px in the AI dashboard, ~256px in the task app. |
| Sidebar (collapsed) | **56px** | Icons only, centered. *(inferred from the collapse toggle; not shown collapsed in the references)* |
| Header / top bar | **56px** | Measured 54–58px across references. |
| Toolbar / filter bar | **48px** | The second row (view tabs + Sort/Filter/View). |
| Content gutter | **20px** left/right, **20px** top | Between the content panel edge and its cards. |
| Content max width | fluid | Tables and dashboards stretch edge-to-edge; only text-heavy pages should cap at ~1200px. *(inferred)* |

Total chrome on the left when both rail and sidebar are present: 48 + 248 = **296px**.

### 4.3 Content grid

- **Dashboard metric row:** 4 equal columns, `gap: 16px`, each card ~1fr.
- **Dashboard main region:** a 3-column grid where the middle column is widest —
  approximately `1fr 1.35fr 1fr` with `gap: 16px`.
- **Secondary row:** 2 columns at roughly `1.6fr 1fr` (chart wide, list narrow).
- Grid gap is **16px** everywhere on dashboards; card padding is **20px**.
- Cards in a row are **equal height** (stretch), with internal content
  top-aligned.

### 4.4 Table spacing

| Property | Value |
| --- | --- |
| Header row height | 40px |
| Body row height | **48px** (compact variant 44px, roomy 52px) |
| Cell horizontal padding | 16px (first and last cell get 20–24px to align with panel gutter) |
| Cell vertical padding | 12px (or center-align at fixed row height) |
| Gap between icon and cell text | 8px |
| Group header band height | 44px |
| Gap between a group's header and its column header | 0 (they stack directly) |
| Gap between table groups | 20px |
| Footer/summary bar height | 48px |

### 4.5 Form spacing

- Label → input gap: **6px**
- Input → helper/error text gap: **6px**
- Field → next field gap: **16px**
- Field group → next group gap: **24px**
- Form → footer buttons gap: **24px**
- Footer buttons gap: **8px**, right-aligned
- Two-column form: `gap: 16px` column, `gap: 16px` row *(inferred from the
  "Create new card" panel, which shows stacked single-column fields with a
  side-by-side Card Type segmented pair)*

### 4.6 Alignment rules

1. **Everything left-aligns to a single content axis.** The page title, the
   toolbar's left group, the table's first column, and the card grid all share
   the same left edge.
2. **Right-side clusters are right-aligned to the opposite gutter** — search,
   settings, notifications, primary button; and in tables, the avatar/action
   column.
3. **Text is left-aligned; numbers are right-aligned only when they are
   comparable magnitudes in a column.** The CRM reference actually left-aligns
   its currency column behind a `$` icon — meaning: **when a currency glyph
   leads the cell, left-align; when it's bare figures, right-align.**
4. **Icons are optically centered on the text cap-height**, not on the line box
   — a 16px icon next to 14px text sits ~1px above the baseline midpoint.
5. Vertical centering inside all fixed-height controls (rows, buttons, nav
   items, badges).

### 4.7 Responsive breakpoints

```
--bp-sm   640px
--bp-md   768px
--bp-lg  1024px
--bp-xl  1280px
--bp-2xl 1536px
```

The references are all captured at ≥1280px logical width. Behavior below that
is documented in §18 and marked as inference.

---

## 5. Sidebar

### 5.1 Structure

The references show a consistent five-zone sidebar, top to bottom:

```
┌────────────────────────────┐
│ 1. Workspace switcher      │  logo + name + chevron + collapse toggle
├────────────────────────────┤
│ 2. Command / search field  │  optional; full-width, sunken
├────────────────────────────┤
│ 3. Primary nav             │  Home / Updates / Inbox / My tasks  (+ counts)
├──── divider ───────────────┤
│ 4. Sectioned nav           │  WORKSPACE / PROJECTS / SPACES  (collapsible,
│    (scrollable)            │  with nested children, hover "···" and "+")
├────────────────────────────┤
│ 5. Footer                  │  promo card, utility icons, user profile row
└────────────────────────────┘
```

### 5.2 Dimensions

| Property | Value |
| --- | --- |
| Width | **248px** (range measured 240–256) |
| Horizontal padding | 12px (nav items inset 8px from the panel edge) |
| Nav item height | **34px** primary, **32px** nested |
| Nav item horizontal padding | 10px |
| Nav item radius | **8px** |
| Icon size | **16px** (20x20 with 6px radius for the workspace logo tile) |
| Icon-to-label gap | **10px** |
| Vertical gap between items | **2px** |
| Section label height | 28px, with 12px of space above it |
| Nested indent | **28px** from the parent's text origin (aligns child text under parent text, not under the icon) |
| Divider | 1px `--color-border`, full width, with 8px above/below |
| Footer profile row height | 52px |

### 5.3 Backgrounds and borders

**Light mode** — two valid variants appear:

- **Variant A — "floating content" (task app, CRM, task-views app):** sidebar
  background = `--color-background` (`#F4F4F5`), the content area is a white
  panel with a 12px radius and a 1px border. The sidebar has **no right border**
  because the panel edge provides the seam.
- **Variant B — "white sidebar" (AI dashboard):** sidebar is `#FFFFFF`, content
  region is `#F7F7F8`, and a 1px `--color-border` right border separates them.

Choose one per product. Variant A is used in the majority of the references and
is recommended.

**Dark mode** — sidebar is the *darkest* surface: `#0D0D0D` against a `#161616`
content panel, with a 1px `#262626` right border.

### 5.4 States

| State | Light | Dark |
| --- | --- | --- |
| **Rest** | Transparent bg; label `--color-text-secondary`; icon `--color-text-muted` | Same, dark tokens |
| **Hover** | bg `rgba(0,0,0,0.04)`; label → `--color-text` | bg `rgba(255,255,255,0.045)` |
| **Active / current page** | bg `#FFFFFF` (in Variant A — the item becomes a small white chip on the grey sidebar) **plus** a 1px `--color-border` and a very soft `0 1px 2px rgba(0,0,0,.05)`; icon and label at `--color-text`; weight stays 500 | bg `rgba(255,255,255,0.08)`, no border, label `--color-text`, icon `--color-text` |
| **Selected sub-item (e.g. a month under a project)** | bg `rgba(0,0,0,0.05)`, no border, label `--color-text` | bg `rgba(255,255,255,0.06)` |
| **Pressed** | bg `rgba(0,0,0,0.07)` | bg `rgba(255,255,255,0.10)` |
| **Focus (keyboard)** | 2px `--color-focus-ring` outline, offset 1px *(inferred)* | same |

The **active-item-as-white-chip** detail is a signature of the light theme:
the current nav item looks like a small raised card sitting on the grey rail.

### 5.5 Nav item anatomy

```
[10px] [icon 16] [10px] [label 14/500 ..............] [8px] [count 11/400 muted] [10px]
```

- Trailing **count badges** (`44`, `20`, `48`, `99`, `12`, `23`) are plain muted
  numerals, right-aligned, **not** pill badges — a deliberately quiet treatment.
  `99` is used as the overflow cap (not `99+`).
- **`+` affordance:** some items ("My tasks", "Tasks") reveal a 16px `+` icon
  button on hover, replacing or sitting beside the count.
- **Chevron:** expandable items get a 14px chevron on the *right*, rotating
  0°→180° when open (pointing up when expanded). Section headers get a small
  chevron on the *left* of the label instead.

### 5.6 Section headers

```
[⌄] WORKSPACE                              ···   +
```

- 11px / 600 / uppercase / +0.08em / `--color-text-muted`.
- Leading collapse chevron at 12px, muted.
- Trailing `···` (overflow menu) and `+` (add) icon buttons at 14–16px, revealed
  on hover of the section header, muted color, `--color-text` on hover.

### 5.7 Nested navigation

- Projects expand into month/child rows.
- Children are **plain text with no icon**, indented so their text left edge
  aligns with the parent's *text* left edge (28px in from the panel padding).
- Child rows are 32px tall, 13–14px / 400, `--color-text-secondary`.
- Children carry the same right-aligned count treatment.
- Parent project rows have a **20x20 gradient rounded-square icon** (6px radius)
  and a trailing chevron.
- **Nested depth is capped at 2 levels** in every reference. Do not go deeper.

### 5.8 Icon rail (secondary, 48px)

One reference places a 48px icon-only rail to the left of the sidebar:

- Width 48px, same background as the sidebar.
- Icons 20px, centered, `--color-text-muted`.
- Active icon gets a 32x32 rounded-square (8px) chip at `--color-active` with
  the icon at full `--color-text`.
- Vertical gap between rail icons: 8px.
- Top holds the app logo; bottom holds theme toggle, account, settings, and a
  gradient brand tile.

### 5.9 Footer zone

Three sub-patterns appear:

1. **Promo / upsell card** — a 12px-radius bordered card containing a small
   video/preview thumbnail (16:9, 8px radius) with a play glyph, above a
   full-width solid black `Upgrade Plan` button (36px tall, 8px radius, 13–14px
   / 500 white text, with a 16px leading icon).
2. **Utility icon row** — Appearance / Profile / Settings as full nav items with
   16px icons and muted labels, sitting above the profile row. The "Appearance"
   item carries a trailing sun/moon glyph acting as the theme toggle.
3. **User profile row** — 52px tall:
   ```
   [12px] [avatar 28 round gradient] [10px] [ name 13/500 ] [8px] [⌃⌄ 14px] [12px]
                                            [ email 11/400 muted ]
   ```
   Some variants show a single-line name plus a `···` overflow button; others
   show name + email stacked with a vertical chevron-pair (`⌃⌄`) affordance
   signalling an account switcher. Hover gives the whole row `--color-hover`
   and an 8px radius.

### 5.10 Collapsed state

Only the *toggle* is visible in the references (a panel icon next to the
workspace name), never the collapsed result. **(inferred)** Proposed behavior:

- Width animates 248px → 56px over 150ms `ease-out`.
- Labels, counts, and section headers fade out (opacity 0, 80ms) before the
  width animation.
- Icons center horizontally; item height stays 34px; active chip becomes a
  34x34 rounded square.
- Section groupings collapse to a 1px divider.
- Hovering a collapsed item shows a tooltip with the label after 400ms.
- The footer profile row reduces to just the avatar, centered.

---

## 6. Header / Top Navigation

### 6.1 Anatomy

The product header is **two stacked rows** in the table-heavy references:

**Row 1 — Identity bar (56px)**
```
[20px] [icon] Tasks / [icon] Product Sprints ···   [avatars] [view toggle] [Search] [Add] [20px]
```

**Row 2 — View toolbar (48px)**
```
[20px] [List][Kanban][Gantt][Calendar][Dashboard][+ View] ··· [Group by Status][Sort][View][Filter][🔍] [20px]
```

The dashboard reference collapses this into a single 56px row
(`[Overview breadcrumb] ··· [Ask AI] [⚙] [🔔]`) followed by an in-content title
block (`Overview` + subtitle + date-range picker + primary button) rather than a
second chrome row.

### 6.2 Dimensions

| Property | Value |
| --- | --- |
| Identity bar height | **56px** |
| Toolbar height | **48px** |
| Horizontal padding | 20px |
| Gap between toolbar button groups | 8px |
| Gap within a button group (segmented) | 2px |
| Border below header | 1px `--color-border` (light) / `#262626` (dark) |

### 6.3 Background & borders

- Light: `--color-surface` (`#FFFFFF`) with a 1px bottom border. It does **not**
  pick up the page grey — the header belongs to the content panel.
- Dark: `#161616` with a `#262626` bottom border.
- The header is **sticky** at the top of the scroll container; on scroll it may
  gain `0 1px 0 --color-border` only (no drop shadow). *(inferred)*

### 6.4 Breadcrumb

- Format: `[icon] Parent  /  [icon] Current  ···`
- 14px / 500; the *current* segment is `--color-text`, ancestors are
  `--color-text-secondary`, separators `/` are `--color-text-placeholder`.
- Each segment carries a 16px leading icon in `--color-text-muted`.
- A trailing `···` overflow button appears on the current segment.

### 6.5 View tabs (segmented)

- Rendered as a **borderless row of ghost buttons**, not a boxed segmented
  control.
- Each tab: 32px tall, 12px horizontal padding, 8px radius, 16px leading icon,
  14px / 500 label, 8px icon-to-text gap.
- Inactive: transparent bg, `--color-text-secondary` label, muted icon.
- Active: `--color-surface` chip with 1px `--color-border` + `0 1px 2px
  rgba(0,0,0,.05)` in light mode; `rgba(255,255,255,.08)` in dark. Label goes to
  `--color-text`.
- `+ View` is a trailing ghost button with a 14px `+` icon.

An alternative appears in the task-views reference: **underline tabs** — no
chip, instead a 2px `--color-text` underline flush to the bottom border of the
toolbar, with the active label at full text color. Use one or the other per
product; the chip style is more common in the set.

### 6.6 Toolbar controls (Sort / Filter / View / Group by)

- Ghost/outline buttons, 32px tall, 10–12px horizontal padding, 8px radius.
- 14px leading icon + 13–14px / 500 label, 6px gap.
- `Group by Status` uses a **two-tone label**: "Group by" at
  `--color-text-secondary`, "Status" at `--color-text` / 500 — the value is
  emphasized inside the label. Reuse this pattern for all
  attribute-with-current-value controls.
- Some references outline these buttons (1px `--color-border`), others render
  them fully ghost. Rule: **outline them when they sit on a white surface;
  leave them ghost when they sit on grey.**

### 6.7 Search

Three forms:

1. **Button-style search** (identity bar): 32px tall, pill or 8px radius, 1px
   border, 14px magnifier icon + "Search" label at `--color-text-secondary`,
   12px horizontal padding.
2. **Field-style search** (sidebar / documents header): full-width, 32–34px
   tall, `--color-surface-sunken` fill, no border or a 1px hairline, 14px
   magnifier at `--color-text-placeholder`, placeholder text at
   `--color-text-placeholder`, and a **trailing keyboard hint** — `⌘F` or `/` —
   rendered as an 11px mono chip at `--color-text-placeholder`.
3. **Icon-only search** — a bare 32x32 ghost icon button, used at the far right
   of the toolbar.

### 6.8 Right-side cluster

Left-to-right ordering observed, and the recommended canonical order:

```
[collaborator avatar stack] [layout/density toggle] [search] [notifications] [settings] [PRIMARY ACTION]
```

- **Avatar stack:** 24px round gradient avatars, overlapping by **8px** (i.e.
  `margin-left: -8px`), each with a 2px `--color-surface` ring so they read as
  separate discs. Caps at 4–6 visible; the references do not show a `+N` chip,
  but adding one at the tail as a neutral 24px circle with 11px/500 text is a
  consistent extension. *(inferred)*
- **Icon buttons:** 32x32, 8px radius, 16–18px icon, ghost by default.
- **Notification bell** may carry a dot indicator: 6px circle,
  `--color-error`, positioned top-right with a 1.5px `--color-surface` ring.
- **Primary action:** solid black (light) / solid white (dark) pill-or-8px-radius
  button, 32–36px tall, with a 16px leading `⊕` icon and 14px / 500 label.

### 6.9 Page title block (when the header is single-row)

Sits inside the content area, not in the chrome:

```
Overview                                     [ May 12 – May 18, 2026 ]  [ + New Agent ]
Here's what's happening with your AI agents today.
```

- Title `--text-h1`; subtitle `--text-body-sm` / `--color-text-muted`, 4px below.
- Right cluster is vertically centered against the two-line title block.
- 24px of space below the block before the first card row.

### 6.10 Dark/light behavior

The header does not restructure between modes. Only tokens swap: surface, border,
text, and the primary button's polarity (black-on-white → white-on-black).
Icon-only ghost buttons keep the same 32px footprint; their hover fill flips
from `rgba(0,0,0,.04)` to `rgba(255,255,255,.045)`.

---

## 7. Buttons

### 7.1 Sizes

| Size | Height | Horizontal padding | Font | Icon | Icon gap | Radius |
| --- | --- | --- | --- | --- | --- | --- |
| `xs` | 24px | 8px | 12px / 500 | 12px | 4px | 6px |
| `sm` | 28px | 10px | 13px / 500 | 14px | 6px | 8px |
| `md` (default) | **32px** | 12px | 14px / 500 | 16px | 8px | 8px |
| `lg` | 36px | 14px | 14px / 500 | 16px | 8px | 8px |
| `xl` | 44px | 20px | 15px / 500 | 18px | 8px | 10px |

- **`md` (32px) is the default in product chrome.** `lg`/`xl` are for primary
  page actions and marketing CTAs.
- Icon-only buttons are **square**: 24/28/**32**/36/44 px.
- A button with a leading icon adds ~2px less trailing padding than leading —
  optically balancing the icon's visual weight. *(inferred, standard practice
  consistent with the references)*

### 7.2 Variants

#### Primary (solid)

| | Light | Dark |
| --- | --- | --- |
| Background | `#111111` | `#FFFFFF` |
| Text/icon | `#FFFFFF` | `#0A0A0A` |
| Border | none | none |
| Hover | `#000000` | `#F0F0F0` |
| Active | `#000000` + `scale(0.985)` *(inferred)* | `#E5E5E5` |
| Shadow | `0 1px 2px rgba(0,0,0,0.10)` | none |
| Disabled | bg `#E5E5E5`, text `#A3A3A3` | bg `#262626`, text `#5A5A5A` |

The violet variant (`#7C3AED` bg / white text, hover `#6D28D9`) is used where a
product has adopted Strategy B (see §2.1). Blue `#2563EB` appears in the
documents app for `Create`. **One primary button per view.**

#### Secondary (outline)

| | Light | Dark |
| --- | --- | --- |
| Background | `#FFFFFF` | `rgba(255,255,255,0.04)` |
| Text | `--color-text` | `--color-text` |
| Border | 1px `--color-border` | 1px `--color-border` |
| Hover | bg `#FAFAFA`, border `--color-border-strong` | bg `rgba(255,255,255,0.07)`, border `#3A3A3A` |
| Active | bg `#F2F2F2` | bg `rgba(255,255,255,0.10)` |
| Shadow | `0 1px 2px rgba(0,0,0,0.04)` | none |

Seen as: `Edit view`, `Edit projects`, `Share`, `See How It Works`, `Cancel`,
`View Profile`, `View all`, `Manage`.

#### Ghost

- Transparent background, no border.
- Text `--color-text-secondary`; icon `--color-text-muted`.
- Hover: bg `--color-hover`, text → `--color-text`.
- Active: bg `--color-active`.
- Used for: toolbar controls, view tabs, icon buttons, sidebar nav, `···`
  overflow, table row actions.

#### Ghost-with-value (toolbar variant)

The `Group by Status`, `Sort`, `Filter`, `View` pattern: ghost button whose
label mixes muted attribute text with full-contrast value text. When a filter is
*applied*, the reference shows a count in parentheses — `Filter (0)` — at the
same muted weight; when non-zero it should shift to `--color-text` and gain the
accent-tinted background. *(inference for the non-zero state)*

#### Destructive

Not present as a filled button in the references; only as **destructive icon
buttons** — the trash icons in the share dialog's access list, rendered as
16px muted icons that go to `--color-error` on hover.

Proposed full set **(inferred, consistent with the system)**:

| | Light | Dark |
| --- | --- | --- |
| Solid | bg `#DC2626`, text white, hover `#B91C1C` | bg `#EF4444`, text `#0A0A0A`, hover `#DC2626` |
| Outline | border `#FBD0D0`, text `#DC2626`, hover bg `#FEECEC` | border `rgba(248,113,113,.3)`, text `#F87171`, hover bg `rgba(248,113,113,.12)` |
| Ghost | text `--color-text-secondary`, hover text `#DC2626` + bg `#FEECEC` | hover text `#F87171` + bg `rgba(248,113,113,.12)` |

#### Link button

- No padding, no background. 14px / 500.
- Light: `--color-text` with underline on hover (`Learn more`, `View all
  conversations`, `Check it out`, `Dismiss`).
- Accent-colored links (`Learn more` in the usage panel) use `--color-accent`
  with underline.
- External-link items carry a trailing 12px ↗ glyph.

#### Icon button

- Square, ghost by default (see sizes above).
- Icon at `--color-text-muted`; hover bg `--color-hover` and icon →
  `--color-text`.
- Radius 8px (6px at `xs`).
- Used for: `···` overflow, `+` add, chevrons, close `×`, notification bell,
  settings gear, row-level actions.

#### Full-width button

Sidebar CTA (`Upgrade Plan`), empty-state CTA (`New document`), and form
submits: `width: 100%`, height 36–40px, centered content, leading 16px icon.

### 7.3 Universal button rules

- **Focus:** `outline: 2px solid --color-focus-ring; outline-offset: 2px;`
  Never remove focus rings; never rely on the hover style for focus.
  *(inferred — no focus state is visible in the references)*
- **Disabled:**
  - Solid → muted grey fill, muted text, `cursor: not-allowed`, no shadow.
  - Outline/ghost → text and icon at `--color-text-placeholder`, border at
    `--color-border-subtle`, background unchanged.
  - `opacity` is **not** used to fake disabled; explicit tokens are.
  - The dark account menu shows this exact behavior: `Settings`, `Support`,
    `Logout` render at `--color-text-placeholder` while `Billing` (enabled,
    hovered) is at full contrast.
- **Loading:** replace the leading icon with a 14px spinner at the label color,
  keep the label, lock the width to prevent reflow, set `aria-busy`. *(inferred)*
- **Transitions:** `background-color 120ms ease, border-color 120ms ease,
  color 120ms ease`. No transform on hover; a `scale(0.985)` on `:active` is
  acceptable. Nothing in the references suggests bouncy or long animations.

### 7.4 Premium (raised) button

A dimensional treatment of the solid button, taken from the "Add Candidate" and
"Upgrade" references. Where §7.2 Primary is a **flat** `#111` fill, this variant
reads as a physical, slightly raised control: the face catches light along its
top edge and casts a short shadow onto the page.

**Use it for the one hero action on a focused, full-page surface** — sign-in
submits, upgrade CTAs, empty-state primaries. It is deliberately *not* the
default in product chrome: §1.5 keeps app surfaces flat, and a raised control in
a dense toolbar fights the table and card hierarchy. One per view, same as
Primary.

Implemented at [`app/login/premium-button.tsx`](../app/login/premium-button.tsx),
scoped to the login route. `components/ui/button.tsx` is untouched.

#### Anatomy

Six layers stack to produce the depth. Every one is load-bearing — dropping any
single layer flattens the button:

| # | Layer | Value (light) | What it does |
| --- | --- | --- | --- |
| 1 | Surface gradient | `linear-gradient(180deg, --pb-top 0%, --pb-mid 52%, --pb-bot 100%)` | Top-lit face. The midpoint at 52% keeps the falloff from reading as a linear wash |
| 2 | Rim | `1px solid --pb-rim` + `background-clip: padding-box` | Defines the silhouette against a light page |
| 3 | Top highlight | `inset 0 1px 0 rgba(255,255,255,.16)` | The bevel. **This is the layer that sells it** |
| 4 | Inner rim light | `inset 0 0 0 1px rgba(255,255,255,.045)` | Stops the border reading as a flat cut |
| 5 | Contact shadow | `0 1px 2px rgba(12,12,16,.32)` | Anchors it to the surface |
| 6 | Soft lift | `0 5px 14px -4px rgba(12,12,16,.28)` | The millimeter of elevation (§1.5) |

#### Geometry & type

| Property | Value |
| --- | --- |
| Height | 40px |
| Horizontal padding | 20px |
| Radius | 14px (`--radius-xl`) — **not** the 8px control radius |
| Label | 15px / 500, `letter-spacing: -0.01em` |
| Icon | 16px, 8px gap, `stroke-width: 2` |

The 14px radius is the tell. At the 8px control radius the same shadow stack
reads as a generic dark button; the softer corner is what makes it feel like a
discrete object rather than a filled rectangle.

#### Color tokens

Color lives in **four custom properties**, never in the shadow stack. A tone
restates only these four values, so every tone inherits an identical highlight,
rim, lift, and press feel:

| Tone | `--pb-top` | `--pb-mid` | `--pb-bot` | `--pb-rim` |
| --- | --- | --- | --- | --- |
| `ink` (default) | `#2A2A2F` | `#1A1A1D` | `#131316` | `#0C0C0E` |
| `violet` | `#8B6CFF` | `#6F47F0` | `#5E35DC` | `#3D1FA4` |
| `blue` | `#5292FF` | `#2F70E6` | `#2360CD` | `#164390` |
| `emerald` | `#36C47A` | `#1BA362` | `#128A52` | `#0A5C37` |
| `amber` | `#F5AD46` | `#E28D1E` | `#C87613` | `#8B4E09` |
| `rose` | `#F76E77` | `#E2444F` | `#CB3441` | `#8F1F2B` |

Label is `#F7F7F8` on every tone — off-white, not pure `#FFF`, matching the §16.1
text ceiling.

**Rules for deriving a new tone:**

1. `--pb-top` is the base lightened ~12%, `--pb-bot` darkened ~8%. Any wider
   spread becomes a visible gradient and violates §1.1.
2. `--pb-rim` is **always darker than `--pb-bot`** — roughly 60% luminance of it.
   A rim lighter than the fill turns the bevel inside out.
3. Keep the hue constant across all four stops. Shifting hue between stops reads
   as cheap chrome.

#### States

| State | Treatment |
| --- | --- |
| Default | The six layers above |
| Hover | White wash `linear-gradient(180deg, rgba(255,255,255,.10), transparent 60%)` fades in; highlight → `.22`, lift → `0 8px 20px -5px` |
| Active | `translate-y(1px)`, outer lift **removed**, replaced by `inset 0 1px 2px rgba(0,0,0,.45)` |
| Focus | `ring-2 --ring` at `ring-offset-2` — the violet focus ring per §2.1, never the hover style |
| Disabled | `background-image: none`, flat `#3F3F46`/45%, text `#FFF`/55%, all shadows removed |

The hover brighten is a separate `::after` element rather than a second
gradient, because **gradient color stops do not interpolate** — swapping the
custom properties on hover snaps instead of animating. The overlay sits at
`-z-10` under an `isolate` stacking context, which paints it above the button's
own background but below the label.

Transition: `box-shadow, transform, background-color, color` at `150ms ease-out`
— slightly longer than the 120ms in §7.3 because the shadow stack is doing the
work, and shadow needs a beat more than a flat color swap.

#### Press behavior

The pressed state is the one place this variant breaks §7.3's "no transform"
rule. Removing the outer lift *and* sinking 1px *and* adding an inner shade are
what make it read as depressed; a `scale(0.985)` alone reads as a UI glitch on a
control this size.

#### Dark mode

Per §16.1 shadows do not read on a near-black ground, so the outer lift is
dropped and elevation is carried by making the surface *lighter* than the page:

| | Value |
| --- | --- |
| Gradient | `#2E2E34 → #202024 → #1A1A1E` |
| Rim | `rgba(255,255,255,.10)` — lightens instead of darkening |
| Shadow | `inset 0 1px 0 rgba(255,255,255,.10), 0 1px 2px rgba(0,0,0,.5)` |

Note this **intentionally departs from §7.2**, where Primary inverts to
white-on-black in dark mode. The premium variant stays dark in both themes
because its identity is the black surface; inverting it produces a flat white
pill with nothing left of the recipe.

#### Companion (`soft`)

The white secondary that pairs with it — the "Run AI" button beside "Add
Candidate". Same 40px/14px geometry, `--surface` face, `--border` hairline, and
an `inset 0 1px 0 rgba(255,255,255,.9)` top light so it belongs to the same
family rather than reading as a §7.2 outline button that wandered in.

---

## 8. Tables

Tables are the centerpiece of this design language. Four distinct table
treatments appear across the references; they share a common skeleton.

### 8.1 The table archetypes

| Archetype | Seen in | Defining traits |
| --- | --- | --- |
| **A. Grouped list table** | Task app (Backlog / In progress / In review) | No outer container; groups are separate blocks each with a colored group header band and their *own repeated* column header row. Row separators only. |
| **B. Grid / spreadsheet table** | CRM (dark) | Full 1px grid — horizontal *and* vertical rules. Typed column headers with leading icons. Sticky footer aggregate bar. |
| **C. Compact data table** | Charges list, Top Performing Agents | Header row with a background tint, hairline row separators, inline status glyphs and mini bar-meters. |
| **D. Nested project table** | Task views | Each project is a card containing its own header + table; cards stack with 16px gaps. |

### 8.2 Container

- Light: `--color-surface` (`#FFFFFF`), 12px radius, 1px `--color-border`.
  Archetype A drops the border entirely and lets the white content panel serve
  as the container.
- Dark: `#161616` with `#262626` grid lines; the outer container often has no
  extra border because the grid supplies it.
- `overflow: hidden` on the container so the first/last row corners clip to the
  radius.
- Horizontal overflow scrolls **inside** the container, never on the page body.

### 8.3 Header row

| Property | Value |
| --- | --- |
| Height | 40px |
| Background | Archetype A: transparent (sits on the card). Archetype B/C: `--color-background-subtle` (`#FAFAFA` / `#121212`). |
| Typography | 12px / 500 / `--color-text-muted`, sentence case |
| Border-bottom | 1px `--color-border` |
| Leading icon | Archetype B only: a 14px type-glyph indicating the column's data type (person, team, currency, date, text). `--color-text-muted`. |
| Trailing icon | A 12px ⓘ or ⌄ affordance at `--color-text-placeholder`, revealed on hover for sort/menu |
| Sticky | Header sticks to the top of the scroll container |

**Type-glyph headers are a strong signature of archetype B** — `👤 Lead`,
`👥 Team`, `＄ Amount`, `📅 Start Date`. They tell the user what kind of value
lives in the column before reading a single row. Adopt this for any
database-like table.

### 8.4 Group headers (archetype A)

```
[●] Backlog  [12]                                          ···  ⊕
```

- Full-bleed band, 44px tall, 12px radius (or 8px), 16px horizontal padding.
- Background is the group's status color at **~6% alpha**: neutral `#F2F2F2`,
  orange `#FFF4EC`, green `#EDF9F1`.
- Leading **status dot**: 8px solid circle in the full status color.
- Group name: 14px / 600, `--color-text`.
- Count chip: 11–12px / 500 in a 20px-tall neutral rounded chip (6px radius),
  `--color-text-muted` on `rgba(0,0,0,.05)`.
- Trailing `···` and `⊕` icon buttons, 16px, muted, revealed on hover.
- 20px of space between the end of one group and the next group's band.

### 8.5 Body rows

| Property | Value |
| --- | --- |
| Height | **48px** |
| Vertical alignment | center |
| Separator | 1px `--color-border` bottom; **no** separator after the last row |
| Vertical rules | Archetype A/C/D: none. Archetype B: 1px `--color-border` between every column. |
| Zebra striping | **Not used anywhere.** Do not add it. |
| First cell padding-left | 20–24px |
| Last cell padding-right | 20–24px |
| Inter-cell padding | 16px each side |

### 8.6 Cell content patterns

- **Identifier + name:** a mono ID cell (`XY-473`) followed by the name cell at
  14px / 500. The ID column is ~72px wide, muted.
- **Icon + text:** 16px icon at `--color-text-muted`, 8px gap, then the label
  (`⋮≡ UXR`, `⋮≡ Marketing`). Used for list/category columns.
- **Entity cell:** 20px gradient orb/tile + 8px gap + 14px / 400 name
  (`Global Dynamics Corp`, `John Sir`).
- **Editable cell:** carries a trailing 14px `⌃⌄` stepper glyph at
  `--color-text-placeholder`, signalling "click to change" (used across Lead
  and Team columns in the CRM).
- **Avatar stack cell:** 20–22px avatars overlapping by 8px with a 2px surface
  ring; count varies per row (1–6 visible); left-aligned in the Team column,
  right-aligned in the Assignee column.
- **Empty cell:** never blank — renders `[icon] Add date` in
  `--color-text-placeholder` with a 14px calendar icon.
- **Row hover actions:** a `···` button fades in immediately after the row's
  primary text (not at the row's far right) — see the `Evaluate Market Trends`
  row. Opacity 0 → 1 on row hover.
- **Numeric/currency:** leading 14px `＄` glyph in `--color-text-muted`, then
  tabular figures at `--color-text`. Two decimals always shown.
- **Progress meter:** a 6px-tall segmented bar (≈20 discrete 2px ticks with 1px
  gaps) rendered in the status color, sitting to the right of the percentage
  value. Filled ticks use the full status color; empty ticks are
  `--color-border`. This segmented style — rather than a continuous bar — is
  distinctive and worth reproducing.
- **Inline status glyph:** a 14px filled-circle check in `--color-success`
  before the word "Completed".

### 8.7 Row states

| State | Light | Dark |
| --- | --- | --- |
| Hover | bg `rgba(0,0,0,0.025)`; row actions fade in; cursor pointer | bg `rgba(255,255,255,0.035)` |
| Selected | bg `#FAFAFA` **plus a full 1px `--color-border-strong` outline on all four sides**, and the row's radius becomes 8px — it lifts out of the list rather than just tinting | bg `rgba(255,255,255,0.06)` + 1px `#3A3A3A` outline, 8px radius |
| Focused (keyboard) | 2px `--color-focus-ring` inset outline *(inferred)* | same |
| Disabled/loading row | content at `--color-text-placeholder`, no hover | same |

The **outlined selected row** is the most distinctive interaction detail in the
reference set — visible on `AB-156 Evaluate Market Trends` (light) and
`Vertex Financial Services` (dark). It reads as "this row is picked up".

### 8.8 Footer / summary bar

Seen in the dark CRM table:

- 48px tall, `--color-background-subtle`, 1px top border, sticky to the bottom
  of the scroll container.
- Each cell shows an **aggregate control**: a 14px Σ/list glyph + the aggregate
  label at 13px / 400 `--color-text-muted` — `Total: 120 accounts`, `Count`,
  `Sum: $20,530,760.90`.
- Columns without a configured aggregate still show a clickable `Count`
  placeholder, making the footer an affordance rather than static text.

### 8.9 Pagination

No numeric pagination control appears in any reference — every table uses
**continuous vertical scroll** with a sticky header (and sticky footer where
present) and a count in the group header or footer bar.

**Recommendation:** default to infinite scroll / virtualized scroll with a
sticky header and a total count. If pagination is required **(inferred)**:
place it in a 52px bar below the table, left side showing
`Showing 1–25 of 120` at 13px muted, right side a group of 28px ghost icon
buttons (`‹`, `›`) plus a compact page-size select. No numbered page pills —
they would be out of character.

### 8.10 Empty state

From the documents reference:

- Centered vertically in the panel with roughly 30% of the panel height above.
- **Illustration:** a ~140px light grey rounded-square outline containing a
  simple line glyph, drawn at 1.5px stroke in `--color-border-strong`.
- **Headline:** 16px / 600 `--color-text` — "Oops! There's nothing here…"
- **Body:** 13px / 400 `--color-text-muted`, max-width ~320px, centered, 8px
  below the headline.
- **CTA:** a primary button 20px below the body, with a leading `⊕` icon.
- Above the empty region, the "create new" quick-action cards remain visible —
  the empty state does not blank the whole page, only the list region.

### 8.11 Loading state

Not shown. **(inferred)** Proposal consistent with the language:

- Skeleton rows at the real 48px row height, with rounded (4px) grey bars at
  `--color-background-subtle` (light) / `rgba(255,255,255,.04)` (dark),
  sized to each column's typical content width (not full-width bars).
- Subtle opacity pulse, 1.6s, `ease-in-out`. No shimmer sweep — too flashy for
  this language.
- Header row renders immediately with real column labels; only the body is
  skeletonized.
- Show 6–8 skeleton rows.

### 8.12 Responsive behavior

**(inferred, with support from the layout structure)**

- ≥1280px: all columns visible.
- 1024–1280px: lowest-priority columns (list/category, secondary dates) drop
  out or the table gains horizontal scroll within its container. The identifier
  column becomes sticky-left with a 1px right border and a subtle shadow.
- <1024px: switch to a **stacked card list** — each row becomes a card showing
  the primary name, a status badge, and 2–3 key/value pairs at 12px, with the
  avatar stack at the bottom. This preserves the density philosophy better than
  a squeezed 8-column table.
- The group-header + count pattern survives all breakpoints unchanged.

### 8.13 Why these tables feel modern

1. **Hairlines instead of boxes** — a single 1px separator per row, no vertical
   rules in list-style tables.
2. **No zebra striping** — hierarchy comes from text color, not row fill.
3. **Empty cells are affordances**, not blanks (`Add date`).
4. **Typed column headers** with data-type glyphs.
5. **Selected rows get an outline, not just a tint** — it makes selection feel
   physical.
6. **Row actions appear on hover** in-line after the content, not stranded in a
   far-right column.
7. **Aggregates live in a sticky footer** and are themselves interactive.
8. **Gradient avatar stacks** add all the color the table needs, replacing what
   would otherwise be colored chips everywhere.
9. **Tabular figures** keep number columns optically aligned.
10. **Compact 48px rows with 16–24px horizontal padding** — dense without being
    tight.

---

## 9. Cards

### 9.1 Base card

| Property | Light | Dark |
| --- | --- | --- |
| Background | `#FFFFFF` | `#161616` |
| Border | 1px `#EAEAEA` | 1px `#262626` |
| Radius | **12px** | 12px |
| Shadow | none, or `0 1px 2px rgba(0,0,0,0.04)` | none |
| Padding | **20px** (compact 16px, roomy 24px) | same |
| Gap between cards | 16px | 16px |

Cards **never** use a heavy shadow. If a card needs to feel raised, it becomes a
popover (§12), not a shadowed card.

### 9.2 Card header

```
Total Conversations                                   [optional action / View all]
```

- Title: `--text-h2` (16/600) for content cards, or `--text-caption` (12/500
  muted) for metric-card labels.
- Optional leading **icon tile**: 28–32px rounded square (8px radius) with a
  status-tinted background and the icon in the matching saturated color —
  green tile for Total Conversations, blue for AI Resolution, orange for
  Conversion Rate, red/pink for Escalations. This is how metric cards get their
  color identity.
- Optional trailing action: a `View all` link button (13px / 500) or a `···`
  icon button, right-aligned and vertically centered with the title.
- Header-to-body gap: 16px.
- Content cards with a list body (AI Inbox, Top Performing Agents) put the
  header inside the same 20px padding, then let the list run full-bleed to the
  card's inner edges.

### 9.3 Card body

- Metric card: label row → 30px/600 value → sparkline (right-aligned, ~96x36px)
  → comparison row (`vs last 7 days` muted 12px, plus a colored delta chip).
- List card: rows at 48–56px with 1px `--color-border-subtle` separators, full
  card width, 20px horizontal padding.
- Chart card: title + big value + delta stacked at top-left, chart occupying the
  remaining height with 12px axis labels in `--color-text-muted` and horizontal
  gridlines at `--color-border-subtle`.

### 9.4 Card footer

- 1px `--color-border-subtle` top border, 12–16px vertical padding.
- Typically a single link button or a right-aligned button pair.
- Seen as: `View all conversations` (centered, full-width, muted 13px/500) at
  the bottom of the AI Inbox card.

### 9.5 Card types catalogue

| Type | Distinguishing features |
| --- | --- |
| **Metric / KPI card** | Icon tile + label, 30px value, sparkline, delta row. Fixed height in a 4-up grid. |
| **List card** | Header with count badge, scrollable list body, footer link. |
| **Chart card** | Title + hero value + delta, then a bar/line chart with a 12px axis. |
| **Donut/gauge card** | Semicircular multi-segment gauge with a centered total, plus a legend list below (dot + label + value + percentage), each legend row 24px tall. |
| **Table card** | Header + embedded compact table (archetype C), no card padding on the table itself. |
| **Quick-action card** | Small horizontal card: 32px colored icon tile + title 14/500 + description 12/400 muted. Used in a 4-up row above the documents empty state. Hover raises the border to `--color-border-strong`. |
| **Promo card** | Sidebar footer: thumbnail + full-width primary button. |
| **Node card** (workflow canvas) | Small white card with 12px radius, 1px border, soft shadow, 16px icon at left, an 11px muted eyebrow label above a 14px/500 title, and a trailing `···`. Connected by 1px vertical lines with 20px gaps. |

### 9.6 Hover behavior

Cards are mostly **static**. Only *interactive* cards (quick actions, node
cards, clickable list items) respond:

- Border: `--color-border` → `--color-border-strong`
- Background: unchanged in light mode; `+2%` white in dark mode
- Shadow: none → `0 2px 8px rgba(0,0,0,0.06)` in light mode only
- No lift/translate. Transition 120ms.

Selected node cards in the workflow canvas gain a 1px `--color-accent` border
(no glow).

### 9.7 Light vs. dark differences

- Light: the card is **lighter** than the page (white on grey) and relies on the
  border for its edge.
- Dark: the card is **lighter** than the page too (`#161616` on `#0A0A0A`) —
  the direction is consistent. The border becomes the *secondary* cue, the
  value step becomes primary.
- Shadows essentially disappear in dark mode; a shadow on `#161616` over
  `#0A0A0A` is invisible, so elevation is carried entirely by lightness.

---

## 10. Forms & Inputs

### 10.1 Text input

| Property | Light | Dark |
| --- | --- | --- |
| Height | **36px** (compact 32px, large 40px) | same |
| Background | `#FFFFFF` | `#111111` (darker than the card it sits on) |
| Border | 1px `#EAEAEA` | 1px `#2A2A2A` |
| Radius | 8px | 8px |
| Horizontal padding | 12px (36px left when a leading icon sits at 12px) | same |
| Font | 14px / 400, `--color-text` | same |
| Placeholder | `--color-text-placeholder` (`#A3A3A3` / `#5A5A5A`), 14px / 400 | same |
| Hover | border → `--color-border-strong` | border → `#3A3A3A` |
| Focus | border → `--color-accent`, plus `0 0 0 3px rgba(124,58,237,0.15)` ring | border → `#A78BFA`, ring `rgba(167,139,250,0.20)` |
| Disabled | bg `#FAFAFA`, text & placeholder `--color-text-placeholder`, border `--color-border-subtle`, `cursor: not-allowed` | bg `#0F0F0F`, text `#5A5A5A` |
| Error | border `--color-danger`, ring `rgba(220,38,38,0.12)` | border `#F87171`, ring `rgba(248,113,113,0.16)` |
| Success | border `--color-success` (used sparingly, e.g. after async validation) | `#4ADE80` |

Observed examples: `Enter name or email to invite…`, `Add internal note…`,
`e.g. Travel` nickname field, `Search a template`, `Search`.

**Leading/trailing adornments**

- Leading icon: 16px at `--color-text-placeholder`, 8px gap to the text.
- Trailing icon buttons (emoji, attach, send in the note composer): 16px, 8px
  apart, muted; the *send* button is the exception — a 28x28 filled accent/blue
  rounded square (8px radius) with a white 14px glyph.
- Trailing keyboard hint: 11px mono chip, `--color-text-placeholder`.

### 10.2 Search input

Distinguished from a plain text input by:

- **Sunken fill** (`--color-surface-sunken`) rather than white, often with no
  border at all.
- Full pill radius in the header context; 8px radius in the sidebar context.
- Always a leading 14–16px magnifier at `--color-text-placeholder`.
- Optional trailing shortcut chip (`⌘F`, `/`).
- On focus, gains the standard accent border + ring and the fill lightens to
  `--color-surface`.

### 10.3 Select / dropdown trigger

- Same box metrics as a text input (36px, 8px radius, 1px border).
- Trailing 14px chevron-down, or the **`⌃⌄` double-chevron** used in the CRM
  cells and account switcher — the double form signals "cycle/choose among
  values", the single form signals "reveal a menu".
- Placeholder state (`Select a card`, `Select a limit`) uses
  `--color-text-placeholder`; a chosen value uses `--color-text`.
- Open state: border → `--color-accent`, menu appears 6px below with the
  popover shadow, trigger keeps its focus ring.

### 10.4 Segmented control (radio group)

Seen as `Card Type: [Physical] [Virtual]` and the density/layout toggles.

- Track: `--color-surface-sunken`, 8px radius, 3px inner padding.
- Segment: 28px tall, 12px horizontal padding, 6px radius, 13px / 500.
- Inactive segment: transparent, `--color-text-secondary`.
- Active segment: `--color-surface` (white) + 1px `--color-border` + `0 1px 2px
  rgba(0,0,0,.06)`, text `--color-text`.
- Dark: track `rgba(255,255,255,.05)`, active segment `#262626` with no shadow.

### 10.5 Textarea

**(inferred — no multi-line textarea is visible)**

- Same border/radius/focus treatment as a text input.
- Min-height 88px, 12px padding all round, line-height 1.5, `resize: vertical`.
- Optional bottom-right 12px muted character counter.

### 10.6 Checkbox

**(inferred — only checked list items appear, in the workflow column picker)**

- 16x16, 4px radius, 1px `--color-border`, white/`#111111` fill at rest.
- Checked: fill `--color-primary` (black light / white dark) or
  `--color-accent`, with a 10px white/black check stroked at 2px.
- The column-visibility menu shows checks as **bare 14px accent-colored check
  glyphs with no box** — use that lighter form inside menus, and the boxed form
  inside forms.
- Focus: 3px accent ring, offset 1px.
- Indeterminate: an 8x2px rounded bar in the same fill.

### 10.7 Radio

**(inferred)** — 16x16 circle, 1px border; selected shows a 6px filled dot in
`--color-primary` with the border switching to the same color.

### 10.8 Switch / toggle

**(inferred — the theme toggle appears as an icon, not a switch)**

- Track 36x20px, fully rounded. Off: `--color-border-strong` (light) /
  `#3A3A3A` (dark). On: `--color-primary` or `--color-accent`.
- Thumb: 16px white circle, 2px inset, `0 1px 2px rgba(0,0,0,.2)`, translating
  16px. Transition 140ms `ease`.

### 10.9 Date input / range picker

The dashboard shows a date-range trigger: `May 12 – May 18, 2026`

- Rendered as a **secondary (outline) button**, 36px tall, 12px horizontal
  padding, 8px radius, 14px / 400 `--color-text`.
- No visible leading calendar icon in that instance; table date cells *do* use a
  14px leading calendar icon at `--color-text-muted`.
- Empty date cell: `[📅] Add date` in `--color-text-placeholder`.
- Date formatting in tables: `Mon, 15 May 2026` (weekday, day, month, year) or
  `8th Feb, 2027` (ordinal day). **Pick one format and use it everywhere** —
  the mixed formats across references are per-product choices, not a system rule.

### 10.10 Labels, helper text, validation

- **Label:** 13px / 500 `--color-text-secondary`, 6px above the field. Sentence
  case (`Cardholder`, `Nickname`, `Card Type`, `Limit Type`).
- **Section label within a form:** 12px / 600 `--color-text` with 16px of space
  above (`Basics`, `Limit`).
- **Helper text:** 12px / 400 `--color-text-muted`, 6px below the field.
- **Error text:** 12px / 400 `--color-danger`, 6px below, optionally with a 12px
  leading warning glyph. Replaces helper text rather than stacking with it.
- **Required marker:** *(inferred)* a `*` in `--color-danger` after the label, or
  — more in keeping with this system's quietness — an `Optional` suffix in
  `--color-text-placeholder` on non-required fields instead.
- **Descriptive form intro:** the share dialog uses a 13px muted sentence under
  a 14px/600 heading (`Choose how users can access your project internally.
  Learn more.`) with an inline accent link. Reuse for permission-style forms.

### 10.11 Form layout

- Single column by default; two columns only for genuinely paired fields.
- Field width: fill the container; do not size inputs to their expected content.
- Buttons right-aligned in a footer separated by a 1px top border and 16–20px of
  padding.
- The share dialog's inline pattern — a full-width input with an attached
  `+ Invite` primary button immediately to its right, 8px gap — is the canonical
  "add an item to a list" form.

---

## 11. Calendar / Date Picker

**No open calendar panel is visible in any reference.** What *is* visible:
a date-range trigger button, `Calendar` view tabs, date cells with calendar
icons, and an `Add date` empty-cell affordance.

The following is therefore **entirely inferred**, constructed to be consistent
with every other component in this system. Treat it as a proposal, not as
extracted truth.

### 11.1 Container

- Popover surface: `--color-surface-elevated`, 12px radius, 1px
  `--color-border`, popover shadow (`0 12px 32px rgba(0,0,0,.10), 0 1px 3px
  rgba(0,0,0,.06)`).
- Padding 16px. Width 296px for a single month; 592px + a 1px vertical divider
  for a two-month range picker.
- Appears 6px below its trigger, left-aligned to the trigger.

### 11.2 Header

```
‹        May 2026        ›
```

- 40px tall, sitting above a 12px gap before the weekday row.
- Month/year label: 14px / 600 `--color-text`, centered. Clicking it switches to
  a month grid, then a year grid.
- Prev/next: 28x28 ghost icon buttons with 16px chevrons at
  `--color-text-muted`; hover `--color-hover`; disabled when out of range.

### 11.3 Weekday row

- 11px / 500 / `--color-text-muted`, uppercase, +0.06em tracking.
- Two-letter abbreviations (`Mo Tu We Th Fr Sa Su`), centered in each cell.
- 28px tall, 4px above the day grid.

### 11.4 Day cells

| Property | Value |
| --- | --- |
| Cell size | 36x36px, laid out in a 7-column grid with 2px gaps |
| Radius | 8px |
| Typography | 13px / 400, tabular-nums, centered |
| Default | transparent bg, `--color-text` |
| Outside current month | `--color-text-placeholder`, still clickable |
| Hover | bg `--color-hover`, text `--color-text` |
| Today | no fill; a 4px dot in `--color-accent` centered 4px below the numeral, **and** the numeral at 500 weight |
| Selected | bg `--color-primary` (black/white), text `--color-primary-foreground`, weight 500 |
| Disabled | `--color-text-placeholder`, `cursor: not-allowed`, no hover; a 1px strikethrough only for explicitly blocked dates |
| Weekend | same as weekday — **do not tint weekends**; this system does not use color for structural emphasis |
| Focus | 2px `--color-focus-ring`, offset 1px, radius 8px |

### 11.5 Range selection

- Endpoints: full `--color-primary` fill, 8px radius, but squared on the inner
  side so the range reads continuous (start = radius on left only, end = radius
  on right only).
- In-between days: bg `--color-accent-soft` (`#F3EEFF` light /
  `rgba(167,139,250,.14)` dark), text `--color-text`, radius 0.
- Hover preview while dragging: the tentative range uses the same in-between
  fill at 50% alpha.
- Row-edge days in a range keep 8px radius on the wrapping side.

### 11.6 Footer

- 1px `--color-border` top, 12px padding.
- Left: quick-range ghost buttons at `xs` size (`Today`, `Last 7 days`,
  `Last 30 days`).
- Right: `Cancel` (secondary) + `Apply` (primary), both `sm`, 8px gap.

### 11.7 Dark mode

- Container `#1E1E1E` with a `#2A2A2A` border; no shadow needed beyond a faint
  `0 8px 24px rgba(0,0,0,.5)`.
- Selected day: `#FFFFFF` fill with `#0A0A0A` numeral.
- Today dot: `#A78BFA`.
- In-range fill: `rgba(167,139,250,0.14)`.
- Hover: `rgba(255,255,255,0.06)`.

---

## 12. Dropdowns / Menus

Four menu instances are visible: the workflow template picker, the column
visibility list, the table filter menu, and the dark account menu. They agree
on the following.

### 12.1 Container

| Property | Light | Dark |
| --- | --- | --- |
| Background | `#FFFFFF` | `#1E1E1E` |
| Border | 1px `#EAEAEA` | 1px `#2A2A2A` |
| Radius | **12px** | 12px |
| Shadow | `0 12px 32px rgba(0,0,0,0.10), 0 1px 3px rgba(0,0,0,0.06)` | `0 12px 32px rgba(0,0,0,0.50)` |
| Padding | 6px (items inset from the container edge) | 6px |
| Min width | 180px; matches the trigger width when the trigger is a field | same |
| Typical width | 200–240px (template picker ~240px, account menu ~240px, filter menu ~180px) | same |
| Max height | ~320px, then scrolls internally | same |
| Offset from trigger | 6px | 6px |

### 12.2 Menu items

| Property | Value |
| --- | --- |
| Height | **32px** (36px when a leading avatar/tile is present) |
| Horizontal padding | 10px |
| Radius | 8px |
| Typography | 14px / 400 (`--color-text`); 13px in dense menus |
| Leading icon | 16px, `--color-text-muted`, 10px gap to the label |
| Leading tile | 20px gradient rounded-square (6px radius) for entity items — every template row in the picker has one |
| Trailing | keyboard shortcut (11px mono, `--color-text-placeholder`), a check glyph, or a 14px `›` for submenus |
| Gap between items | 1px |

### 12.3 States

| State | Light | Dark |
| --- | --- | --- |
| Hover | bg `rgba(0,0,0,0.045)`, label `--color-text` | bg `rgba(255,255,255,0.07)` |
| Active/pressed | bg `rgba(0,0,0,0.07)` | bg `rgba(255,255,255,0.10)` |
| Selected/checked | label `--color-text`; trailing 14px check in `--color-accent`. **No background fill** — the check alone carries the state (as in the column-visibility list) | same, check in `#A78BFA` |
| Disabled | label and icon `--color-text-placeholder`, no hover, `cursor: not-allowed` (exactly as `Settings`/`Support`/`Logout` render in the dark account menu) | same |
| Destructive | label and icon `--color-danger`; hover bg `#FEECEC` (light) / `rgba(248,113,113,.12)` (dark) | same |

### 12.4 Group labels and dividers

- **Group label:** 11px / 600 / uppercase / +0.06em / `--color-text-muted`,
  28px tall, 10px horizontal padding, with 4px of space above it. Seen as
  `Video` and `Image` in the template picker.
- **Divider:** 1px `--color-border`, full container width (breaking out of the
  6px item inset), with 4px above and below.
- The account menu shows a divider separating the usage/upsell block from the
  action items.

### 12.5 Menu with a search field

The template picker leads with a full-width search input inside the menu:

- 32px tall, sunken fill, no border, 8px radius, leading 14px magnifier,
  placeholder `Search a template`.
- Sits above a 1px divider; the list scrolls below it.

### 12.6 Menu footer

- A sticky bottom row separated by a 1px divider, containing a single
  full-width item with a trailing `→` arrow (`Explore more templates`).
- 32px tall, 13px / 500, `--color-text`, hover like any other item.

### 12.7 Embedded blocks

The dark account menu embeds a non-interactive **usage block** above the item
list: a 14px label + a segmented meter (10 ticks, orange fill,
`--color-border` empties) + a percentage with a warning glyph, then a muted
13px sentence and an accent `Learn more` link. Menus in this system may contain
such blocks — they are not restricted to lists of items.

### 12.8 Filter menu specifics

The table filter menu (`Status / Partner / Client type / Client / Vehicle /
Unit / Staff member`) is a plain 32px-item list with no icons and no checks —
choosing an item opens the next step. Its width is set by the longest label
plus 20px, minimum 180px.

Applied filters then render **outside** the menu as removable chips (see §14.5).

---

## 13. Modals / Dialogs

The share dialog is the one full modal in the reference set.

### 13.1 Container

| Property | Value |
| --- | --- |
| Width | **480px** (sm 400px, lg 640px) |
| Max height | `calc(100vh - 96px)`, content scrolls internally |
| Background | `--color-surface-elevated` (`#FFFFFF` / `#1E1E1E`) |
| Radius | **14px** |
| Border | none in light mode; 1px `#2A2A2A` in dark mode |
| Shadow | `0 24px 64px rgba(0,0,0,0.16), 0 2px 8px rgba(0,0,0,0.06)` |
| Position | horizontally centered; vertically centered, biased ~8% above true center |
| Padding | 20px |

### 13.2 Overlay

- `rgba(15,15,15,0.32)` in light mode — **notably light**; the table behind the
  share dialog stays fully readable. This is a deliberate choice: the modal is
  contextual to what's behind it.
- `rgba(0,0,0,0.60)` in dark mode.
- No background blur.
- Fade in over 150ms; the dialog scales `0.98 → 1` with a 12px upward
  translate over 180ms `cubic-bezier(0.16, 1, 0.3, 1)`. *(inferred)*

### 13.3 Header

The share dialog uses **tabs as its header** rather than a title:

```
[🔒 Share private link]  [🌐 Share link with anyone]                        [×]
```

- Tab row 40px tall, sitting flush at the top of the dialog with a 1px bottom
  border spanning the full dialog width.
- Active tab: `--color-text` label + a 2px `--color-text` underline; inactive:
  `--color-text-secondary`.
- Each tab has a 14px leading icon, 8px gap.
- **Close button:** 28x28 ghost icon button with a 16px `×` at
  `--color-text-muted`, positioned at the top-right, 16px from each edge; hover
  gives it `--color-hover` and `--color-text`.

For a conventional titled dialog **(inferred)**: title at `--text-h2`
(16/600), optional 13px muted description below, 16px gap to the body.

### 13.4 Content

- Section heading: 14px / 600 (`Share these 2 tasks:`, `Who has access:`), with
  20px of space above it (0 for the first) and 10px below.
- Section description: 13px / 400 `--color-text-muted` with an inline accent
  `Learn more` link.
- **Item rows** (the shared tasks): 48px, 1px `--color-border`, 8px radius,
  12px horizontal padding, containing a 14px status glyph, a mono ID, a
  14px/500 name, a status badge, and a trailing 16px lock icon. Stacked with
  8px gaps.
- **Permission row:** a full-width 48px bordered row with a leading 16px icon,
  a 13px/400 description, and a trailing `Can edit` secondary button.
- **Invite row:** full-width input + `+ Invite` primary button, 8px gap.
- **Access list:** 52px rows, no borders between them, each with a 32px
  gradient avatar (with an 8px green presence dot for online users), name at
  14px/500, email at 12px/400 muted below, and a right-side cluster of a role
  secondary button (`Admin`, `Editor`, `Viewer`) plus a 16px destructive trash
  icon button. Rows carry inline `External` and `Not signed up` neutral/warning
  micro-badges after the email.
- Count line: `5 people has access:` at 12px / 400 muted, 8px above the list.

### 13.5 Footer

```
[🔔 Notify team]                              [🔗 Copy link]  [Done]
```

- 1px `--color-border` top border, 16px vertical padding, 20px horizontal.
- **Left-aligned secondary action**, right-aligned action pair — a split
  footer, not a single right-aligned cluster.
- Buttons at `sm`/`md` height, 8px gap.
- `Done` is the confirming action but is rendered as a **quiet secondary
  button** here, because the destructive-free dialog doesn't need an anchor.
  Rule: use a solid primary in the footer only when the dialog performs a
  consequential, irreversible action.

### 13.6 Dark mode

- Surface `#1E1E1E`, border `#2A2A2A`, overlay `rgba(0,0,0,.60)`.
- Shadow deepens to `0 24px 64px rgba(0,0,0,0.6)` but contributes little;
  the border does the separating work.
- Inner bordered rows use `#262626` borders on a `#161616` fill (sunken relative
  to the dialog surface).

---

## 14. Badges / Statuses

### 14.1 Badge anatomy

| Property | Value |
| --- | --- |
| Height | **20px** (large 24px, micro 18px) |
| Horizontal padding | **8px** (6px at micro) |
| Radius | **6px** for rectangular badges; `999px` for pills |
| Typography | 12px / 500 (11px / 500 at micro) |
| Border | 1px in the status's border tone — **optional**; the references use bordered badges for priority (`High`, `Medium`, `Low`) and borderless tinted badges for status (`To-do`, `On-going`, `In-review`) |
| Icon | Optional 12px leading glyph, 4px gap |

Two badge families coexist and should be used for different axes:

- **Bordered soft badge** → *priority / severity* (`High` red, `Medium` blue,
  `Low` green, `Not set` neutral). Tinted background + 1px matching border +
  saturated text.
- **Flat soft badge** → *workflow status* (`To-do`, `On-going`, `In-review`).
  Tinted background, no border, saturated text.

### 14.2 Color mapping

| Semantic | Light text / bg / border | Dark text / bg |
| --- | --- | --- |
| Success | `#16A34A` / `#E8F8EE` / `#C6EFD6` | `#4ADE80` / `rgba(74,222,128,.12)` |
| Warning | `#EA580C` / `#FFF1E7` / `#FFD9BF` | `#FB923C` / `rgba(251,146,60,.12)` |
| Error | `#DC2626` / `#FEECEC` / `#FBD0D0` | `#F87171` / `rgba(248,113,113,.12)` |
| Info | `#2563EB` / `#EAF1FE` / `#CFE0FD` | `#60A5FA` / `rgba(96,165,250,.12)` |
| Neutral | `#525252` / `#F2F2F2` / `#E5E5E5` | `#A1A1A1` / `rgba(255,255,255,.07)` |
| Accent | `#7C3AED` / `#F3EEFF` / `#E3D8FF` | `#A78BFA` / `rgba(167,139,250,.14)` |

### 14.3 Status dots

- **8px** solid circle, no border, no ring.
- Used in group headers (grey Backlog, orange In progress, green In review) and
  in legends.
- **6px** when used as a presence indicator on an avatar — then it *does* get a
  2px `--color-surface` ring so it reads against the avatar gradient.
- **10px** in chart legends, where it sits 8px before the label.
- Dot color = the full saturated status color, never the tint.

### 14.4 Count chips

- 20px tall, 6px radius, 6px horizontal padding.
- 11–12px / 500, `--color-text-muted` on `rgba(0,0,0,.05)` /
  `rgba(255,255,255,.07)`.
- Used after group names (`Backlog 12`), after card titles
  (`AI Inbox · 23 Unresolved`), and as unread counts in list rows.
- **Unread/alert counts are the exception**: a 20px fully-round badge in
  `--color-danger` with white 11px/600 text (the `2` and `1` on inbox rows).

### 14.5 Filter chips (removable)

From the charges table:

- Height 28px, 6px radius, 10px horizontal padding.
- Background `--color-surface-sunken`, 1px `--color-border`.
- Label is **two-tone**: attribute name at `--color-text-muted`, value at
  `--color-text` — `Status: Completed`, `Client type: Fleet`.
- Trailing 12px `×` at `--color-text-placeholder`, `--color-text` on hover, in a
  16px hit area.
- The chip row ends with a ghost `+ Add filter` and a ghost `Clear`.
- Chips wrap to multiple lines with 8px gaps.

### 14.6 Micro tags

- 18px tall, 4px radius, 6px horizontal padding, 11px / 500.
- `External` (neutral), `Not signed up` (warning), `NEW` (accent), `ORG`
  (accent), `Admin`/`Editor`/`Viewer` (neutral, rendered as buttons not badges).

### 14.7 Active / inactive

- **Active** entities: full-contrast text plus a `success` dot.
- **Inactive** entities: `--color-text-muted` text plus a `neutral` dot; no
  strikethrough, no reduced opacity on the whole row.

### 14.8 Light/dark behavior

Badges keep identical geometry across modes; only the color pair swaps. The key
difference: **light-mode tints are opaque pastels; dark-mode tints are
low-alpha overlays of the badge's own hue.** Do not use the light pastel hexes
on dark surfaces — they will be far too bright.

---

## 15. Icons

### 15.1 Style

- **Outline / stroked**, geometric, rounded caps and joins.
- **1.5px stroke** at 16px nominal size (scales proportionally: 1.25px at 14px,
  1.75px at 20px). Never a filled icon set, with three exceptions: status dots,
  the send button glyph, and inline completion checks.
- 24x24 nominal grid, drawn to fit a 20x20 optical box.
- Consistent with Lucide / Phosphor (regular weight) / Feather. **Lucide is the
  closest match** to the reference letterforms and corner treatment.

### 15.2 Sizes

| Size | Where |
| --- | --- |
| **12px** | Inline meta glyphs, badge icons, chevrons inside chips, keyboard hints |
| **14px** | Table cell icons, toolbar button icons, breadcrumb separators, dropdown trailing glyphs |
| **16px** | The default — sidebar nav, buttons, menu items, header icon buttons, input adornments |
| **18–20px** | Icon-rail glyphs, card header icon tiles, empty-state small glyphs |
| **28–32px** | Icon tiles (the icon inside is 16px; the tile is 28–32px) |
| **~140px** | Empty-state illustration container |

### 15.3 Color

| Context | Color |
| --- | --- |
| Default / decorative | `--color-text-muted` |
| Inside an active nav item or hovered control | `--color-text` |
| On a primary button | `--color-primary-foreground` |
| Inside a status badge | the badge's saturated text color |
| Inside a metric card's icon tile | the tile's saturated status color |
| Destructive action | `--color-text-muted` at rest → `--color-danger` on hover |

Icons are **never** the same weight/darkness as the text they precede — they sit
one step lighter. This is consistent across every reference and is what keeps
icon-dense rows calm.

### 15.4 Spacing & alignment

- Icon → text gap: **8px** in buttons and nav; **10px** in sidebar items and
  menu rows; **6px** in dense chips.
- Icons are **optically centered on the text's cap height**, typically requiring
  a 0.5–1px upward nudge relative to naive vertical centering.
- Two icons side by side (e.g. `···` and `+`) sit 8px apart, each in its own
  square hit area of at least 24x24.

### 15.5 When to use icons vs. text

| Use an icon alone | Use icon + text | Use text alone |
| --- | --- | --- |
| Universally understood actions in dense chrome: search, close, overflow `···`, add `+`, chevrons, bell, gear | Nav items, view tabs, toolbar filters, buttons that change state, table type-columns | Anything with a domain-specific meaning; role buttons (`Admin`, `Editor`); aggregate labels; badges |

Rules:

- An icon-only button **must** have an accessible label and a tooltip.
- Never use an icon alone for a destructive action outside a clearly labeled
  list context.
- Never use two different icons for the same concept across the app; keep a
  single icon-to-concept map.

### 15.6 Icon states

- Rest: `--color-text-muted`.
- Hover (on an interactive icon): `--color-text` and, if it's an icon button,
  a `--color-hover` background fills its 32x32 square.
- Active/selected: `--color-text`, with the chip background of the containing
  control.
- Disabled: `--color-text-placeholder`.
- Icons never change stroke weight between states; only color and container
  background change.

---

## 16. Dark Mode

### 16.1 The logic behind the dark theme

The dark theme in these references follows four principles that are **not** a
simple inversion:

1. **Elevation = lightness, in both themes.**
   In light mode a card is lighter than the page (white on grey). In dark mode a
   card is *also* lighter than the page (`#161616` on `#0A0A0A`). The direction
   of the elevation gradient is preserved. What changes is the *magnitude*: in
   light mode the step is small and reinforced by a shadow; in dark mode the
   step is the entire signal, and shadows contribute almost nothing.

2. **Borders lighten the ground rather than darkening it.**
   Light mode: border is darker than both surfaces (`#EAEAEA` on white).
   Dark mode: border is lighter than both surfaces (`#262626` on `#161616`).
   In both cases the border is roughly a **7–10% value step** from the surface —
   the *contrast of the seam* is what's held constant, not the hex.

3. **Text never reaches pure white.**
   Body copy sits at `#EDEDED`. Pure `#FFFFFF` is reserved for the single
   highest-emphasis element on a dark screen — the primary button's label, or a
   focused numeral. This prevents halation and keeps the hierarchy readable.

4. **Saturated colors are lightened and de-tinted, not reused.**
   `#DC2626` on `#0A0A0A` is nearly unreadable; the dark theme uses `#F87171`.
   Meanwhile the *tinted backgrounds* invert their construction entirely: light
   mode uses opaque pastels (`#FEECEC`), dark mode uses a low-alpha overlay of
   the badge's own hue (`rgba(248,113,113,0.12)`) so it picks up whatever
   surface it sits on.

A fifth, subtler rule: **inputs invert their relationship to their container.**
In light mode an input is the same white as its card, distinguished by a border.
In dark mode an input is *darker* than its card (`#111111` inside `#161616`),
reading as a well. Recessed-in-dark, flush-in-light.

### 16.2 Background hierarchy

```
#0A0A0A   page / app frame            <- darkest
#0D0D0D   sidebar
#111111   input wells, sunken fills
#121212   table footer bar, group bands
#161616   cards, tables, content panel
#1E1E1E   dropdowns, popovers, dialogs <- lightest
```

Six steps, but only three that a component author needs to think about:
`background` → `surface` → `surface-elevated`.

### 16.3 Text contrast

| Token | Hex | Contrast vs `#161616` | Role |
| --- | --- | --- | --- |
| `--color-text` | `#EDEDED` | ~14.6:1 | Primary content |
| `--color-text-secondary` | `#A1A1A1` | ~6.6:1 | Secondary values, inactive nav |
| `--color-text-muted` | `#7A7A7A` | ~3.9:1 | Column headers, meta (large/medium text only, or accept AA-large) |
| `--color-text-placeholder` | `#5A5A5A` | ~2.2:1 | Placeholders, disabled — intentionally sub-AA; never carries required information |

### 16.4 Component behavior in dark mode

**Tables.** The dark CRM table is the strongest dark artifact in the set. Its
full 1px `#262626` grid — both axes — is what makes a nearly-black table
readable; without vertical rules, dark cells bleed together. Rule: **dark tables
may use vertical column rules where light tables should not.** The header row is
`#121212` with `#7A7A7A` labels and type glyphs; rows are `#161616`. The
selected row is `rgba(255,255,255,.06)` with a `#3A3A3A` outline. The sticky
footer aggregate bar drops back to `#121212`.

**Cards.** `#161616` + `#262626` border, no shadow. Nested content inside a card
uses `#1C1C1C` separators.

**Inputs.** `#111111` fill, `#2A2A2A` border, `#5A5A5A` placeholder. Focus adds
a `#A78BFA` border and a `rgba(167,139,250,.20)` ring.

**Buttons.** Primary inverts to white-on-black. Secondary becomes a barely-there
`rgba(255,255,255,.04)` fill with a `#262626` border. Ghost hover is
`rgba(255,255,255,.045)` — an *additive white*, never a colored tint.

**Sidebar.** Darkest surface (`#0D0D0D`), 1px `#262626` right border. Active nav
item is `rgba(255,255,255,.08)` with **no border and no shadow** — the light
mode's "white chip with border and shadow" would look wrong here, so dark mode
substitutes a pure fill. This is the clearest case where the two themes use
*different mechanisms for the same state*.

**Dropdowns.** `#1E1E1E`, `#2A2A2A` border, and a heavy but nearly invisible
`0 12px 32px rgba(0,0,0,.5)` shadow. The lightness step carries the elevation.
Disabled items at `#5A5A5A`; the hovered item at `rgba(255,255,255,.07)`.

**Calendar.** *(inferred)* `#1E1E1E` container; selected day is a white fill
with black numerals; the in-range fill is `rgba(167,139,250,.14)`; today's dot
is `#A78BFA`.

**Status colors.** Lightened set from §2.3. The segmented progress meters in the
dark table keep their light-mode hues (`#F97316`, `#3B82F6`, `#EF4444`,
`#22C55E`) because they sit on `#161616` and are large enough to read.

**Charts and avatars.** Unchanged between modes. Their mid-tone gradients work
on both grounds, and holding them constant makes identity colors theme-stable.

**Shadows.** Effectively removed. Any shadow that survives is there to soften
the edge of a popover, not to communicate height.

**Hover / selected.** All neutral interaction states are **white at low alpha**
(`.035` hover, `.06` selected, `.08` active, `.10` pressed). Never a hue-tinted
hover; never a darkening.

---

## 17. Light Mode

### 17.1 The logic behind the light theme

1. **The page is grey, the content is white.** This single decision defines the
   light theme. A white card on a `#F4F4F5` page has a built-in, shadow-free
   edge; the 1px border then makes it crisp. Building the inverse (white page,
   grey cards) would break every other rule in this document.

2. **Borders are almost invisible on purpose.** `#EAEAEA` is only ~7% black.
   The border's job is to sharpen an edge the value-step has already created,
   not to draw a box. If a border is the *only* thing separating two regions,
   it is being asked to do too much — add a value step instead.

3. **Contrast is spent on content, not chrome.** The darkest thing on a light
   screen is either body content (`#171717`) or the single primary button
   (`#111111`). Chrome — nav, toolbars, headers — lives between 45% and 68%
   grey. This is why the interfaces feel calm despite being dense.

4. **Elevation is shadow + border together, both very light.** A dropdown gets
   `0 12px 32px rgba(0,0,0,.10)` — large blur, low opacity. Never a dark, tight
   shadow.

### 17.2 Surface hierarchy

```
#F4F4F5   page canvas, sidebar (Variant A)   <- darkest
#F7F7F8   sunken: search fills, segmented tracks
#FAFAFA   subtle: table header bands, hover fills
#FFFFFF   cards, tables, content panel, popovers, dialogs  <- lightest
```

Note that white is used for **both** `surface` and `surface-elevated`; the
difference between a card and a popover in light mode is *entirely* the shadow.

### 17.3 What stays the same across themes

- All geometry: heights, paddings, radii, gaps, icon sizes, type scale, weights.
- Gradient avatars and chart gradients.
- The rule of one primary button per view.
- Badge geometry, dot sizes, chip sizes.
- The *relationships*: elevated surfaces are lighter; borders are a ~7–10%
  value step; muted text is ~55% of the way to the background; hover is a ~4%
  neutral shift.

### 17.4 What changes, and why

| Aspect | Light | Dark | Reason |
| --- | --- | --- | --- |
| Border direction | darker than surface | lighter than surface | Seams must contrast with the ground in whichever direction has headroom |
| Elevation cue | shadow (surface color stays white) | lightness step (shadow is invisible) | Shadows don't read on near-black |
| Input fill | flush with card + border | recessed below card | A darker well is legible on dark; a lighter well would look like a button |
| Active nav item | white chip + border + shadow | flat white-alpha fill | A "raised chip" metaphor requires a light ground |
| Status tint | opaque pastel | low-alpha hue overlay | Pastels are far too bright on near-black |
| Primary button | black on white | white on black | Maximum contrast in each direction |
| Table rules | horizontal only | horizontal + vertical (grid) | Dark cells need more structural help |
| Overlay | 32% black | 60% black | Dark modals need more separation from an already-dark ground |

Both themes are the **same design executed against different grounds**. The
tokens carry the difference; no component changes its structure, spacing, or
type.

---

## 18. Responsive Design

> **Mandate: every screen in this product is mobile-first and fully
> responsive.** This is a hard requirement, not a nice-to-have. No view,
> component, table, form, dialog, or page may ship desktop-only. A feature is
> not "done" until it has been checked at 375px, 768px, 1024px, and 1440px.

All references are desktop captures at ≥1280px logical width, so the specific
breakpoint *values* below are inference, grounded in the structures actually
visible (collapse toggles, scroll containers, grid ratios). The mandate itself
is a project requirement and is not optional.

### 18.0 Non-negotiable rules

These apply to every component in this document:

1. **Author mobile-first.** Base styles target the smallest screen; add
   complexity upward with `sm:` / `md:` / `lg:` — never write desktop styles
   and strip them back down with `max-*` queries.
2. **The page body never scrolls horizontally.** Wide content (tables,
   toolbars, chart axes, code) scrolls inside its own
   `overflow-x: auto` container. A horizontal scrollbar on `<body>` is a bug.
3. **Touch targets are ≥44×44px below `lg`.** Icon buttons that are 32px on
   desktop grow to 44px on touch. This includes close buttons, row actions,
   and chevrons.
4. **Nothing may be hover-only below `lg`.** Hover does not exist on touch.
   Any affordance revealed on hover — row `···`, section `+`, filter `×`,
   tooltips — must be permanently visible, moved into a menu, or replaced by
   an explicit control. **This is the single most-violated rule; check it
   first.**
5. **Never put a fixed/floating control over content it can collide with.**
   Place it in the flow (e.g. the drawer trigger is the first item *inside*
   the header row, not a floating button above it). Overlap bugs on narrow
   screens almost always trace back to a `fixed` element plus a padding hack.
6. **Text must not be clipped or truncated to fit.** Wrap, stack, or reduce
   the number of columns instead. Use `truncate` only where the full value is
   available elsewhere (tooltip, detail view).
7. **Respect the safe area.** Use `viewport-fit=cover` plus
   `env(safe-area-inset-*)` padding on anything pinned to a screen edge, so
   content clears notches and home indicators.
8. **Allow pinch-zoom.** Never ship `maximum-scale=1` or `user-scalable=no`;
   they are accessibility failures.
9. **Test at 375px.** It is the narrowest widely-used width; if it works
   there, it works.
10. **Honour `prefers-reduced-motion`.** Drawer slides and width transitions
    collapse to instant state changes.

### 18.1 Breakpoint behavior summary

| Range | Shell |
| --- | --- |
| ≥1536px | Sidebar 248px + optional 48px rail; dashboard grids at full column counts; tables show all columns; content may cap around 1600px for readability |
| 1280–1536px | The reference layout, unchanged |
| 1024–1280px | Icon rail hides; sidebar collapses to 56px icon-only (toggle still available to expand); dashboard drops from 4-up to 2-up metric cards; tables begin horizontal scroll |
| 768–1024px | Sidebar becomes an off-canvas drawer opened by a hamburger in the header; two-row header merges into one with the toolbar becoming horizontally scrollable; dashboard is 2-up then 1-up |
| <768px | Single column throughout; tables become stacked cards; modals become bottom sheets |

### 18.2 Sidebar

- ≥1280px: fixed 248px, always visible.
- 1024–1280px: collapses to 56px icon rail; tooltips on hover; expanding it
  pushes content rather than overlaying.
- <1024px: off-canvas drawer, 280px wide, sliding from the left over a
  `rgba(15,15,15,.32)` scrim; opened by a 32x32 hamburger icon button placed
  first in the header; closes on scrim tap, `Esc`, and route change.
- The footer profile row and the promo card stay pinned to the drawer's bottom.

### 18.3 Header

- The two-row header (identity + toolbar) merges into a single 56px row below
  1024px: breadcrumb collapses to just the current segment, the avatar stack
  hides, and the toolbar's controls collapse into one `⚙ View` icon button that
  opens a sheet containing Group/Sort/Filter/View.
- The primary action button keeps its label down to 768px, then becomes an
  icon-only 36x36 button.
- The view tabs become a horizontally scrollable row with no scrollbar and a
  4px fade mask at each edge.

### 18.4 Tables

- The table container is always the scroll boundary; the page body never scrolls
  horizontally.
- Below 1280px: the identifier/name column becomes `position: sticky; left: 0`
  with a 1px right border and `4px 0 8px -4px rgba(0,0,0,.06)` to signal the
  overlap.
- Column priority for dropping, lowest first: category/list → secondary dates →
  team/avatars → status → primary date → amount → name.
- Below 1024px: switch to stacked cards. Each card is 12px radius, 1px border,
  16px padding, containing:
  ```
  [name 14/500]                        [status badge]
  [mono id 12 muted]
  -- 1px subtle --
  Priority   High          Due date   Mon, 15 May 2026
  [avatar stack]
  ```
- Group headers become sticky section headers in the card list, keeping their
  tinted band, dot, and count.
- The sticky footer aggregate bar becomes a single summary card at the end of
  the list.

### 18.5 Cards & grids

- Metric grid: `repeat(auto-fit, minmax(240px, 1fr))` with a 16px gap. This
  yields 4-up at ≥1280, 2-up around 900, 1-up below 560 without media queries.
- The 3-column dashboard region reflows to a single column below 1024px, with
  the *middle* (widest, most important) column first.
- Card padding drops 20px → 16px below 768px.
- Charts keep a minimum height of 200px and never shrink below it; they scroll
  horizontally inside their card if the x-axis has too many ticks.

### 18.6 Forms & modals

- Two-column form rows stack to one column below 768px.
- Labels stay above inputs at every size (never inline/left labels).
- Modals: 480px fixed above 640px viewport width; below that, full-width minus
  16px margins, and below 480px they become bottom sheets — full width, radius
  only on the top two corners (14px), max-height 88vh, with the footer pinned.
- The modal footer's split layout (left secondary + right pair) stacks: the
  right pair goes full-width first, the left secondary below it, 8px gap.

### 18.7 Buttons & controls

- Buttons keep their 32px height down to 768px, then grow to **44px** for touch
  targets. All icon-only buttons grow to 44x44 at touch sizes.
- Row heights grow from 48px to 56px on touch devices.
- Hover-revealed affordances (row `···`, section `+`, filter `×`) must become
  **always-visible** below 1024px, since hover doesn't exist. This is the single
  most important responsive adaptation in this design language.

### 18.8 Content width

- Dashboards and tables: fill available width, no max.
- Text-heavy content (docs, settings prose, empty-state copy): cap the measure
  at ~640px and left-align to the content axis rather than centering.

---

## 19. Design Tokens

A complete, implementation-ready token set. Semantic names first; primitive
scales only where the references imply one (status colors, gradients).

### 19.1 Color

```css
:root {
  /* ---- Brand / primary ---- */
  --color-primary:              #111111;
  --color-primary-hover:        #000000;
  --color-primary-active:       #000000;
  --color-primary-foreground:   #FFFFFF;

  --color-accent:               #7C3AED;
  --color-accent-hover:         #6D28D9;
  --color-accent-soft:          #F3EEFF;
  --color-accent-border:        #E3D8FF;
  --color-accent-foreground:    #FFFFFF;

  /* ---- Surfaces ---- */
  --color-background:           #F4F4F5;
  --color-background-subtle:    #FAFAFA;
  --color-surface:              #FFFFFF;
  --color-surface-elevated:     #FFFFFF;
  --color-surface-sunken:       #F7F7F8;
  --color-sidebar:              #F4F4F5;
  --color-overlay:              rgba(15,15,15,0.32);

  /* ---- Borders ---- */
  --color-border:               #EAEAEA;
  --color-border-strong:        #D4D4D4;
  --color-border-subtle:        #F1F1F1;

  /* ---- Text ---- */
  --color-text:                 #171717;
  --color-text-secondary:       #525252;
  --color-text-muted:           #737373;
  --color-text-placeholder:     #A3A3A3;
  --color-text-inverse:         #FFFFFF;

  /* ---- Interaction ---- */
  --color-hover:                rgba(0,0,0,0.035);
  --color-active:               rgba(0,0,0,0.060);
  --color-pressed:              rgba(0,0,0,0.080);
  --color-selected:             #FAFAFA;
  --color-selected-border:      #D4D4D4;
  --color-focus-ring:           rgba(124,58,237,0.35);

  /* ---- Status ---- */
  --color-success:              #16A34A;
  --color-success-bg:           #E8F8EE;
  --color-success-border:       #C6EFD6;

  --color-warning:              #EA580C;
  --color-warning-bg:           #FFF1E7;
  --color-warning-border:       #FFD9BF;

  --color-danger:               #DC2626;
  --color-danger-bg:            #FEECEC;
  --color-danger-border:        #FBD0D0;

  --color-info:                 #2563EB;
  --color-info-bg:              #EAF1FE;
  --color-info-border:          #CFE0FD;

  --color-neutral:              #525252;
  --color-neutral-bg:           #F2F2F2;
  --color-neutral-border:       #E5E5E5;

  /* ---- Data / chart series (theme-stable) ---- */
  --color-chart-1:              #3B82F6;
  --color-chart-2:              #22C55E;
  --color-chart-3:              #F97316;
  --color-chart-4:              #A855F7;
  --color-chart-5:              #EF4444;
  --color-chart-6:              #06B6D4;
  --gradient-chart-bar:         linear-gradient(180deg, #3B82F6 0%, #93C5FD 100%);

  /* ---- Identity gradients (theme-stable) ---- */
  --gradient-avatar-1: linear-gradient(135deg, #A78BFA 0%, #F472B6 100%);
  --gradient-avatar-2: linear-gradient(135deg, #38BDF8 0%, #6366F1 100%);
  --gradient-avatar-3: linear-gradient(135deg, #FB923C 0%, #EF4444 100%);
  --gradient-avatar-4: linear-gradient(135deg, #34D399 0%, #06B6D4 100%);
  --gradient-avatar-5: linear-gradient(135deg, #F472B6 0%, #FBBF24 100%);
  --gradient-avatar-6: linear-gradient(135deg, #818CF8 0%, #C084FC 100%);
}

:root[data-theme="dark"] {
  --color-primary:              #FFFFFF;
  --color-primary-hover:        #F0F0F0;
  --color-primary-active:       #E5E5E5;
  --color-primary-foreground:   #0A0A0A;

  --color-accent:               #A78BFA;
  --color-accent-hover:         #C4B5FD;
  --color-accent-soft:          rgba(167,139,250,0.14);
  --color-accent-border:        rgba(167,139,250,0.32);
  --color-accent-foreground:    #0A0A0A;

  --color-background:           #0A0A0A;
  --color-background-subtle:    #121212;
  --color-surface:              #161616;
  --color-surface-elevated:     #1E1E1E;
  --color-surface-sunken:       #111111;
  --color-sidebar:              #0D0D0D;
  --color-overlay:              rgba(0,0,0,0.60);

  --color-border:               #262626;
  --color-border-strong:        #3A3A3A;
  --color-border-subtle:        #1C1C1C;

  --color-text:                 #EDEDED;
  --color-text-secondary:       #A1A1A1;
  --color-text-muted:           #7A7A7A;
  --color-text-placeholder:     #5A5A5A;
  --color-text-inverse:         #0A0A0A;

  --color-hover:                rgba(255,255,255,0.045);
  --color-active:               rgba(255,255,255,0.080);
  --color-pressed:              rgba(255,255,255,0.100);
  --color-selected:             rgba(255,255,255,0.060);
  --color-selected-border:      #3A3A3A;
  --color-focus-ring:           rgba(167,139,250,0.45);

  --color-success:              #4ADE80;
  --color-success-bg:           rgba(74,222,128,0.12);
  --color-success-border:       rgba(74,222,128,0.28);

  --color-warning:              #FB923C;
  --color-warning-bg:           rgba(251,146,60,0.12);
  --color-warning-border:       rgba(251,146,60,0.28);

  --color-danger:               #F87171;
  --color-danger-bg:            rgba(248,113,113,0.12);
  --color-danger-border:        rgba(248,113,113,0.28);

  --color-info:                 #60A5FA;
  --color-info-bg:              rgba(96,165,250,0.12);
  --color-info-border:          rgba(96,165,250,0.28);

  --color-neutral:              #A1A1A1;
  --color-neutral-bg:           rgba(255,255,255,0.07);
  --color-neutral-border:       rgba(255,255,255,0.14);
  /* chart + avatar gradients intentionally unchanged */
}
```

#### Applying the dark block

**This project uses a `.dark` class on `<html>`**, not a `data-theme`
attribute, because Tailwind v4 + shadcn key their `dark:` variant off it
(`@custom-variant dark (&:is(.dark *))` in `app/globals.css`). Selector aside,
the three-state contract is unchanged:

| Preference | What happens |
| --- | --- |
| `"light"` | `.dark` removed; light tokens apply |
| `"dark"` | `.dark` added; dark tokens apply |
| `"system"` (default) | `.dark` mirrors `prefers-color-scheme`, updated live via a `matchMedia` listener |

Three rules make a theme toggle behave correctly:

1. **Resolve the class before first paint.** A blocking inline `<script>` in
   `<head>` reads the stored preference and sets the class, otherwise the page
   flashes light before hydration. Set `style.colorScheme` in the same pass so
   native form controls and scrollbars match.
2. **Persist the preference, not the resolved value.** Store `"system"` as
   `"system"` — storing the resolved `"dark"` freezes the user out of
   following their OS later. Wrap `localStorage` access in `try/catch`; it
   throws in some private-browsing modes.
3. **Anchor the toggle on what is painted.** Cycling from `"system"` should
   flip to the opposite of the *current appearance*, so the first click always
   visibly changes something.

If a project is not on Tailwind/shadcn, the equivalent attribute form is
`:root[data-theme="dark"]` plus
`@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } }`.

### 19.2 Typography

```css
:root {
  --font-sans: "Inter", "SF Pro Text", -apple-system, "Segoe UI", Roboto,
               "Helvetica Neue", Arial, sans-serif;
  --font-mono: "JetBrains Mono", "SF Mono", ui-monospace, Menlo, Consolas, monospace;
  --font-display: "Instrument Serif", Georgia, serif; /* marketing only */

  --font-weight-regular:  400;
  --font-weight-medium:   500;
  --font-weight-semibold: 600;

  --text-display:    30px;  --leading-display:    36px;  --tracking-display:  -0.02em;
  --text-h1:         20px;  --leading-h1:         28px;  --tracking-h1:      -0.015em;
  --text-h2:         16px;  --leading-h2:         24px;  --tracking-h2:      -0.01em;
  --text-h3:         14px;  --leading-h3:         20px;  --tracking-h3:      -0.005em;
  --text-body:       14px;  --leading-body:       20px;  --tracking-body:     0;
  --text-body-sm:    13px;  --leading-body-sm:    18px;
  --text-caption:    12px;  --leading-caption:    16px;
  --text-micro:      11px;  --leading-micro:      14px;  --tracking-micro:    0.04em;
  --text-overline:   11px;  --leading-overline:   14px;  --tracking-overline: 0.08em;
  --text-mono-id:    12px;  --leading-mono-id:    16px;  --tracking-mono-id:  0.02em;

  --leading-prose: 1.55;
}
```

### 19.3 Spacing

```css
:root {
  --space-0:  0px;   --space-1:  2px;   --space-2:  4px;   --space-3:  6px;
  --space-4:  8px;   --space-5: 10px;   --space-6: 12px;   --space-7: 16px;
  --space-8: 20px;   --space-9: 24px;   --space-10: 32px;  --space-11: 40px;
  --space-12: 48px;  --space-14: 64px;  --space-16: 80px;
}
```

### 19.4 Radius

```css
:root {
  --radius-xs:   4px;   /* checkbox, micro tags, skeleton bars */
  --radius-sm:   6px;   /* badges, chips, icon tiles, segment items */
  --radius-md:   8px;   /* buttons, inputs, nav items, menu items */
  --radius-lg:  12px;   /* cards, tables, dropdowns, panels */
  --radius-xl:  14px;   /* modals, app frame */
  --radius-2xl: 16px;   /* large hero panels */
  --radius-full: 999px; /* avatars, pills, status dots, pill search */
}
```

### 19.5 Shadows

```css
:root {
  --shadow-none:       none;
  --shadow-xs:         0 1px 2px rgba(0,0,0,0.04);
  --shadow-sm:         0 1px 2px rgba(0,0,0,0.06), 0 1px 1px rgba(0,0,0,0.04);
  --shadow-md:         0 2px 8px rgba(0,0,0,0.06);
  --shadow-popover:    0 12px 32px rgba(0,0,0,0.10), 0 1px 3px rgba(0,0,0,0.06);
  --shadow-modal:      0 24px 64px rgba(0,0,0,0.16), 0 2px 8px rgba(0,0,0,0.06);
  --shadow-sticky-col: 4px 0 8px -4px rgba(0,0,0,0.06);
}

:root[data-theme="dark"] {
  --shadow-xs:         none;
  --shadow-sm:         none;
  --shadow-md:         none;
  --shadow-popover:    0 12px 32px rgba(0,0,0,0.50);
  --shadow-modal:      0 24px 64px rgba(0,0,0,0.60);
  --shadow-sticky-col: 4px 0 8px -4px rgba(0,0,0,0.50);
}
```

### 19.6 Component heights

```css
:root {
  --height-control-xs:  24px;
  --height-control-sm:  28px;
  --height-control-md:  32px;   /* default button, toolbar control */
  --height-control-lg:  36px;   /* inputs, primary page actions */
  --height-control-xl:  44px;   /* touch targets, marketing CTAs */

  --height-nav-item:    34px;
  --height-nav-subitem: 32px;
  --height-menu-item:   32px;
  --height-badge:       20px;
  --height-chip:        28px;
}
```

### 19.7 Sidebar

```css
:root {
  --sidebar-width:            248px;
  --sidebar-width-collapsed:   56px;
  --sidebar-width-drawer:     280px;
  --sidebar-rail-width:        48px;
  --sidebar-padding-x:         12px;
  --sidebar-item-padding-x:    10px;
  --sidebar-item-gap:           2px;
  --sidebar-icon-size:         16px;
  --sidebar-icon-gap:          10px;
  --sidebar-indent-nested:     28px;
  --sidebar-section-gap:       12px;
  --sidebar-footer-height:     52px;
  --sidebar-bg:                var(--color-sidebar);
  --sidebar-item-active-bg:    var(--color-surface);   /* dark: rgba(255,255,255,.08) */
  --sidebar-item-hover-bg:     var(--color-hover);
}
```

### 19.8 Header

```css
:root {
  --header-height:          56px;
  --header-toolbar-height:  48px;
  --header-padding-x:       20px;
  --header-bg:              var(--color-surface);
  --header-border:          1px solid var(--color-border);
  --header-group-gap:        8px;
  --header-icon-button:     32px;
  --header-avatar-size:     24px;
  --header-avatar-overlap:  -8px;
}
```

### 19.9 Tables

```css
:root {
  --table-radius:              var(--radius-lg);
  --table-header-height:       40px;
  --table-header-bg:           var(--color-background-subtle);
  --table-header-text:         var(--color-text-muted);
  --table-header-size:         var(--text-caption);
  --table-header-weight:       var(--font-weight-medium);

  --table-row-height:          48px;
  --table-row-height-compact:  44px;
  --table-row-height-roomy:    52px;
  --table-cell-padding-x:      16px;
  --table-cell-padding-edge:   20px;
  --table-cell-gap:             8px;

  --table-border:              1px solid var(--color-border);
  --table-row-hover-bg:        var(--color-hover);
  --table-row-selected-bg:     var(--color-selected);
  --table-row-selected-border: 1px solid var(--color-selected-border);
  --table-row-selected-radius: var(--radius-md);

  --table-group-header-height: 44px;
  --table-group-header-radius: var(--radius-md);
  --table-group-gap:           20px;
  --table-footer-height:       48px;
  --table-footer-bg:           var(--color-background-subtle);
}
```

### 19.10 Buttons

```css
:root {
  --button-radius:       var(--radius-md);
  --button-font-size:    var(--text-body);
  --button-font-weight:  var(--font-weight-medium);
  --button-icon-size:    16px;
  --button-icon-gap:      8px;
  --button-padding-x-sm: 10px;
  --button-padding-x-md: 12px;
  --button-padding-x-lg: 14px;
  --button-padding-x-xl: 20px;
  --button-transition:   background-color 120ms ease,
                         border-color 120ms ease,
                         color 120ms ease;
  --button-focus-ring:   0 0 0 2px var(--color-focus-ring);
  --button-focus-offset: 2px;
}
```

### 19.11 Inputs

```css
:root {
  --input-height:           36px;
  --input-height-sm:        32px;
  --input-height-lg:        40px;
  --input-radius:           var(--radius-md);
  --input-padding-x:        12px;
  --input-padding-x-icon:   36px;   /* when a 16px leading icon sits at 12px */
  --input-font-size:        var(--text-body);
  --input-bg:               var(--color-surface);  /* dark: --color-surface-sunken */
  --input-border:           1px solid var(--color-border);
  --input-border-hover:     var(--color-border-strong);
  --input-border-focus:     var(--color-accent);
  --input-ring-focus:       0 0 0 3px var(--color-focus-ring);
  --input-placeholder:      var(--color-text-placeholder);

  --label-size:             var(--text-body-sm);
  --label-weight:           var(--font-weight-medium);
  --label-color:            var(--color-text-secondary);
  --label-gap:              6px;
  --field-gap:              16px;
  --field-group-gap:        24px;
  --help-gap:               6px;
}
```

### 19.12 Cards

```css
:root {
  --card-bg:               var(--color-surface);
  --card-border:           1px solid var(--color-border);
  --card-radius:           var(--radius-lg);
  --card-shadow:           var(--shadow-xs);
  --card-padding:          20px;
  --card-padding-sm:       16px;
  --card-padding-lg:       24px;
  --card-gap:              16px;
  --card-header-gap:       16px;
  --card-title-size:       var(--text-h2);
  --card-title-weight:     var(--font-weight-semibold);
  --card-desc-size:        var(--text-body-sm);
  --card-desc-color:       var(--color-text-muted);
  --card-icon-tile:        32px;
  --card-icon-tile-radius: var(--radius-sm);
  --card-hover-border:     var(--color-border-strong);
  --card-hover-shadow:     var(--shadow-md);
}
```

### 19.13 Overlays (dropdown / modal)

```css
:root {
  --dropdown-min-width:      180px;
  --dropdown-radius:         var(--radius-lg);
  --dropdown-padding:         6px;
  --dropdown-offset:          6px;
  --dropdown-max-height:    320px;
  --dropdown-shadow:        var(--shadow-popover);
  --dropdown-item-height:   var(--height-menu-item);
  --dropdown-item-padding-x: 10px;
  --dropdown-item-radius:   var(--radius-md);

  --modal-width-sm: 400px;
  --modal-width-md: 480px;
  --modal-width-lg: 640px;
  --modal-radius:   var(--radius-xl);
  --modal-padding:  20px;
  --modal-shadow:   var(--shadow-modal);
  --modal-overlay:  var(--color-overlay);
}
```

### 19.14 Motion

```css
:root {
  --duration-instant:  80ms;
  --duration-fast:    120ms;
  --duration-normal:  180ms;
  --duration-slow:    240ms;
  --ease-standard:    cubic-bezier(0.2, 0, 0.2, 1);
  --ease-out-expo:    cubic-bezier(0.16, 1, 0.3, 1);
}
```

*(Motion values are inferred; the references are static. They are chosen to be
short and unobtrusive, matching the restrained visual character.)*

### 19.15 Breakpoints & z-index

```css
:root {
  --bp-sm:   640px;
  --bp-md:   768px;
  --bp-lg:  1024px;
  --bp-xl:  1280px;
  --bp-2xl: 1536px;

  --z-base:      0;
  --z-sticky:   10;   /* sticky table header/footer */
  --z-sidebar:  20;
  --z-header:   30;
  --z-drawer:   40;
  --z-overlay:  50;
  --z-modal:    60;
  --z-dropdown: 70;
  --z-tooltip:  80;
  --z-toast:    90;
}
```

---

## 20. Component Design Rules

The condensed, enforceable version of everything above. When in doubt, follow
these.

### 20.1 Global rules

1. **Every measurement comes from the spacing scale.** 4px base; 2/6/10px are
   the only half-steps. Never 5, 7, 9, 11, 13, 15px.
2. **Every radius comes from the radius scale.** 4/6/8/12/14/16/full. Inner
   radius is always smaller than its container's.
3. **1px borders only.** Two-pixel lines exist only as focus rings and active
   tab underlines.
4. **Three surface levels maximum:** background → surface → surface-elevated.
   If you need a fourth, you're building the wrong component.
5. **One primary button per view.** Everything else is secondary, ghost, or a
   link.
6. **Color signals meaning; grey does everything else.** If a color isn't
   encoding status, identity, data, or the primary action, remove it.
7. **Hierarchy is built with text color first, weight second, size third.**
   Never with hue.
8. **No 700 weight in product UI.** Cap at 600.
9. **Nothing moves on hover.** No lift, no scale-up, no translate. Only
   background, border, and color change — over 120ms.
10. **Every interactive element needs all five states:** rest, hover, active,
    focus-visible, disabled. Focus rings are never removed.
11. **Mobile-first and responsive is mandatory.** Author base styles for the
    smallest screen and scale up. The body never scrolls horizontally, touch
    targets reach 44px below `lg`, and nothing is hover-only on touch. See
    §18.0 — those ten rules are binding on every component here.
12. **Dark mode is not optional either.** Every component ships both themes,
    driven by the tokens in §19.1 rather than hardcoded colors. If a value
    isn't a token, it will be wrong in one of the two themes.

### 20.2 Buttons

- Default height **32px**; inputs and primary page actions **36px**; touch
  **44px**. Radius **8px**. Font 14px/500. Icon 16px, 8px from the label.
- Primary = solid black (light) / solid white (dark). Secondary = white/near-
  transparent with a 1px border. Ghost = no border, no fill until hover.
- Icon-only buttons are square at the same height, radius 8px, ghost by default,
  and require a tooltip plus an accessible label.
- Disabled uses explicit muted tokens, never `opacity`.
- Loading replaces the leading icon with a spinner and locks the width.
- Destructive actions are red **text** by default; a solid red fill is reserved
  for the confirming button inside a destructive dialog.

### 20.3 Tables

- Container: `--color-surface`, 12px radius, 1px border, `overflow: hidden`,
  and it — not the page — owns horizontal scroll.
- Header 40px, 12px/500 muted, sticky, with a 1px bottom border. Add a data-type
  glyph to each header in database-style tables.
- Rows **48px**, vertically centered, separated by 1px hairlines. **No zebra
  striping. No vertical rules in light mode** (dark grid tables are the
  exception).
- Cell padding 16px; first and last cells get 20–24px so they align with the
  panel gutter.
- Primary column: 14px/500 full-contrast. Everything else: 14px/400 secondary.
  IDs: 12px mono muted. Numbers: tabular-nums.
- **Empty cells render an affordance** (`[icon] Add date` in placeholder grey),
  never a blank.
- Hover tints the row ~3%. **Selected rows get a tint plus a full 1px outline
  and an 8px radius** — selection is physical, not just colored.
- Row actions (`···`) fade in on hover, positioned inline after the primary
  content.
- Grouped tables use a tinted status band (status color at 6%) with an 8px dot,
  the group name at 14px/600, and a neutral count chip; groups are separated by
  20px.
- Aggregates go in a sticky 48px footer bar and are themselves clickable.
- Prefer continuous scroll with a sticky header over numbered pagination.
- Below 1024px, tables become stacked cards; hover-revealed controls become
  always-visible.

### 20.4 Cards

- `--color-surface`, 12px radius, 1px border, **20px padding**, `--shadow-xs`
  or none. Gaps between cards: 16px.
- Never give a resting card a prominent shadow. If it needs to float, it's a
  popover.
- Title 16px/600; description 13px/400 muted; header-to-body gap 16px.
- Metric cards carry a 28–32px status-tinted icon tile, a 30px/600 value, a
  right-aligned sparkline, and a delta row (`▲18.4%` green / `▼12.6%` red at
  11–12px/500) beside a muted comparison label.
- Interactive cards change border color (and in light mode gain `--shadow-md`)
  on hover; they never translate.
- List content inside a card runs full-bleed to the card's inner edges with 1px
  `--color-border-subtle` separators.

### 20.5 Forms

- Inputs 36px, 8px radius, 12px padding, 14px/400. Placeholder at
  `--color-text-placeholder`.
- Focus = accent border + 3px accent-alpha ring. Always.
- Labels sit **above** inputs at 13px/500 secondary, 6px gap. Never inline.
- Helper text 12px muted, 6px below; error text replaces it in
  `--color-danger` with a 12px warning glyph.
- Field gap 16px; group gap 24px; footer buttons right-aligned with an 8px gap
  above a 1px top border.
- In dark mode inputs are **darker** than their card; in light mode they are
  flush white with a border.
- Segmented controls: sunken track, 3px inner padding, active segment is a
  white chip with a border and a whisper shadow.
- "Add an item to a list" is always: full-width input + adjacent primary button,
  8px gap.

### 20.6 Navigation

- Sidebar **248px**, items **34px** tall with 8px radius, 16px icons, 10px
  icon-to-label gap, 14px/500 labels, 2px between items.
- **Active nav items change background and color, never weight.** Light mode:
  a white chip with a 1px border and `--shadow-xs`. Dark mode: a flat
  `rgba(255,255,255,.08)` fill.
- Section labels are 11px/600 uppercase with +0.08em tracking, muted; their
  `···`/`+` controls appear on hover.
- Nested items indent to align their text with the parent's text (28px), carry
  no icon, and never nest more than two levels.
- Counts are plain right-aligned muted numerals, not badges — except unread
  alerts, which are round red badges with white text.
- Header is 56px, sticky, `--color-surface` with a 1px bottom border. When a
  toolbar row is needed it is a separate 48px row.
- Toolbar attribute controls use two-tone labels: muted attribute + full-contrast
  value (`Group by **Status**`).
- The right-hand header cluster ends with the single primary action.

### 20.7 Overlays

- Dropdowns: `--color-surface-elevated`, 12px radius, 6px padding, 32px items
  with 8px radius, `--shadow-popover`, 6px from the trigger, min 180px.
- Selected menu items show a trailing accent check and **no background fill**.
- Disabled menu items are placeholder-grey with no hover.
- Group labels inside menus are 11px/600 uppercase muted; dividers are 1px
  full-bleed with 4px of air.
- Modals: 480px default, 14px radius, 20px padding, `--shadow-modal`, over a
  **32% (light) / 60% (dark)** scrim — light enough that context stays readable.
- Modal footers may split: secondary action left, primary pair right.
- Close buttons are 28x28 ghost icon buttons at the top-right, 16px inset.

### 20.8 Badges and status

- Badge: 20px tall, 8px padding, 6px radius, 12px/500.
- **Priority uses bordered soft badges; workflow status uses flat soft badges.**
  Keep the two axes visually distinct.
- Status dots are 8px solid circles (6px with a 2px surface ring when placed on
  an avatar).
- Filter chips are 28px, 6px radius, sunken fill, two-tone label, trailing `×`.
- Light-mode tints are opaque pastels; dark-mode tints are 12% alpha overlays of
  the badge's own hue. Never share the hexes across modes.

### 20.9 Icons

- Outline set, 1.5px stroke at 16px, rounded caps. **16px is the default.**
- Icons are always one contrast step lighter than the text they accompany
  (`--color-text-muted` beside `--color-text`).
- 8px gap in buttons and nav, 10px in sidebar and menu rows.
- Optically center on cap height, not the line box.
- One icon per concept, app-wide. Icon-only buttons always get tooltips.

### 20.10 Dark mode

- **Elevation is lightness, not shadow.** `#0A0A0A` → `#161616` → `#1E1E1E`.
- **Borders lighten the ground** (`#262626`), keeping the seam's contrast
  equal to light mode's.
- **Body text is `#EDEDED`, never pure white.** Pure white belongs to one
  element per screen.
- **All neutral interaction states are white at low alpha** — `.045` hover,
  `.06` selected, `.08` active. Never a hue tint, never a darkening.
- **Inputs recess below their container.** Cards stay lighter than the page.
- **Status colors lighten and their backgrounds become alpha overlays.**
- **Shadows are effectively off** except a soft halo under popovers and modals.
- A component may swap the *mechanism* of a state between modes (the sidebar's
  active chip vs. flat fill) as long as the *meaning* and the geometry stay
  identical.

### 20.11 State representation

| State | How it is shown |
| --- | --- |
| Hover | ~3.5% neutral background shift + text goes to full contrast. Nothing moves. |
| Active/pressed | ~6–8% neutral background shift; optional `scale(0.985)` on buttons only. |
| Selected | Tinted background **plus** a visible 1px border and a rounded corner — selection lifts the element out of its list. |
| Current/active nav | Chip background + full-contrast text and icon. Weight unchanged. |
| Focus-visible | 2px `--color-focus-ring` outline at 2px offset (buttons) or a 3px inset ring on the accent border (inputs). Never removed. |
| Disabled | Explicit muted color tokens on text, icon, and border; `cursor: not-allowed`; no hover response. Never `opacity`. |
| Loading | Spinner replacing the leading icon (buttons) or column-shaped skeleton bars at real row height (tables/cards). Pulse, never shimmer. |
| Empty | Outlined glyph container, 16px/600 headline, 13px muted body capped at ~320px, primary CTA below. Surrounding controls stay visible. |
| Error | `--color-danger` border + ring on the control, 12px danger-colored message replacing the helper text. |

### 20.12 What would break this design language

Explicitly avoid:

- Pure-white page backgrounds with grey cards (inverts the core surface rule).
- Zebra-striped tables.
- Heavy or dark drop shadows on cards.
- 2px borders anywhere but focus rings.
- Bold (700) text in product chrome.
- Colored headings, or using hue to establish hierarchy.
- Multiple solid/primary buttons competing in one view.
- Uppercase text anywhere except 11px section labels and micro tags.
- Saturated full-color badge fills (they must be tinted, with saturated text).
- Hover states that translate, scale up, or animate longer than ~150ms.
- Gradients on buttons, cards, or backgrounds — gradients belong to avatars,
  charts, brand marks, and marketing frames only.
- Blank empty cells where an "add" affordance belongs.
- Naive color inversion for dark mode.
