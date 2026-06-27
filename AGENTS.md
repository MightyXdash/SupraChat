# SupraChat Agent Guide

This repository builds **SupraChat**, the centralized desktop application for the SupraLabs ecosystem.
SupraChat is the primary surface for running and managing SupraLabs models through a packaged, hardware-accelerated `llama.cpp` runtime.
The product should feel deliberate, premium, technically serious, and calm under sustained use.

## Product Intent

- Treat SupraChat as a flagship desktop product, not a generic chat wrapper.
- Default experience: SupraLabs models feel first-party, deeply integrated, and ready to use out of the box.
- Local inference must be first-party, bundled, and optimized through `llama.cpp`; do not add external runtime dependencies.
- Optimize for long sessions, model management, thoughtful reading, and low-friction control.
- Prefer compact, efficient layouts over oversized marketing-style spacing.
- Every system should be designed to scale cleanly, even when the first implementation is local-only.

## Architecture Rules

- Do not hardcode product-critical values when they can be expressed as configuration, tokens, schemas, or reusable modules.
- This applies to both frontend and backend code.
- When adding a new feature, give it proper structure across its service, state, and UI layers instead of collapsing everything into one bloated file.
- New feature work should be organized into focused modules with clear ownership so the codebase reads like a professional application, not a prototype.
- Colors, spacing, radii, shadows, animation timings, runtime labels, model metadata, feature flags, ports, file paths, command templates, and environment-specific behavior should have a defined source of truth.
- Prefer:
  - theme tokens over inline color literals
  - shared constants over repeated magic values
  - typed config objects over scattered conditionals
  - runtime adapters over runtime-specific logic mixed into core flows
  - platform abstractions over OS-specific branches in UI components
- Local-first is acceptable. Hardcoded and brittle is not.
- Build every layer so it can expand without requiring a rewrite of the surrounding system.

## Brand Character

- Tone: warm, precise, composed, premium, technically credible.
- Avoid hype, jokes, slang, filler, and startup clichés.
- Do not write UI copy that sounds synthetic, overly enthusiastic, or “AI assistant” generic.
- Microcopy must be concise and professional.
- Good copy feels authored by a serious product team, not generated.

## Writing Rules

- Prefer direct labels such as `Models`, `Knowledge`, `Settings`, `New Conversation`, `Load Model`, `Runtime`.
- Error and warning text must be calm, specific, and actionable.
- Avoid vague statements like `Something went wrong`.
- Prefer:
  - `Unable to load the selected model. Check the local runtime files and try again.`
  - `SupraChat can make mistakes. Verify important information.`
- Avoid exclamation marks in product UI unless there is a very strong reason.
- Avoid anthropomorphic assistant language unless the product explicitly calls for it.

## Visual Direction

- The product aesthetic is inspired by the provided warm/light and dark palettes.
- The UI should feel similar in refinement to Claude-class desktop software, without directly copying it.
- The interface must look professional, composed, and intentional at all times.
- Do not make the product flashy. Restraint is a requirement, not a preference.
- Minimalism is a critical rule: keep surfaces, controls, color usage, and composition disciplined and necessary.
- Use **glassmorphism** and **frosted glass** selectively.
- Blur should communicate depth and softness, not novelty.
- Do not apply heavy blur to every surface. It must not become a gimmick.
- Maintain strong legibility and separation between layers.
- Dark mode must not drift into a cold blue-tinted aesthetic.
- The dark theme should feel lively, premium, and grounded in warm grey and charcoal surfaces rather than dead black or blue-heavy panels.
- SupraChat must support both a clean white/warm-light theme and a warm charcoal dark theme across the entire app.
- Theme choice should be user-controllable, persisted locally, and initialized from the OS preference when no saved preference exists.

## Color System

Implement the design system with semantic tokens first, then map tokens to theme values.
Do not hardcode palette values throughout components when a token can be used instead.
Light and dark themes must be expressed through CSS custom properties on the document root. Feature components should consume semantic tokens, not choose theme-specific values directly.

### Light Theme Reference

- `--background`: `#ffffff`
- `--surface`: `#ffffff`
- `--sidebar`: `#f9f9f9`
- `--surface-elevated`: `#f3f3f3`
- `--text-primary`: `#1f1f1f`
- `--text-secondary`: `#5f5f5f`
- `--text-muted`: `#8a8a8a`
- `--border`: `#e7e7e7`
- `--accent-primary`: `#9f8a73`
- `--accent-light`: `#eee7dd`
- `--accent-hover`: `#8f7962`
- `--checkbox-accent`: `#2f80ed`
- `--highlight`: `#eeeeee`
- `--sidebar-item-hover`: `#f1f1f1`
- `--sidebar-item-active`: `#ececec`
- `--success`: `#6e8b74`
- `--warning`: `#a98455`
- `--error`: `#b85c4a`
- `--info`: `#5b7da8`
- `--danger-button-text`: `#ffffff`

### Dark Theme Reference

- `--background`: `#1f1f1f`
- `--surface`: `#212121`
- `--sidebar`: `#202020`
- `--surface-elevated`: `#2b2b2b`
- `--text-primary`: `#ececec`
- `--text-secondary`: `#c5c5c5`
- `--text-muted`: `#9b9b9b`
- `--border`: `#373737`
- `--accent-primary`: `#b7a287`
- `--accent-light`: `#342f28`
- `--accent-hover`: `#ccbca3`
- `--checkbox-accent`: `#2f80ed`
- `--highlight`: `#2f2f2f`
- `--sidebar-item-hover`: `#2b2b2b`
- `--sidebar-item-active`: `#303030`
- `--success`: `#7d987f`
- `--warning`: `#d09b4c`
- `--error`: `#c16a5a`
- `--info`: `#7290b8`
- `--danger-button-text`: `#ffffff`

### Theme Surface Tokens

- Use semantic glass and shadow tokens for translucent surfaces, popovers, composer chrome, and drag/titlebar surfaces.
- Required shared tokens include `--glass-top`, `--glass-bottom`, `--glass-panel`, `--glass-border`, `--glass-inset`, `--glass-sheen`, `--shadow-soft`, `--shadow-strong`, and composer-specific tokens such as `--composer-bg-start`, `--composer-bg-end`, `--composer-surface`, `--composer-border`, `--composer-border-focus`, `--composer-ring`, and `--composer-ring-focus`.
- Context visualization colors must also be theme-aware tokens, including `--ctx-system`, `--ctx-user`, `--ctx-assistant`, `--ctx-unused`, `--ctx-ring-center`, and `--ctx-popover-bg`.
- Additional UI surface tokens in active use include `--overlay-dim`, `--search-overlay-dim`, `--search-surface`, `--search-border`, `--search-shadow-soft`, `--search-shadow-strong`, `--sidebar-item-hover`, `--sidebar-item-active`, and `--checkbox-accent`.
- Do not use fixed light-only RGBA shadows, white overlays, or pale borders outside canonical theme token definitions.

### Color Usage Rules

- Accent color is warm gold/caramel, not neon orange.
- Success should remain muted and botanical, not bright green.
- Warning and error should stay sophisticated and softened, never saturated dashboard colors.
- Preserve low-glare contrast in dark mode.
- Avoid introducing unrelated accent families, especially purple-heavy defaults.
- Do not ship a dark theme built around blue-black surfaces unless a feature explicitly requires a distinct informational state.
- Dark surfaces should stay in the warm grey / charcoal family and retain enough tonal variation to feel alive.
- All colors must be tokenized. Do not spread raw hex values across component files unless defining the canonical theme tokens themselves.
- Any new UI must be checked in both light and dark themes before handoff.

## Typography

Preferred font direction:

- UI sans: `Geist`, `Manrope`, or `Sora`
- AI longform/output serif: a readable editorial serif used selectively for response content

Typography rules:

- Use sans for navigation, controls, settings, metadata, and dense UI.
- Use the serif only where it improves reading quality, especially model output or long responses.
- Do not overuse the serif in dashboards, forms, menus, or toolbars.
- Typography should feel compact and polished, not oversized or airy for its own sake.
- Avoid default system-looking stacks when a project font is available.

## Layout Principles

- Build for desktop first, but keep layouts responsive and stable on smaller widths.
- Every UI element should remain proportionally scaled across screen sizes and aspect ratios so the interface stays balanced rather than stretched, cramped, or oversized.
- The app should support three common zones cleanly:
  - navigation/sidebar
  - primary conversation or work surface
  - secondary inspector/settings/runtime panel
- Establish clear visual hierarchy in every screen so attention naturally flows from primary actions and content to secondary controls and metadata.
- Preserve visual hierarchy with restrained borders, soft elevation, and deliberate spacing.
- Favor compact controls and dense but readable information layouts.
- Keep layouts minimal and professional. Remove decorative or redundant elements that do not improve comprehension or task flow.
- Avoid empty decorative space that does not improve comprehension.

## Glass and Surface Rules

- Use frosted or blurred surfaces for elevated panels, drawers, modals, overlays, and selected side panels.
- Base surfaces can remain mostly solid when clarity is more important than atmosphere.
- Combine blur with translucent fills and subtle borders.
- Preferred borders are low-contrast and warm.
- Shadows should be soft and diffused, not glossy or game-like.
- If a surface becomes harder to read because of blur, reduce the effect immediately.

## Motion Rules

- Motion should feel continuous, quiet, and high-confidence.
- Motion must feel smooth in both timing and spatial continuity.
- Preferred easing: `ease-out` and `ease-in-out`.
- Add a small, tasteful end bounce only where it creates a natural physical finish.
- Do not bounce everything.
- Prioritize transition continuity between panel changes, composer expansion, message entry, hover states, dropdowns, and route-level state changes.
- Avoid abrupt opacity pops when a subtle slide or blur transition would read better.
- Motion should support focus, not call attention to itself.
- Animation durations and easing curves should come from shared motion tokens, not ad hoc per-component values.

## Interaction Design

- Controls should feel precise and tactile.
- Hover, pressed, selected, and disabled states must be clearly differentiated.
- Primary actions should use the warm accent and feel intentional.
- Secondary actions should remain quiet but still legible.
- Toggles, sliders, badges, menus, and model selectors should feel premium and consistent across themes.
- Avoid generic default component styling when the brand system can be expressed more clearly.

## Model and Runtime UX

- SupraLabs models are the default first-class experience.
- The packaged `llama.cpp` runtime is the only supported model execution path.
- Runtime-specific capabilities, errors, and setup states should be surfaced clearly.
- Model setup, execution, and status display must be understandable without exposing raw implementation detail to typical users.
- When designing model controls, prefer language that communicates trust and operational clarity.

## Cross-Platform Engineering Rules

- Any OS-specific behavior must be abstracted behind a stable application interface.
- Do not scatter raw shell commands, path assumptions, or runtime execution details throughout the UI layer.
- Keep platform differences isolated in dedicated service, adapter, or command modules.
- Normalize:
  - command invocation
  - path handling
  - model install and loading flows
  - background process execution
  - environment detection
- When implementing model execution or runtime setup, design once for Windows, macOS, and Linux rather than patching one-off fixes per platform.
- Avoid requiring repeated manual code edits for each OS at compile time.
- Backend flows should be extensible whether the runtime is local, bundled, or later moved behind a service boundary.

## Frontend Implementation Rules

- Use shared theme tokens, CSS variables, or equivalent primitives as the source of truth.
- Reuse components and patterns rather than creating visually inconsistent one-off widgets.
- When shipping a new feature, implement the UI in dedicated, organized files instead of letting feature logic, service logic, and rendering accumulate inside one oversized component.
- shadcn/ui components should be customized to match SupraChat, not left in stock form.
- Framer Motion should be used with restraint and purpose.
- Zustand state should remain structured and domain-oriented, not dumped into a single global store.
- Prefer explicit UI states for loading, empty, syncing, connected, installing, and failed conditions.
- Do not hardcode colors, component sizes, radii, animation timings, or layout constants directly in feature components when a shared token or primitive should own them.
- UI architecture should make theme expansion, model expansion, and layout evolution straightforward.

## Backend Implementation Rules

- Do not hardcode runtime behavior directly into route handlers or process entrypoints.
- Separate transport, orchestration, runtime integration, storage, and platform execution concerns.
- Command execution, model loading, runtime discovery, and runtime configuration should be implemented through clear interfaces.
- Treat local execution as one deployment mode, not as an excuse for tightly coupled architecture.
- Storage schemas and API payloads should be designed to tolerate model metadata growth and settings expansion.

## Accessibility and Readability

- Maintain readable contrast in both themes.
- Ensure text remains legible over translucent or blurred surfaces.
- Focus states must be visible and keyboard interaction must remain reliable.
- Do not sacrifice usability for visual atmosphere.
- Dense UI is acceptable; cramped UI is not.

## What To Avoid

- Do not make the app feel like a template SaaS dashboard.
- Do not introduce bright blue/purple gradients that fight the warm SupraLabs palette.
- Do not overuse blur, glow, or glass effects.
- Do not write cheesy AI copy or overfriendly assistant messaging.
- Do not make UI text verbose.
- Do not implement OS-specific hacks directly inside React components when they belong in a platform layer.

## Change Expectations For Agents

When making changes in this repository:

- Preserve the SupraLabs brand direction above.
- Keep naming, text, spacing, motion, and component styling consistent with this guide.
- If adding new colors, fonts, or motion patterns, they must fit this system and not dilute it.
- Prefer incremental refinement over broad, inconsistent redesigns.
- If a requested change conflicts with this document, ask for clarification before proceeding.
