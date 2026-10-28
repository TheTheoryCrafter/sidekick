# Sidekick

A website pet (like PostHog's hedgehog / oneko.js): a pixel pet that roams on top of
any page, reacts to the visitor and to host-site events, and poops now and then.
Framework-agnostic TypeScript core, no runtime dependencies, rendered in a Shadow DOM.

## Commands
- `npm run dev`: Vite dev server on http://localhost:5199. Demos are at `/demo/index.html`.
- `npm test`: Vitest unit tests (pure logic only, Node environment).
- `npm run typecheck`: `tsc --noEmit`.
- `npm run build`: builds `dist/` (ESM, React wrapper, pet module, script-tag IIFE, pets, types) and fails over the size budget.

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
- `petsBaseUrl` defaults to `/pets/`. The script-tag build derives it from its own `src`.
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

**theorycrafter integration (M8)**
- **Distribution.** The site installs Sidekick from GitHub, pinned to a tag:
  `"sidekick-pet": "github:TheTheoryCrafter/sidekick#v0.1.0"`.
  - `dist/` is committed (no longer git-ignored; marked `-diff linguist-generated`), so
    installs need no build step. Bun, which Lovable appears to use, doesn't run
    dependencies' build scripts, so a `prepare` script would be fragile.
  - **Releasing:** run `npm run build`, commit, tag, push the tag, then bump the tag on
    the site. Never commit source changes without the rebuilt `dist/`.
- **The guide.** `docs/integrations/theorycrafter/README.md` has a Lovable prompt, the
  two new files (`WebsitePet.tsx`, `PetMenuItem.tsx`) and `site-changes.diff` for
  `App.tsx` and both headers.
  - The pet and the menu item are `React.lazy`, so the site's main bundle grows about
    0.2 kB (146.8 → 147.0 kB gzipped).
  - Tool events come from a **sonner toast bridge**: a MutationObserver reads
    `[data-sonner-toast][data-type]`. Success on `/crafts/<tool>` → `tool-completed`,
    success elsewhere → `success`, error → `error`. Nothing inside the tools changes.
  - Everyone gets `menu`, and `restoreButton="bottom-left"` keeps the paw clear of the
    mobile "I'm Bored" button. Logged-in users also get the profile-menu switch.
- **Library fixes found through the site.**
  - The site scrolls `<body>` (`html, body { height: 100%; overflow-y: auto }`), so
    `window.scrollY` is always 0. Floor poops are now pinned to the content element
    behind the pile; the page-coordinate fallback adds `body.scrollTop`.
  - New `restoreButton` option and `data-restore-button` attribute.
- **Dry run.** Done on a scratch copy of the site at `3690383`: it typechecks, builds,
  and was checked in `vite preview`, logged out.
  - Verified: success and error toasts trigger celebrate and faint, a route change keeps
    the single instance, surfaces track while body scrolls, a floor poop moved 120 px with
    a 120 px body scroll, and the menu's Hide plus the bottom-left paw work.
  - Not verified: the logged-in profile switch (it needs a real login).
  - Vite dev from another working directory can't find the site's Tailwind config, so use
    `vite preview` of a build.
  - The site has an existing peer conflict (date-fns 4 vs react-day-picker 8), so `npm ci`
    needs `--legacy-peer-deps`.

**Packaging, SSR, CSP and reduced motion (M7)**
- **`npm run build`** (`scripts/build.mjs`, Vite JS API) produces:
  - `dist/sidekick.mjs`: the ESM core.
  - `dist/react.mjs`: the React wrapper, with a `"use client"` banner, importing
    `./sidekick.mjs`.
  - `dist/pets/cream-cat.mjs`: the pet as data, with its sheet inlined as a data URL.
  - `dist/sidekick.js`: the minified IIFE for the script tag.
  - `dist/pets/<id>/`: copied pet folders.
  - `dist/types/`: `tsc -p tsconfig.build.json`.
  - Target is es2019. The ESM keeps its whitespace because consumers' bundlers minify it.
- **Package.** It is ESM-only. `exports` has `.`, `./react`, `./pets/cream-cat` and
  `./dist/*`; `unpkg`/`jsdelivr` point at `dist/sidekick.js`; `files: ["dist"]`;
  `sideEffects: ["./dist/sidekick.js"]`; and React is an optional peer (>=18, since
  `useSyncExternalStore` is needed).
- **Size budget.** The gzipped IIFE must stay at or under 20 kB, and the build fails above
  that. It measures 18.2 kB (53 kB minified). The plan's "about 12 kB" was an early
  estimate. The weight is the whole feature set plus validation messages; a later pass
  could mangle private names or shorten messages.
- **Pets as data.** `PetDefinition { id, manifest, sheetUrl }`; `pet` and `pets` accept ids
  or definitions (`PetRef`). `import creamCat from 'sidekick-pet/pets/cream-cat'` is the
  zero-config path for bundlers (38.6 kB gzipped, loaded only if imported). Its data URL
  needs `img-src data:`, so strict-CSP sites serve the `pets/` folder instead.
- **Script tag** (`src/entries/script.ts`).
  - It reads `data-*` attributes (`optionsFromDataset`, unit-tested).
  - The pets folder defaults to `pets/` next to the script's own URL, so a CDN copy works
    with no configuration.
  - It sets `window.Sidekick = { init, get, destroy }` and starts on DOMContentLoaded
    unless `data-auto="false"`, then fires `sidekick:ready` on `document`.
  - A second copy of the script reuses the instance.
- **React** (`src/react.ts`, no JSX). `<Sidekick {...options} onEvent />` reads options on
  first mount only and destroys the pet when the last `<Sidekick>` unmounts. Teardown is
  deferred one task, so StrictMode's unmount and remount keep the instance.
  `useSidekick()` uses `useSyncExternalStore` with a cached snapshot and a server snapshot
  `{ ready: false }`. It finds the instance through `watchInstance()`, which listens for
  the `sidekick:instance` event on `window` (so it works across bundle copies).
- **SSR.** No module touches `window` or `document` at import. `init` returns null and the
  React wrapper renders nothing on the server. `test/ssr.test.ts` covers the source, React
  `renderToString` and the built module.
- **CSP.** The `m7-script` demo runs under `default-src 'self'; style-src 'self';
  script-src 'self'; img-src 'self'` with zero violations while the menu, poop, drag and
  scale are exercised. An injected `<style>` is blocked, which proves the policy is live.
  The build was scanned for eval, `new Function`, innerHTML, `<style`, cssText and style
  attributes: none.
- **Reduced motion.** `motion: 'auto' | 'reduced' | 'full'` (default auto follows
  `prefers-reduced-motion`, including live changes). With `BrainCtx.calm`, rules whose
  action has any moving step are skipped, and moving steps started by `play()` end at once
  without moving. Animations, reactions, poop and drag/drop still work.
- **Instance events.** `INSTANCE_EVENT = 'sidekick:instance'` is dispatched on `window` at
  init and destroy.

**Host API, settings, sensors and menu (M6)**
- **Lifecycle.** The instance owns its `<sidekick-pet>` host for its whole life. The pet
  itself is mounted and unmounted (`Mounted`: sprite, input, loop, sensors, scanner,
  poops). `disable()` unmounts, and the pet's poops go with it. `enable()` mounts again.
  `setPet(id)` unmounts and mounts the new pet, keeping its x position.
  - A `generation` counter makes a slow pet load that has gone stale give up.
  - Loaded pets are cached per id; failed loads are not cached.
  - New status `disabled`. Events emitted while disabled are dropped, not queued.
- **API additions.** `enable`, `disable`, `toggle`, `isEnabled`, `setPet` (async),
  `getSettings`, `getPets`, `subscribe(fn)` for on/off and pet changes (from the API, the
  menu or another tab), and `clearPoops`.
  - `on(fn)` remains the stream of what the pet does.
  - New options: `pets`, `petUrls` (`{ id: folderUrl }` for pets kept outside
    `petsBaseUrl`), `enabled`, `persist`, `storageKey`, `menu` and `idleAfter`.
- **Settings in localStorage** (`src/core/settings.ts`, `src/dom/storage.ts`).
  - Key `sidekick:v1` holds `{ v: 1, enabled, pet, x }`, where `x` is a share of the
    window width.
  - Parsing is defensive: anything malformed, from another version, or with a bad pet id is
    ignored.
  - The visitor's stored choice wins over the site's `enabled` and `pet` defaults, except a
    stored pet that is no longer in `pets`.
  - Settings are written on enable, disable and setPet, on `pagehide`, and when the tab is
    hidden. Every access is in try/catch.
  - **Cross-tab sync.** Another tab's `storage` event is applied without writing back, so
    tabs never ping-pong.
- **Built-in events** (`src/dom/sensors.ts`), checked at most every 250 ms from the loop:
  - `visitor-idle`: no pointer, key, wheel, scroll or touch input for `idleAfter`
    (default 60 s); fires once.
  - `visitor-return`: the next input after `visitor-idle`.
  - `page-change { from, to }`: the URL changed (polled, no history patching).
  - `copy`.
  - `tab-return { away }`: back after at least 30 s hidden.
  - **Default reactions.**
    - visitor-idle → sleep (45, 80%).
    - visitor-return → `wake` (the `tired` role) while asleep (55), else notice (30, 50%).
    - tab-return → happy (40).
    - page-change → `look` (the `near` role; 30, 80%, 2 s).
    - copy → eat (30, 5 s).
- **Built-in menu** (`menu: true`, `src/dom/menu.ts`).
  - It opens on right-click or a 550 ms long-press on the pet. A long-press that opens it
    is neither a click nor a drag.
  - Items: Take a nap / Wake up, Clean up (n) when there are poops, Switch to <pet> for
    each other pet, and Hide pet.
  - It closes on an outside pointerdown, Escape, scroll, resize or after a choice.
  - When the pet is hidden, a small paw button in the bottom-right corner brings it back.
  - Colors follow `prefers-color-scheme`, set through CSSOM like everything else.
  - **Pointer-only by design.** The overlay is aria-hidden, so sites needing accessible
    controls drive the API from their own UI.
- **Demos and storage.** The M1–M5 demos pass `persist: false`, so a choice saved in the M6
  demo can't hide the pet there. `demo/pets/box-cat` is a demo-only second pet: a
  manifest-only variant that reuses the cream cat sheet with box animations as its idle
  roles and has no poop or jump. It shows that a pet is just data and that missing roles
  fall back.

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
- **Fixed in M7: spasm on route change.**
  - **Cause.** React removed the heading the cat stood on. The cached surface list
    (re-measured only on scroll or resize) still held its old edge, so every frame the cat
    landed on the ghost edge, the fresh check found the element gone, and it fell again
    (about 30 landings a second).
  - **Scanner fix.** A MutationObserver (childList, plus class/style/hidden attributes,
    ignoring our own host) only sets flags. The next `list()` rediscovers elements (at
    most every 250 ms after a change) and re-measures. Between measurements, disconnected
    entries are filtered out.
  - **Periodic refresh.** Surfaces are also re-measured at least every 1 s to catch layout
    shifts without DOM changes.
  - **Brain guard.** After losing its footing (`fallOff`), the pet ignores that surface
    for landing for 400 ms (`BrainState.skipLand`), so inconsistent data can never cause a
    land/fall loop. There is a regression test with alternating stale and fresh lists.
  - **Verified.** In the React demo, six route changes with the cat on the heading each
    give exactly one landing.

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
- No runtime dependencies. The script-tag build must stay at or under 20 kB gzipped (`npm run build` enforces it).
- Demos may use `<style>` tags. Library code may not.
- `README.md` is the user-facing reference: setup for each framework, options, API, events,
  adding a pet, and adding actions and rules. `test/readme.test.ts` typechecks its API
  examples and validates its example manifest and rules, so **change the README and that
  test together** whenever the API, options, roles or defaults change.
- Licence: the code is MIT (`LICENSE`). The cream cat art is third-party, redistributed
  with permission, and excluded from the MIT grant.
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
- [x] M6 Host events, sensors, persistence, built-in menu
- [x] M7 Packaging (IIFE, ESM, React), SSR, CSP, size budget, reduced motion
- [x] M8 Integration guide for theorycrafter (React Router + shadcn profile menu, via Lovable)
- [x] M9 README

## Open notes
- cream-cat artwork faces **right**. Checked in the M0 viewer: walk, run and jump all head
  right, so the default `facing: "right"` is correct.
- Commits use the repo-local identity `shrikarreddyk <shrikarreddyk@gmail.com>`. The
  machine's global identity is a work account, so never use it here.
- Node 24 LTS was installed via winget (2026-10-28). The preview tool reads
  `C:\Users\User\.claude\launch.json`, and the `sidekick-dev` entry there starts Vite for
  this repo.
- **Asset licence (settled 2026-10-28).** The user confirmed the cream cat sheet may be
  redistributed, so it can ship inside the npm package and the CDN/script-tag build.
