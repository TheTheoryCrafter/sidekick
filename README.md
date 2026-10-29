# Sidekick

A tiny pixel pet that lives on top of any website. It walks, runs, sits, sleeps, jumps
onto page elements, reacts to the visitor and to your site's events, and poops now and
then.

- **Framework-agnostic.** TypeScript with no runtime dependencies. It renders in a Shadow
  DOM, so it can't clash with your CSS.
- **Doesn't get in the way.** It never blocks clicks or scrolling: only the pet itself (and
  its poops) take the pointer. Poop never lands on links, buttons or form controls.
- **Polite.** Pixel-crisp at any whole-number scale. It pauses in hidden tabs, respects
  `prefers-reduced-motion`, and is hidden from screen readers.
- **CSP-safe.** No eval and no injected `<style>` tags. The script-tag build is about
  21 kB gzipped.
- **Works anywhere.** A script tag, an ES module, or a React component. SSR-safe, and only
  ever one pet per page, even if it's set up twice.
- **Pets and behavior are data.** A new pet is a folder (sprite sheet plus `manifest.json`).
  Actions and rules are plain objects you can add at runtime.

Contents: [Install](#install) · [Setup by framework](#setup-by-framework) ·
[Options](#options) · [API](#api) · [Events](#events) · [Add a pet](#add-a-pet) ·
[Add actions and rules](#add-actions-and-rules) · [Default behavior](#default-behavior) ·
[Development](#development)

---

## Install

Sidekick is installed from GitHub ([TheTheoryCrafter/sidekick](https://github.com/TheTheoryCrafter/sidekick)).
The built files in `dist/` are committed, so no build runs on install. Pin a tag.

**With a package manager:**

```json
"dependencies": {
  "sidekick-pet": "github:TheTheoryCrafter/sidekick#v0.1.9"
}
```

**As a script tag** (served by jsDelivr straight from GitHub):

```html
<script src="https://cdn.jsdelivr.net/gh/TheTheoryCrafter/sidekick@v0.1.9/dist/sidekick.js" data-menu defer></script>
```

The script finds its pets in the `pets/` folder next to itself, so there is nothing else
to copy.

### The pets

| id | Pet | Its own extras |
| --- | --- | --- |
| `cream-cat` | Cream cat (the default) | hides in a box, flies on a broom, snacks now and then, poops |
| `dalmatian` · `husky` · `labrador` · `rottweiler` · `golden-retriever` | Dogs | sniff around, bark; snarl after a throw, collapse on errors |
| `panda` | Panda (doesn't walk) | thinks, does yoga, snacks on bamboo, waves at you |

Offer several with `pets: ["cream-cat", "husky", "panda"]`; visitors switch from the menu.

### Where the pet's art comes from

| You use… | Pet art | Setup |
| --- | --- | --- |
| Script tag | `dist/pets/<id>/` next to the script | none |
| A bundler (Vite, webpack, Next…) | `import creamCat from "sidekick-pet/pets/cream-cat"` | pass `pet: creamCat` |
| A bundler, but you'd rather serve files | copy `node_modules/sidekick-pet/dist/pets` to your public folder as `/pets` | none (`petsBaseUrl` defaults to `/pets/`) |

Each `sidekick-pet/pets/<id>` module carries its sprite sheet as a data URL (cream cat
39 kB, panda 30 kB, each dog 12–16 kB, gzipped). Load it lazily with the pet, as the examples below do. If your site
has a Content-Security-Policy, either allow `img-src data:` or serve the folder instead.

---

## Setup by framework

Every setup does the same thing: call `init()` once, in the browser, from code that
outlives your page routes. A second `init()` returns the same pet.

### Plain HTML, WordPress, Webflow

```html
<script src="https://cdn.jsdelivr.net/gh/TheTheoryCrafter/sidekick@v0.1.9/dist/sidekick.js"
        data-menu data-scale="2" defer></script>
```

- **WordPress:** paste the tag into your theme's footer, or into a "header and footer
  scripts" plugin.
- **Webflow:** paste it into *Site settings → Custom code → Footer code*.

All [options](#options) are available as `data-*` attributes. Your page code gets
`window.Sidekick`:

```html
<script>
  document.addEventListener('sidekick:ready', () => {
    window.Sidekick.get().emit('success');
  });
</script>
```

Add `data-auto="false"` to stop it starting on its own, then call
`window.Sidekick.init({ ...options })` yourself.

### React (Vite, CRA)

```tsx
// App.tsx: render once, outside your <Routes>, so it survives navigation.
import { lazy, Suspense } from "react";
const WebsitePet = lazy(() => import("./WebsitePet"));

export default function App() {
  return (
    <BrowserRouter>
      <Routes>{/* … */}</Routes>
      <Suspense fallback={null}><WebsitePet /></Suspense>
    </BrowserRouter>
  );
}
```

```tsx
// WebsitePet.tsx
import { Sidekick } from "sidekick-pet/react";
import creamCat from "sidekick-pet/pets/cream-cat";

export default function WebsitePet() {
  return <Sidekick pets={[creamCat]} menu />;
}
```

Control it from anywhere, for example a profile menu:

```tsx
import { useSidekick } from "sidekick-pet/react";

function PetSwitch() {
  const pet = useSidekick(); // { ready, enabled, pet, pets, enable, disable, toggle, setPet, emit, instance }
  if (!pet.ready) return null;
  return (
    <label>
      <input type="checkbox" checked={pet.enabled} onChange={pet.toggle} /> Website pet
    </label>
  );
}

// After something finishes:
const { emit } = useSidekick();
emit("tool-completed");
```

- `<Sidekick>` reads its options on first mount only. It's safe under StrictMode.
- When the last `<Sidekick>` unmounts, the pet is removed.
- `useSidekick()` works in any component, even one that renders before `<Sidekick>`.

### Next.js (App Router)

Wrap the pet in a small client component, then render it from your root layout. Keeping
the pet in a client file keeps its sprite data out of the server-component payload, and
lets you pass functions such as `onEvent`.

```tsx
// app/website-pet.tsx
"use client";
import { Sidekick } from "sidekick-pet/react";
import creamCat from "sidekick-pet/pets/cream-cat";

export default function WebsitePet() {
  return <Sidekick pets={[creamCat]} menu />;
}
```

```tsx
// app/layout.tsx
import WebsitePet from "./website-pet";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <WebsitePet />
      </body>
    </html>
  );
}
```

With the Pages Router, render `<WebsitePet />` in `pages/_app.tsx`.

### Vue 3

```ts
// main.ts
import { createApp } from "vue";
import { init } from "sidekick-pet";
import creamCat from "sidekick-pet/pets/cream-cat";
import App from "./App.vue";

createApp(App).mount("#app");
init({ pet: creamCat, menu: true });
```

### Nuxt 3

```ts
// plugins/sidekick.client.ts (".client" keeps it out of SSR)
import { init } from "sidekick-pet";
import creamCat from "sidekick-pet/pets/cream-cat";

export default defineNuxtPlugin(() => {
  const pet = init({ pet: creamCat, menu: true });
  return { provide: { pet } }; // useNuxtApp().$pet?.emit("success")
});
```

### Svelte / SvelteKit

```svelte
<!-- src/routes/+layout.svelte -->
<script>
  import { onMount } from "svelte";

  onMount(async () => {
    const { init } = await import("sidekick-pet");
    const { default: creamCat } = await import("sidekick-pet/pets/cream-cat");
    init({ pet: creamCat, menu: true });
  });
</script>

<slot />
```

### Angular (17+)

```ts
// app.component.ts
import { Component, afterNextRender } from "@angular/core";

@Component({ selector: "app-root", standalone: true, template: "<router-outlet />" })
export class AppComponent {
  constructor() {
    // Runs only in the browser, never during server rendering.
    afterNextRender(async () => {
      const { init } = await import("sidekick-pet");
      const { default: creamCat } = await import("sidekick-pet/pets/cream-cat");
      init({ pet: creamCat, menu: true });
    });
  }
}
```

On older Angular, call `init()` in `ngOnInit`, guarded by
`isPlatformBrowser(this.platformId)`.

### Astro

```astro
---
// src/layouts/Layout.astro
---
<html lang="en">
  <body>
    <slot />
    <script>
      import { init } from "sidekick-pet";
      import creamCat from "sidekick-pet/pets/cream-cat";
      init({ pet: creamCat, menu: true });
    </script>
  </body>
</html>
```

Astro runs the script once in the browser. With View Transitions, the pet stays across
pages, and each navigation sends a `page-change` event.

### Server-side rendering

Importing Sidekick never touches `window` or `document`. On the server, `init()` returns
`null`, and the React component renders nothing.

---

## Options

Pass these to `init()` or `<Sidekick>`, or as `data-*` attributes on the script tag (shown
in parentheses).

| Option | Default | |
| --- | --- | --- |
| `pet` (`data-pet`) | `"cream-cat"` | First pet: a folder name under `petsBaseUrl`, or a pet object (`import creamCat from "sidekick-pet/pets/cream-cat"`). |
| `pets` (`data-pets="a,b"`) | `[pet]` | Pets the visitor may switch between (menu, `setPet`). |
| `petsBaseUrl` (`data-pets-base`) | `"/pets/"`; for the script tag, `pets/` next to the script | Folder that holds pet folders. |
| `petUrls` | `{}` | `{ id: folderUrl }` for pets kept elsewhere. |
| `scale` (`data-scale`) | `2` | Whole-number size, 1–8. Always pixel-crisp. |
| `surfaces` (`data-surfaces`) | headings, paragraphs, images, buttons, list items, landmarks… | CSS selector for elements the pet may stand on, or `false` (`"false"`) to keep it on the floor. |
| `poop` (`data-poop`, `data-poop-max`, `data-poop-ttl`) | `true` | `false`, or `{ max: 5, ttl: 15000 }` (at most 5 at once; each gone after 15 s of activity). |
| `enabled` (`data-enabled`) | `true` | Whether it starts switched on. **The visitor's saved choice wins.** |
| `persist` (`data-persist`) | `true` | Remember on/off, pet and position in `localStorage`. |
| `storageKey` (`data-storage-key`) | `"sidekick:v1"` | localStorage key. |
| `menu` (`data-menu`) | `false` | Built-in menu on right-click / long-press, plus a paw button to bring a hidden pet back. |
| `restoreButton` (`data-restore-button`) | `"bottom-right"` | Corner for the paw: `"bottom-right"` or `"bottom-left"`. |
| `idleAfter` (`data-idle-after`) | `60000` | ms without input before `visitor-idle`. |
| `motion` (`data-motion`) | `"auto"` | `"auto"` follows `prefers-reduced-motion`; `"reduced"` never moves on its own; `"full"` ignores the setting. |
| `seed` | random | Fixes the random sequence (demos, tests). |

Mark page areas with **`data-sidekick-ignore`** (never stand there) and
**`data-sidekick-surface`** (always a ledge, whatever it looks like).

What counts as a ledge by default:

- **Media, buttons and form controls:** always.
- **Cards:** a `div`, `section`, `article`, `header`, `footer`, `nav`, `aside`, `form` or
  `fieldset` counts when it's drawn as a card: a visible top border, a shadow, or a fill that
  stands out from what's behind it.
- **Never backgrounds:** a gradient on its own doesn't count, a box as wide as the page counts
  only if it has a visible top border line (a divider), and a fixed or absolute box covering
  much of the screen (an overlay) never counts.
- **Text and links:** headings, paragraphs, list items, quotes, code blocks and links count
  only when they're drawn as a box (a fill, background image or top border, like a
  button-style link), so the pet never stands on thin air above words.

When scrolling down uncovers new ledges, there's a 10% chance (at most every 4 s) that the pet
jumps onto one of them.

With reduced motion, the pet still animates, reacts and can be dragged. It just never
walks, runs, follows the cursor or jumps on its own.

---

## API

```ts
import { init, getInstance, destroy, watchInstance } from "sidekick-pet";

const pet = init(options); // the page's pet (or null during SSR)
```

| | |
| --- | --- |
| `init(options?)` | Start the pet, or return the one already on the page. |
| `getInstance()` | The pet, or `null`. |
| `destroy()` | Remove the pet and everything it added. |
| `watchInstance(fn)` | Call `fn` when the pet is created or destroyed. Returns an unsubscribe function. |

The instance:

| | |
| --- | --- |
| `enable()` · `disable()` · `toggle()` · `isEnabled()` | Show or hide the pet; the choice is saved. Hiding removes its poops. |
| `setPet(id)` | Switch to another pet from `pets` (async). |
| `getSettings()` · `getPets()` | `{ enabled, pet }`, and the pet ids on offer. |
| `subscribe(fn)` | Called with `{ enabled, pet }` whenever they change: from your code, the menu, or another tab. |
| `emit(name, payload?)` | Send an event to the pet's rules. |
| `on(fn)` | Everything the pet does (see [Events](#events)). Returns an unsubscribe function. |
| `play(actionId, priority = 0)` | Start an action right now. |
| `registerAction(action)` · `registerRule(rule)` · `removeRule(id)` · `registerCondition(name, fn)` | See [Add actions and rules](#add-actions-and-rules). |
| `clearPoops()` | Remove all poops. |
| `setScale(n)` | Change the size. |
| `destroy()` | Same as `destroy()` above. |
| `debug()` · `debugSurfaces()` · `setTimeScale(n)` | For demos and debugging. |

---

## Events

### What the pet reacts to

Send your own events with `emit(name, payload?)`. These have default reactions:

| Event | Default reaction |
| --- | --- |
| `tool-completed` | eats |
| `success` | celebrates |
| `error` | faints for a moment |

Built-in events, sent by Sidekick itself:

| Event | When | Default reaction |
| --- | --- | --- |
| `hover` | the mouse enters the pet | shy (sometimes) |
| `near` | the cursor comes close | looks at it, or walks over |
| `click` / `tap` | a click, or a tap on touch | startled |
| `dblclick` | double-click or double-tap | dances |
| `pestered` | 5 clicks or taps on the pet within 4 s | cries for 3.5–5 s; more clicks don't cut it short |
| `drag-start`, `drop`, `throw` | picked up, let go gently, let go fast | — (it's in the air) |
| `land` `{ impact, thrown, jumped, surface }` | back on its feet | landing; grumpy after a throw |
| `visitor-idle` | no input for `idleAfter` | naps |
| `visitor-return` | input again after that | wakes up |
| `page-change` `{ from, to }` | the URL changed (works with any router) | looks around |
| `copy` | the visitor copied something | eats it |
| `scroll-reveal` `{ count }` | scrolling down uncovered new ledges (at most once a second) | jumps onto one of them (10%) |
| `tab-return` `{ away }` | back to the tab after at least 30 s | happy |
| `poop-cleaned` | a poop was clicked away | celebrates (sometimes) |

Two internal events drive free time: `idle` (nothing is running, so choose something) and
`tick` (once a second).

### What the pet tells you

`pet.on(fn)` receives:

```ts
{ type: "action-start", action, rule }       // rule is null for play()
{ type: "action-end", action, interrupted }
{ type: "emit", name, action }               // a step's `emit`, e.g. "poop"
{ type: "event", name, rule, payload? }      // an event arrived; which rule fired, if any
```

---

## Add a pet

A pet is a folder with a sprite sheet and a `manifest.json`. No code changes.

```
pets/
  my-dog/
    manifest.json
    my-dog-sheet.png
```

The sheet is a grid of equal frames. Each animation is a run of frames on one row.

```json
{
  "id": "my-dog",
  "name": "My dog",
  "sheet": "my-dog-sheet.png",
  "frameSize": [32, 32],
  "sheetSize": [256, 192],
  "anchor": [16, 32],
  "facing": "right",
  "hitbox": [4, 6, 24, 26],
  "animations": {
    "sit":   { "row": 0, "frames": 6, "fps": 6, "loop": true },
    "walk":  { "row": 1, "frames": 8, "fps": 10, "loop": true },
    "sleep": { "row": 2, "frames": 4, "fps": 3, "loop": true },
    "yawn":  { "row": 3, "frames": 8, "fps": 8, "loop": false },
    "pile":  { "row": 4, "frames": 4, "fps": 4, "loop": true }
  },
  "roles": {
    "ambient": ["sit", "yawn"],
    "move": "walk",
    "sleep": "sleep",
    "tired": "yawn",
    "poopEntity": "pile"
  },
  "traits": { "speed": 1, "jumpiness": 0.3, "clinginess": 0.5 }
}
```

| Field | |
| --- | --- |
| `id`, `sheet`, `frameSize`, `animations` | Required. `id` is a lowercase slug and matches the folder name. |
| `animations.<name>` | `row` and `frames` are required; `fps`, `loop` (default `true`) and `col` (starting column, default 0) are optional. `hold: true` (with `loop: false`) keeps a one-shot on its last frame for the rest of a longer step, for a collapse or lying down. `next: "<name>"` (with `loop: false`) leads straight into another animation when this one finishes, so one role can play "lean into the bowl" and then a looping "munch". `size: [w, h]` gives one animation bigger frames than `frameSize` (its strip starts at `row` × the frame height and is drawn bottom-centred on the pet). |
| `scale` | Size relative to the `scale` option (default 1). Art drawn at 64 px per frame can use `0.5` to come out like 32 px art. |
| `anchor` | The point in a frame that sits on the ground (default: bottom centre). |
| `facing` | Which way the art faces (`"right"` by default); it's mirrored for the other way. |
| `hitbox` | Clickable area `[x, y, w, h]` inside a frame (default: the whole frame). |
| `sheetSize` | Optional; used to catch animations that run off the sheet. |
| `traits` | `speed` multiplies walking speed; `jumpiness`, `clinginess` and `appetite` (0–1, default 0.2, 0.5 and 0.5) scale how often it jumps, follows the cursor and snacks. |

**Roles.** Behavior only ever asks for roles, never for animation names. A role maps to
one animation, or to a list to pick from at random. A missing role falls back along a
chain, and every chain ends at `ambient`, then the first animation:

| Role | Used for | Falls back to |
| --- | --- | --- |
| `ambient` | idling (sitting, grooming…) | first animation |
| `move` | walking | ambient |
| `zoomies` | running | move |
| `sleep` · `tired` | napping, yawning before a nap | ambient |
| `hover` · `near` | mouse over it, cursor nearby | ambient · hover |
| `click` · `dblclick` | clicked, double-clicked | hover · success, then click |
| `dragged` · `fall` | held, falling | hover, then click · dragged |
| `landing` · `jump` · `thrown` | landing, jumping, after a throw | ambient · landing · click |
| `success` · `error` · `tool-used` | site events | ambient · click · success |
| `hide` · `hiding` | peeking from a box, staying in it | ambient · hide |
| `full` | after eating (the cat lifts its head and licks a paw) | ambient |
| `upset` | clicked too often | thrown |
| `poop` | squatting | ambient |
| `poopEntity` | the pile left behind | **none**: a pet without it never poops |

**Optional extras.** These roles have no fallback. The actions that use them only run for
pets that have them, so a pet without one simply never does that:
`hide` (the box), `broom`, `sniff`, `bark`, `wave`, `think`, `yoga` and `snack`.

**A pet that doesn't walk.** Leave out `move`, and the pet stays where it is: free-time
walks, runs, jumps and cursor-following are skipped, as with reduced motion. It can still be
dragged and thrown.

**Make a sheet from strips.** If your art comes as one PNG strip per animation, pack them:

```bash
node scripts/pack-sheet.mjs pets/my-dog/my-dog.png 64x64 idle=Idle.png run=Run.png sleep=Sleep.png
```

It drops trailing blank frames and prints the `sheetSize` and `animations` to paste into the
manifest.

**Check your pet.** Run `npm run dev` and open
`http://localhost:5199/demo/m0-sprites.html?pet=my-dog`. The viewer plays every
animation, shows how each role resolves, and warns about anything wrong with the manifest,
including blank frames.

**Use it.** Pass `pet: "my-dog"`, or add it to `pets` to let visitors switch, with the
folder under `petsBaseUrl` (or listed in `petUrls`). For bundlers, give the pet as data:
`{ id, manifest, sheetUrl }`.

---

## Add actions and rules

Behavior is plain data, and you can add it at runtime. Registering an `id` that already
exists replaces it, which is how you change a default. Registration never throws: it
returns, and logs, a list of warnings.

**An action** is a list of steps. Each step plays a role, and can move, wait or send a
notice:

```ts
pet.registerAction({
  id: "party",
  steps: [
    { role: "zoomies", motion: "run", speed: 4 },
    { role: "success", duration: 2000 },          // ms, or [min, max]
    { role: "zoomies", motion: "run", emit: "party-over" },
  ],
});

// One step can be written inline:
pet.registerAction({ id: "stare", role: "near", face: "cursor", duration: 3000 });
```

| Step field | |
| --- | --- |
| `role` | Required. |
| `motion` | `"none"`, `"wander"` (walk nearby), `"run"` (dash far), `"follow"` (walk to the cursor) or `"jump"` (onto a nearby element, or down). |
| `duration` | ms or `[min, max]`. With it, a `wander` or `run` step keeps picking new spots until the time is up. Without it, a moving step ends on arrival, a one-shot animation ends when it finishes, and a looping one plays for 3 s. |
| `speed` | Speed multiplier for the motion. |
| `face` | `"cursor"` or `"away"`. |
| `emit` | A name sent to `on()` listeners when the step ends. |

Action fields: `interruptible` (default `true`) and `next` (an action to chain into).

**A rule** says when to start an action:

```ts
pet.registerRule({
  id: "party-time",
  on: "party",          // an event name; "idle" for free time; omit for "tick" (every second)
  action: "party",
  chance: 0.8,          // 0..1
  cooldown: 10_000,     // ms before it may fire again
  priority: 65,         // tried highest first; also its interrupt level
  if: ["night"],        // conditions that must all hold
  notDuring: ["sleep"], // or during: [...]
});

pet.emit("party");
```

- **How a rule is chosen.** For each event, rules are tried highest `priority` first, and
  the first one that matches and passes its `chance` roll wins.
- **Interrupting.** A rule can interrupt the running action only if that action is
  `interruptible` and the rule's priority is at least the action's. An action started by
  a rule takes that rule's priority.
- **Skipped rules.** A rule whose action can't start right now is skipped: `follow` with no
  cursor, a `jump` with nothing in reach, an optional role the pet doesn't have, or any
  movement under reduced motion or for a pet that doesn't walk.
- **Traits.** `scaleBy: "jumpiness" | "clinginess" | "appetite"` scales the chance by the pet's trait (chance × trait × 2, at most 1).

**A condition** is a named function rules can list in `if`:

```ts
pet.registerCondition("weekend", ({ now, hour, action, lastDone, payload, cursor, onSurface }) =>
  [0, 6].includes(new Date().getDay()));
```

**Turning a default off:**

```ts
pet.removeRule("zoomies");
// or replace it:
pet.registerRule({ id: "zoomies", on: "idle", action: "zoomies", chance: 0.01, cooldown: 300_000, priority: 40 });
```

---

## Default behavior

**Free time** (the `idle` event, highest priority first): sleep at night or when sleepy
(after 3 minutes awake) · zoomies · broom zoomies · jump onto something nearby · poop (only where nothing
clickable is underneath) · hide in a box · snack · yoga · think · sniff · bark · walk · sit.
The extras only run for pets that have them. Each lasts a few seconds, so the pet
doesn't flit from one to the next.

All defaults are exported as data, as `DEFAULT_ACTIONS` and `DEFAULT_RULES`, from
`sidekick-pet`.

| Action | Steps |
| --- | --- |
| `sit` | ambient for 3–8 s |
| `walk` | move, wandering for 4–10 s |
| `zoomies` | run, run, ambient for 2–4 s |
| `broom-zoomies` | broom, flying fast across twice, then ambient for 2–4 s |
| `sleep` | tired, then sleep for 20–45 s |
| `jump` | jump onto something in reach, then ambient for 2–5 s |
| `poop` | poop, then the pile appears behind the pet |
| `hide` | hide, then hiding for 3–6 s |
| `eat` · `celebrate` · `faint` | tool-used for 4–6 s, then full for 1.5–2.5 s · success for 2.5 s · error for 4 s |
| `startle` · `happy` · `shy` | click for 1 s · dblclick for 2 s · hover |
| `cry` | upset for 3.5–5 s (rule `pestered`, priority 88, 10 s cooldown) |
| `notice` · `approach` · `look` | near, facing the cursor · follow, then near · near |
| `land` · `grumble` · `wake` | landing · landing, then thrown for 2 s · tired |
| `sniff` · `bark` | wander, then sniff · bark |
| `think` · `yoga` · `snack` | think for 4–7 s · three yoga poses, 2–3 s each · snack for 5–8 s, then full for 2.5–4 s |
| `wave` | wave, facing the cursor |

| Extra rule | When | Chance · cooldown · priority |
| --- | --- | --- |
| `broom-zoomies` | free time | 5% · 120 s · 39 (just under `zoomies`) |
| `snack` · `yoga` · `think` | free time | 12% × appetite × 2 (cat 6%, panda 12%) · 60 s · 28 · 15% · 60 s · 27 · 20% · 30 s · 26 |
| `sniff` · `bark` | free time | 30% · 25 s · 25 · 10% · 40 s · 24 |
| `tab-return-wave` | back after 30 s away | 80% · – · 41 (beats `happy`) |
| `page-change-wave` · `visitor-return-wave` | route change · visitor back | 80% · 2 s · 31 · 60% · – · 31 (beat `look` and `notice`) |

**Poops.**
- They're pinned to the element under them, or to the page, so they scroll with the
  content.
- They disappear when clicked, after `ttl`, or when the oldest makes room for a new one.
- They're never placed over or on anything clickable.

---

## Accessibility, privacy and CSP

- **Screen readers.** The overlay is `aria-hidden`. The built-in menu is pointer-only, so
  if you need accessible controls, drive the API from your own UI (for example a checkbox
  in your settings, as in the React example).
- **No tracking.** No network requests except loading the pet's art. Settings stay in
  `localStorage`.
- **CSP.** Styles are set only through the CSSOM (`element.style`), so a strict policy
  without `'unsafe-inline'` works. A strict-CSP demo page is included. Only the data-URL
  pet module needs `img-src data:`.

---

## Development

```bash
npm install
```

```bash
npm run dev
```

```bash
npm test
```

```bash
npm run build
```

- `npm run dev` serves the demos at <http://localhost:5199/demo/index.html>, one page per
  milestone: sprite viewer, walking, behavior debug panel, interaction, surfaces, poop,
  host API, script tag with a strict CSP, React, and every bundled pet.
- `npm test` runs the unit tests for the pure logic in `src/core/` (behavior, rules,
  physics, surfaces…), plus SSR tests.
- `npm run build` writes `dist/` and fails if the script-tag build exceeds 22 kB gzipped.
  **Commit `dist/` with every release.** GitHub installs use it as-is.

Design decisions and their reasons are recorded in [`CLAUDE.md`](CLAUDE.md). The
theorycrafter.com integration lives in
[`docs/integrations/theorycrafter/`](docs/integrations/theorycrafter/README.md).

## Licence

Code: MIT (see [`LICENSE`](LICENSE)). The sprite sheets in `pets/` come from third-party
pixel-art packs, are redistributed with permission, and are not covered by the MIT licence.
