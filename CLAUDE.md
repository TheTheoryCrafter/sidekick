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
  timing, behavior registry, brain and defaults, and later physics.
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
  (bottom centre), `facing` (`"right"`), `hitbox` (the whole frame), `traits` (speed 1,
  jumpiness 0.2, clinginess 0.5), and `sheetSize` (only used to bounds-check animations).
  `traits.jumpiness` and `traits.clinginess` scale the chance of the jump and approach rules (`scaleBy`).
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
- Crispness: one sheet pixel equals `round(scale × devicePixelRatio)` device pixels
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
- Walk speed is 30 sheet px/s × pixel size × `traits.speed`.
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

**Behavior and rules (M2)**
- `src/core/behavior.ts` holds the data types plus the `Behavior` registry. `src/core/brain.ts`
  runs it (pure `stepBrain`, `dispatch`, `play`). `src/core/defaults.ts` holds the default
  actions, rules and conditions. The M1 placeholder `wander.ts` is gone.
- An **action** is `{ id, steps[], interruptible = true, next? }`. A single-step action may
  be written inline as `{ id, role, motion, duration }`. A **step** is
  `{ role, motion?, duration?, speed?, emit? }`.
- **When a step ends.** If it has a duration, it ends when the duration runs out. Otherwise:
  a moving step ends on arrival (or at once if there's no room to move), an untimed step with
  a one-shot animation ends when the animation finishes, and an untimed step with a looping
  animation ends after 3 s (`DEFAULT_STEP_MS`). A one-shot animation inside a longer step is
  re-picked from its role rather than frozen on its last frame.
- **Motions** are `none`, `wander` (at least 80 px, walk speed) and `run` (at least 40% of the
  width, 3× speed). These are the only behavior written in code. M3 and M4 add more.
- A **rule** is `{ id, on = 'tick', if: string[], chance = 1, cooldown = 0, priority = 0,
  during?, notDuring?, action }`. Rules are tried highest priority first, and the first one
  that matches and passes its `chance` roll wins. `chance` is only rolled for rules that
  otherwise match, which keeps tests deterministic.
- **Built-in events.** `idle` fires when nothing is running. If no idle rule fires, the
  `__fallback` action plays the ambient role for 3–8 s. `tick` fires every 1 s of sim time.
  Every other event comes from `emit()`.
- **Priority is the interruption level.** A started action takes its rule's priority. A rule
  may interrupt the running action only if that action is interruptible and the rule's
  priority is at least the action's. `play(id, priority = 0)` starts an action outside the
  rules, and at priority 0 any event can still interrupt it. (An early version defaulted to
  100, which meant a cat put to sleep with `play` never woke up.)
- **Conditions** are named functions `(ctx) => boolean` that get `{ now, hour, action,
  lastDone, payload }`. A rule that names an unknown condition never fires. The built-in
  conditions are `sleepy` (3 sim-minutes since the last nap) and `night` (22:00–06:00
  local).
- **Defaults.** Free-time rules, by priority: sleep-at-night 51, sleep-when-sleepy 50,
  zoomies 40, hide 30, walk 10, sit 0. Event rules: `tool-completed` → eat (60),
  `success` → celebrate (60), `error` → faint (70), each with a 3 s cooldown.
- Registering an action or rule with an existing id replaces it, so hosts override defaults
  that way. Registration never throws; it returns and logs warnings.
- The brain returns **effects** (`action-start`, `action-end`, `emit`, `event`), which the
  instance forwards to `on(listener)` listeners. Up to 10 events emitted before the pet
  loads are queued.
- The role `tired` is new, with fallback → ambient. Sleep plays `tired`, then `sleep`, and
  the cream cat maps `tired` to `yawn`.
- `setTimeScale(1–60)` is a debug aid that speeds up sim time, motion included.

**Poop (M5)**
- **The action.** It is `{ role: 'poop', emit: 'poop', interruptible: false }`. A grab still
  cancels it, and then nothing is dropped. The pile is dropped when the step's `poop` emit
  reaches the instance, and only if the spot is still safe.
- **Placement.** The pile sits behind the pet on its tail side, 0.6 pet widths from its
  feet (`poopSpot`), and is drawn under the pet.
- **Rules.**
  - Free time: `poop` at priority 33, chance 0.05, 90 s cooldown, `if: 'poop-spot'`.
  - `poop-cleaned` → celebrate (chance 0.5, not while asleep).
  - The pure default for `poop-spot` is `false`. The instance replaces it: true when poop
    is on, the pet has its own `poopEntity` role, fewer than `max` piles exist, and the
    spot is safe. A pet without a pile sprite never poops.
- **Safety check** (`PoopLayer.isSafeAt`).
  - The pile's footprint must be fully inside the viewport.
  - None of 9 points inside the footprint, nor 3 points just below it across its width,
    may land on `INTERACTIVE_SELECTOR` (links, buttons, form controls, ARIA widgets,
    `[onclick]`, `[tabindex]`, contenteditable, media, iframes) or inside one.
  - The probes use `elementsFromPoint`, skipping our host. The 3-point "below" check was
    added after a pile slipped through the gap between two buttons.
- **Footprint.** The pile's opaque bounds are measured once from the sheet with a canvas.
  If the sheet is cross-origin without CORS, the fallback is the centre half of the frame.
  Only that area takes clicks.
- **Pinning.** A pile is pinned to the surface element under the pet (`{ el, dx, dy }`,
  re-measured every frame, so it follows scrolling, inner scroll boxes and layout shifts),
  or to the page in document coordinates when the pet is on the floor. If its element
  leaves the DOM (a route change), the pile is removed. Piles live in the same fixed
  stage, so there is still one Shadow DOM layer.
- **Lifetime.** Clicking a pile removes it with a 200 ms opacity fade (a CSSOM transition)
  and emits `poop-cleaned`.
  - The `poop` option is `true`, `false` or `{ max = 5, ttl = 10 min }`.
  - `ttl` counts sim time, so piles don't expire while the tab is hidden.
  - Beyond `max`, the oldest pile goes. `clearPoops()` removes them all.

**Surfaces and jumping (M4)**
- **Surfaces are one-way platforms.** A page element's top edge is a `Surface
  { id, left, right, top }` in viewport px. `BrainState.on` holds the surface id, or null
  for the floor. A falling pet lands on the highest top edge it crosses on the way down
  (`landingSurface`), so drops and throws land on elements too.
- **Riding scroll.** The surface underfoot is re-measured every step (`measureOne`), so the
  pet moves with it exactly.
  - If the surface disappears, the pet slides off its edge, or the edge goes above `minY`
    (scrolled out the top), the pet falls and its action ends.
  - If the edge scrolls below the window, the pet snaps back to the floor.
- **Walking on a surface.** `wander`, `run` and `follow` stay within the surface's span.
- **The `jump` motion** picks a reachable target (`findJumpTarget`).
  - In reach means at most 4 pet heights up, 7 pet widths sideways, not the current
    surface, and inset half a pet width from the edges. From a surface, the floor is
    always an option.
  - The jump is ballistic: the apex sits 0.6 pet heights above the higher end, and the
    flight doesn't bounce.
  - A jump landing finishes the jump step and does not run the `land` rules. It still
    reports a `land` event with payload `{ impact, thrown, jumped, surface }`.
- **Skipped rules.** A rule is skipped when its action's first motion can't happen right
  now (`canStart`): `follow` without a cursor, or `jump` with nothing in reach.
- **Trait-scaled chance.** `scaleBy: 'jumpiness' | 'clinginess'` makes a rule's chance
  `chance × trait × 2`, capped at 1. The default free-time `jump` rule is chance 0.5 scaled
  by jumpiness (0.2 for the cream cat), with a 6 s cooldown and priority 35. `near-approach`
  is scaled by clinginess. `ConditionCtx` gains `onSurface`.
- **Finding surfaces** (`src/dom/surfaces.ts`) is a two-speed scan.
  - Discovery runs `querySelectorAll` every 2 s, keeping up to 400 elements and skipping
    the host and anything inside `[data-sidekick-ignore]`.
  - Measurement runs at most every 120 ms, only after a scroll or resize (both listened
    for in the capture phase, so inner scroll boxes count).
  - A surface is kept if its top is visible, its height is at least 4 px, it is wider than
    the pet's hitbox, `checkVisibility` passes, its top edge is not covered (checked with
    `elementFromPoint` at 25% and 75% of its width, so it isn't under a sticky header or
    modal), and it isn't a duplicate of another edge.
  - The default selector covers headings, `p`, media, form controls, `li`, landmarks,
    `[role=button]` and `[data-sidekick-surface]`. Plain `div`s are not included, so cards
    count only through their contents unless they opt in.
- **The `surfaces` option** takes a selector string, or `false` to keep the pet on the floor.
  `debugSurfaces()` is a demo aid.
- **Measured:** the M4 demo runs with at most 6 ms frames while jumping constantly.

**Interaction and physics (M3)**
- **Body modes.** `BrainState.mode` is `ground`, `held` or `air`. No rule fires and `play`
  is ignored unless the pet is on the ground. While held, time stands still for the brain.
  A grab ends the running action (reported as interrupted) and plays role `dragged`.
  A release plays `fall`.
- **Physics** (`src/core/physics.ts`) works in CSS px and seconds:
  - Gravity is 2600 px/s².
  - Walls and the ceiling keep 45% of the speed. The floor bounces at 30% until the impact
    is under 700 px/s, then the pet lands.
  - Throws are measured over the last 90 ms of pointer samples and capped at 2600 px/s.
  - A release faster than 500 px/s is a throw.
  - Landing fires the `land` event with `{ impact, thrown }`.
- **Visitor events.** Built-in events are `hover` (mouse or pen enters the hitbox),
  `near`, `click`, `dblclick`, `tap` (touch), `drag-start`, `drop`/`throw` (both
  notifications only, since the pet is in the air) and `land`.
  - `near` fires when the cursor comes within 2.5 frame widths of the pet's middle, and
    re-arms beyond 1.4 times that distance.
  - A double-click delivers `click` first, then `dblclick`, which interrupts it (85 > 80).
- **Default reactions.**
  - Landing: `land-after-throw` → grumble (landing, then the `thrown` role) at 95, and
    `land` → land at 90.
  - Clicks: `dblclick` → happy at 85, and `click`/`tap` → startle at 80.
  - Hover: `hover` → shy at 20 (70%, 10 s cooldown, not while asleep).
  - Near: `near` → approach (follow the cursor; 30%, 20 s) or notice (face the cursor;
    60%, 12 s).
- **New step options.** Steps take `face: 'cursor' | 'away'`. Motion `follow` walks to
  40 px beside the cursor and re-targets every step while the cursor moves. Without a
  cursor the step is skipped.
- **New roles.** `thrown` falls back to click. `dblclick` now falls back to success before
  click. The cream cat maps `near` → `curious` and `thrown` → `angry`.
- **Hitbox.** The optional manifest field `hitbox: [x, y, w, h]` (sheet px; default the
  whole frame) is the only element that takes the pointer. It is mirrored with the sprite
  and has `touch-action: none`, so touch drags on the pet don't scroll while the rest of
  the page scrolls normally. The cream cat uses `[2, 4, 28, 28]`; its art spans the full
  frame width but the top rows are empty.
- **Pointer handling** (`src/dom/pointer.ts`) uses Pointer Events with
  `setPointerCapture`. A drag starts after moving 5 px (mouse) or 10 px (touch). A click
  is a press of at most 500 ms, and a double-click is two within 350 ms. The page-wide
  `pointermove` and `mouseout` listeners are passive. While held, the pet keeps its grab
  offset so it doesn't jump to the pointer.
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
- Never rewrite text files with Windows PowerShell 5.1 `Get-Content`/`Set-Content`. It reads
  UTF-8 without a BOM as Windows-1252 and writes a BOM, which corrupted CLAUDE.md once. Use
  the editor tools, or Node.

## Milestones
- [x] M0 Scaffold, manifest validator, role resolver, sprite viewer
- [x] M1 Shadow DOM host, renderer, loop, walk and idle along the floor
- [x] M2 Behavior and rules engine, random idle actions, debug panel
- [x] M3 Interaction: hover, near, click, double-click, tap, drag, drop and throw
- [x] M4 Surfaces: standing on and jumping between elements
- [x] M5 Poop
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
