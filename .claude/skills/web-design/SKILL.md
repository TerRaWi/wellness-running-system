---
name: web-design
description: Design or restyle web UI so it looks deliberately crafted by a human designer, not generic AI output. Use when building or polishing pages, components, or LINE LIFF screens.
disable-model-invocation: true
---

# Web Design — make it look designed, not generated

Goal: every screen should look like a designer made specific choices for THIS product.
Generic = failure, even if it is "clean".

## 1. Decide a direction before writing any CSS

Write 3 lines (in a code comment or reply) before coding:
- **Mood**: 2–3 words (e.g. "calm clinical", "sporty energetic", "warm community").
- **Reference**: a real-world thing it should feel like (a running app, a printed race bib, a hospital signboard, a magazine).
- **One signature element**: the single thing people will remember (a bold number style, a progress track motif, an unusual layout, a texture).

Every later choice must serve those 3 lines.

## 2. Banned "AI look" patterns (do not use unless the user asks)

- Purple/indigo → blue/pink gradients, gradient text, gradient buttons.
- Inter / Roboto / system font as the only typeface with no hierarchy.
- Centered hero + subtitle + two buttons + row of 3 identical icon cards.
- Glassmorphism, frosted blur cards, glowing blobs in the background.
- `rounded-2xl` + soft drop shadow on everything.
- Emoji or ✨ in headings and buttons; Lucide icon in a pastel circle on every card.
- Fake stats ("10,000+ happy users"), lorem-ish marketing copy, "Unlock your potential".
- Every section the same width, same padding, same alignment.
- Dark mode = just invert to #0f172a navy with neon accents.

## 3. Color

- Build a small palette: 1 neutral scale (5–7 steps), 1 primary, max 1 accent, plus status colors (success/warn/danger).
- Neutrals slightly tinted toward the primary hue — never pure #000 / pure gray.
- Accent used sparingly (≤10% of the screen): key number, primary action, active state.
- Define everything as CSS variables on `:root`; no hard-coded hex in components.
- Check contrast: body text ≥ 4.5:1.

## 4. Typography (does most of the work)

- Use a clear scale (e.g. 12/14/16/20/28/40/56) — big jumps between levels, not 16 vs 18.
- Pair: one display face for headings/numbers + one readable text face. Numbers in stats should use `font-variant-numeric: tabular-nums`.
- Thai text:
  - Good text faces: IBM Plex Sans Thai, Noto Sans Thai, Anuphan, Sarabun.
  - Display options: IBM Plex Sans Thai (bold), Anuphan, Bai Jamjuree, Chakra Petch (sporty/techy).
  - Avoid defaulting to Kanit/Prompt for everything — overused.
  - Thai needs more line-height than English: body `line-height: 1.7–1.8`, headings ~1.3.
  - Never letter-space Thai text; never use all-caps tricks on Thai.
- Limit to 2 families, 3–4 weights total.

## 5. Layout & spacing

- Use a spacing scale (4/8/12/16/24/32/48/64) — no random values.
- Vary rhythm: some sections tight, some airy. Break the grid at least once on purpose (an oversized number, an offset image, a full-bleed band).
- Left-align body content; center only short, deliberate moments.
- Mobile first (LINE LIFF ≈ 360–420px wide). Thumb-reachable primary actions at the bottom.
- Group with spacing and alignment first; borders/cards only when grouping really needs it.

## 6. Components

- Corner radius: pick ONE system (e.g. 4px sharp, or 12px soft) and apply consistently; pills only for tags/chips.
- Shadows: almost none. Prefer 1px borders or background contrast. If used, one subtle elevation level.
- Buttons: one primary style per screen. Secondary = text or outline.
- Icons: one icon set, one stroke weight, only where they add meaning.
- Empty states, loading (skeletons), and error states must be designed, not left blank.

## 7. Details that read as "human-made"

- Real content: realistic Thai names, real units (กม., นาที/กม.), plausible numbers, real dates.
- Micro-interactions: 150–200ms transitions, visible `:focus-visible` rings, pressed states on touch.
- Respect `prefers-reduced-motion`.
- Consistent number formatting (1,234.5 กม.), dates in Thai format where appropriate.
- One small moment of personality tied to the product (e.g. a running track line, a finish-line stripe, a medal shape) — not decoration for its own sake.

## 8. Process

1. State the direction (section 1).
2. Define tokens (colors, type scale, spacing, radius) as CSS variables.
3. Build the layout with real content.
4. Self-review against section 2 (banned list) — remove anything that matches.
5. Check at 375px width and at desktop; check Thai line breaks and overflow.
6. Summarize the design choices in 3–5 bullets so the user can push back.

## When restyling existing code

- Keep logic, data flow, and IDs/classes used by JS untouched.
- Change tokens first, then components, then layout — smallest diff that achieves the direction.
- Show before/after reasoning briefly; do not rewrite the whole app to change styling.
