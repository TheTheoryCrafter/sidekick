# Sidekick

A website pet (like PostHog's hedgehog / oneko.js): a pixel pet that roams on top of
any page, reacts to the visitor and to host-site events, and poops now and then.
Framework-agnostic TypeScript core, no runtime dependencies, rendered in a Shadow DOM.

## Commands
- `npm run dev`: Vite dev server on http://localhost:5199. Demos are at `/demo/index.html`.
- `npm test`: Vitest unit tests (pure logic only, Node environment).
- `npm run typecheck`: `tsc --noEmit`.
- `npm run build`: library build (set up in M7).

## Layout
- `src/core/`: pure logic, no DOM access, fully unit-tested. Manifest, roles, sprite
  timing, and later behavior, rules and physics.
- `src/dom/`: browser layer (host, renderer, input, surfaces, poop, sensors, storage, menu).
- `src/entries/`: script-tag IIFE, ESM and React wrapper.
- `pets/<id>/`: `manifest.json` plus the sprite sheet. Adding a pet requires no code changes.
- `demo/`: one demo page per milestone, served by Vite. Not shipped.
- `test/`: Vitest specs for `src/core`.

## Decisions
Keep this list current. Add to it whenever a choice is made.

**Pets and manifests**
- A manifest is validated by `validateManifest`. It never throws. Bad animations or roles are
  dropped with a warning, and only a manifest with no usable animation is rejected.
- Optional manifest fields and their defaults: `col` (0), `loop` (true), `anchor`
  (bottom centre), `facing` (`"right"`), `traits` (speed 1, jumpiness 0.2, clinginess 0.5),
  and `sheetSize` (only used to bounds-check animations).
- Behavior refers only to **roles**, never to animation names. `ROLE_FALLBACKS` in
  `src/core/roles.ts` defines the fallback chain for each role. Every chain ends in `ambient`
  and then the first animation, except roles in `ROLES_WITHOUT_DEFAULT` (`poopEntity`). A pet
  without `poopEntity` simply leaves no visible poop.
- A role may map to a list of animations, and one is picked at random through an injected rng.
- cream-cat `poop-pile` is 4 frames, not 5. The sheet's 5th cell holds only a 6-pixel stray
  wisp, which made the looping pile blink out once per cycle.

**Rendering (from M1)**
- Each sprite is a `div` with `background-image`/`background-position` and
  `image-rendering: pixelated`, and mirroring uses `scaleX(-1)`.
- Crispness: one sheet pixel equals `round(scale Ã— devicePixelRatio)` device pixels
  (`SpriteView.pixelSize`), and positions are snapped to whole device pixels. At a DPR of
  1.25, scale 3 is therefore 3.2 CSS px per sheet pixel, which is exactly 4 device pixels.
- `SpriteView` writes a style property only when its value changed (size, frame, transform).
- The host is a custom element `<sidekick-pet>` appended to `<html>`, after `<body>`, so
  frameworks that hydrate `<body>` never see it. The custom tag is immune to `div {}` rules.
  Its own styles are inline `!important` with `all: initial`, so even
  `* { ... !important }` on the site can't reach it.
- Bodies use viewport CSS px with `(x, y)` at the manifest anchor (the feet). The floor is
  `documentElement.clientHeight`, and walk bounds keep the whole sprite on screen whichever
  way it faces.
- Walk speed is 30 sheet px/s Ã— pixel size Ã— `traits.speed`.
- `petsBaseUrl` defaults to `/pets/`. The script-tag build will derive it from its own `src`
  (M7).
- **CSP-safe.** Styles are set only through CSSOM properties (`el.style.foo = ...`). There
  are no `<style>` tags, no `style=""` attributes, no `eval` and no `new Function`.
- Two layers inside one Shadow DOM host. The pet uses a `position: fixed` layer in viewport
  coordinates, where the bottom of the viewport is the floor. Poops use a layer anchored to
  the document, so they scroll with the page without JS.
- The overlay root has `pointer-events: none`. Only the pet's hitbox, the poops and the menu
  accept pointer events. The host is `aria-hidden="true"`.
- One `requestAnimationFrame` loop drives a fixed-timestep simulation that calls pure
  `step()` functions. It pauses while `document.hidden`.

**Behavior and rules (from M2)**
- M1 ships a placeholder brain, `src/core/wander.ts`: idle for 3â€“9 s with a random ambient
  animation, or walk to a random spot at least 80 px away. One-shot ambient animations are
  swapped for another when they finish. In M2 the action/rule engine takes over the
  decisions, and `PetBody` plus the `anim`/`animStart` bookkeeping are kept.
- Simulation time (`simTime`) advances only in fixed 1/60 s steps while the loop runs.
  Animation timing uses sim time, so pausing never skips frames. Frame gaps over 250 ms
  are capped, not fast-forwarded.
- Actions and rules are plain data. An action is built from a small set of motion primitives
  written in code (none, wander, run, jump-to-surface, follow-cursor). Advanced hosts may
  pass a custom `step` function.
- A rule looks like `{ id, on | condition, chance, cooldownMs, priority, when, action }`.
  The rule engine is pure and gets `now` and `rng` injected.

**Platform**
- **Singleton.** The instance lives under `Symbol.for('sidekick')` on `window`
  (`INSTANCE` in `src/dom/sidekick.ts`). A second `init` returns the existing instance and
  ignores its options. `destroy()` clears the slot, so a later `init` starts a fresh pet.
- **SSR-safe.** No top-level access to `window` or `document`, and `init` does nothing
  without a DOM.
- Page changes are detected by polling `location.href` in the loop. `history` is never
  monkey-patched.
- `prefers-reduced-motion`: no autonomous movement and no jumps. Only idle and reaction
  animations play, and the pet still moves when dragged.
- Settings are stored in localStorage under `sidekick:v1` (`{enabled, petId, position}`).
  Every access is wrapped in try/catch, and changes sync across tabs through the `storage`
  event.
- Poops are never placed where a link, button, form control, `[role=button|link]`,
  `[tabindex]` or `[contenteditable]` lies underneath.

**Tooling and distribution**
- Single npm package `sidekick-pet` with several entry points (core ESM, IIFE, `/react`).
  Vite library mode, Vitest and TypeScript strict with `noUncheckedIndexedAccess`.
- Dev dependency versions are pinned exactly.
- The theorycrafter.com integration is done by the user through Lovable. This repo ships
  the package and an integration guide, and does not edit that site's repo.

## Conventions
- Pure modules take time and randomness as parameters (`now`, `rng`). Never read
  `Date.now()` or `Math.random()` deep inside `src/core`.
- No runtime dependencies. Keep the bundle small, with a budget of about 12 kB gzipped for
  the core (checked in M7).
- Demos may use `<style>` tags. Library code may not.

## Milestones
- [x] M0 Scaffold, manifest validator, role resolver, sprite viewer
- [x] M1 Shadow DOM host, renderer, loop, walk and idle along the floor
- [ ] M2 Behavior and rules engine, random idle actions, debug panel
- [ ] M3 Interaction: hover, near, click, double-click, tap, drag, drop and throw
- [ ] M4 Surfaces: standing on and jumping between elements
- [ ] M5 Poop
- [ ] M6 Host events, sensors, persistence, built-in menu
- [ ] M7 Packaging (IIFE, ESM, React), SSR, CSP, size budget, reduced motion
- [ ] M8 Integration guide for theorycrafter (React Router + shadcn profile menu, via Lovable)
- [ ] M9 README

## Open notes
- cream-cat artwork faces **right**. Checked in the M0 viewer: walk, run and jump all head
  right, so the default `facing: "right"` is correct.
- Commits use the repo-local identity `shrikarreddyk <shrikarreddyk@gmail.com>`. The
  machine's global identity is a work account, so never use it here.
- Node 24 LTS was installed via winget (2026-10-28). The preview tool reads
  `C:\Users\User\.claude\launch.json`, and the `sidekick-dev` entry there starts Vite for
  this repo.
