# SqueekRaider implemented design

## Overview

SqueekRaider is a cooperative hamster raid on the Sepolia test network. The interface is dark only, compact and centered on the owl's health and the free-play action. Pixel animals carry the visual identity; ordinary readable text carries controls and rules. The first phone screen includes the product, boss state, wallet and Play free.

This document is in `docs/` because the assignment's overriding path budget prohibits a root-level `DESIGN.md`. It describes the final source, not a proposed redesign. Sources are `web/src/styles.css`, `App.tsx`, `Wallet.tsx`, `Art.tsx` and `transactions.tsx`.

## Colors

All UI colors are semantic CSS properties in `styles.css :root`. Contract art and official wallet marks retain their own palettes.

| Token | Value | Implemented role |
| --- | --- | --- |
| `--color-bg` | `#111610` | Page, form field backgrounds, meter track |
| `--color-surface` | `#1a2118` | Raid scene, free-play panel, raider card, modal |
| `--color-raised` | `#252e22` | Neutral buttons, wallet rows |
| `--color-hover` | `#323d2b` | Hovered neutral controls |
| `--color-text` | `#f2f1e5` | Primary text |
| `--color-muted` | `#b5beab` | Secondary text and labels |
| `--color-border` | `#414c38` | Structural boundaries and field borders |
| `--color-accent` | `#d3e98e` | Main action fill, links, active navigation |
| `--color-accent-hover` | `#e3f5ad` | Main action hover |
| `--color-on-accent` | `#18200e` | Main action text |
| `--color-health` | `#c69d74` | Owl HP fill and scene stars |
| `--color-cover` | `#a6c69b` | Guard meter and positive status cue |
| `--color-warning` | `#f3c49c` | Pending changes, KO and moon symbol |
| `--color-error` | `#ffc0b5` | Persistent failure text |
| `--color-focus` | `#edf5cd` | Keyboard focus perimeter |

Measured rendered pairs on the final export: heading/page 16.13:1, secondary text/page 9.53:1, secondary text/surface 8.57:1, and main action text/fill 12.63:1. The probe also checked resolved solid text backgrounds. These measurements do not establish contrast inside contract artwork or external wallet marks.

There is no theme switch, gradient, or alternate palette. State is also written in words: KO, pending, protected, stale, failed or confirmed.

## Typography

The implemented system stack is `'Trebuchet MS', 'Segoe UI', sans-serif`; there is no downloaded font. The available platform fallback renders when those system fonts are absent. Screenshots establish the resulting appearance, not availability of either named face on every system.

Five size roles are defined: small 14px, body/input 16px, subheading 18px, section 24px, title 44px. Under 640px the title becomes 36px. Weights are 400, 600 and 700; h1 alone uses 700. Headings balance text, with title line-height 1.1 and -0.045em tracking; section headings use 1.2 and -0.025em. Body line-height is 1.5. Long rules are limited to 78ch and supporting copy usually to 70ch. Numeric values use tabular figures.

Inputs remain 16px on phones. Addresses, IDs and large counters wrap with `overflow-wrap: anywhere`; critical values are not clipped. The header's short wallet address opens a sheet with the full checksummed address, copy and explorer actions. There are no small tracked capital kickers. The exact “TEST NETWORK” notice is required by the brief.

## Layout

Shared content width is at most 1120px with 32px side margins; under 640px margins become 16px. Header, network notice, navigation, main and footer share these edges. Common intra-group spacing is 6–12px, controls use 12px gaps, panels use 16–24px padding, and major groups use 20–32px gaps. These are actual declarations rather than a separate spacing-token API.

At desktop width `.raid-grid` uses `minmax(0,1.6fr)` and `minmax(0,1fr)`: the scene spans two rows, with free play and the next move beside it. Below 900px the columns become 1.3:1, the nap panel spans the full width and party counts use two columns. Below 640px the raid becomes a single column: owl, free play, next move, party and Advance. At 360px and below the four navigation links form two rows, preserving legible full labels.

At 390×844 the Play free button was measured at y=694.39–738.78 and the wallet button at y=16–60. The owl and health appear above the main action. No sideways scroll was observed at 320, 390, 768 or 1440 across the four routes with large counters, and the live raid was additionally inspected at 320, 390 and 1440. These viewport tests are not a physical-device test or native zoom session.

Raider cards place a 220px art column beside their state/actions, then stack under 640px. Real art occupies the hamster region of the contract card (50% width, 38.1% height; x=25%, y=21.4%), preserving its frame and stance item. Lists, batch controls and tables reflow; long cell values wrap.

## Elevation & depth

Panels use flat tonal layers and quiet structural borders. There are no panel shadows. The owl alone has a small pixel drop shadow as illustration. Native dialog top-layer behavior establishes modal elevation; its backdrop is `#070a07d9`. Nothing is sticky over page text.

## Shapes

Neutral controls and fields use 6px radii; party items and status notes use 8px; scenes, free play and raider panels use 12px. The desktop wallet sheet uses 16px; below 640px it becomes a full-width bottom sheet with only top corners rounded. Meters have 3px outer and 1px fill radii, with padding inside the track. SVG animals render with crisp pixels.

## Components

| Component/pattern | Source | Reuse and behavior |
| --- | --- | --- |
| `Wallet` | `web/src/Wallet.tsx` | One header utility; connected identity, wrong-chain action, extension/mobile/Smart Wallet sheet. Native focus trap, Escape/backdrop close and trigger focus return. |
| `Action`, `TransactionStatus` | `web/src/transactions.tsx` | Simulate → wallet → receipt; only the active action's label changes. Costs are in the action label/context. Unknown receipts keep the submission lock and offer rechecking. |
| `StanceSelect` | `web/src/App.tsx` | Labelled native select for free play and batches; use unique IDs. |
| `FreePlay` | `web/src/App.tsx` | Compact entry to enlistDemo; shows the existing demo destination when registered. |
| `RaiderCard` | `web/src/App.tsx` | Contract card, optional real Squeek artwork, full state, pending change, action prerequisites and Scrap prices. |
| `Note` and `.notice` | `web/src/App.tsx`, CSS | Loading, empty and recoverable errors. Persistent text, no transient toast dependency. |
| `.meter`, `.section-head`, `.button-row`, `.field` | CSS | Reusable progress, heading alignment, wrapping controls and labelled fields. |
| `Hamster`, `StanceIcon` | `web/src/Art.tsx` | Prescribed pixel hamster and one consistent 1.5px outline icon set. Decorative art is hidden from assistive technology. |

Controls have rest, hover, focus, pressed and disabled states. All transaction buttons have at least 44px height. Hover is gated by pointer capability. `:focus-visible` is a 2px perimeter with 3px offset; forced-colors uses `Highlight`. Under `prefers-reduced-motion: no-preference`, button feedback alone uses named 120ms background/transform transitions and a 0.96 press scale. There are no endless animations. Reduced motion leaves static feedback.

## Do's and don'ts

Start another page with the shared main width, a single h1 and the existing `.page-title`; add its hash route to the same navigation. Reuse `.field`, native controls and `Action` for contract work. Read configuration and ABI from the runtime manifest. Pair a disabled action with its relevant state/cost and a recovery path. Keep all on-chain quantities bigint.

Keep the pixel illustrations, one filled main action and restrained flat surfaces. Avoid another hero, tracked labels, alternate palettes, hidden address truncation, mock “live” data, or duplicated deployment constants. New contract actions must use the same verification, simulation and receipt flow.

Design guidance: Better Interface by Jakub Krehel (MIT) and the documentation method from Impeccable by Paul Bakaus (Apache-2.0), at the pinned revisions; notices and licenses are retained in `docs/frontend/DESIGN-LICENSE`. Review coverage and unperformed checks are recorded in `docs/FRONTEND-VALIDATION.md`.
