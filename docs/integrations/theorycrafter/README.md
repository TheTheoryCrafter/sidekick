# Adding Sidekick to thetheorycrafter.com

What the site gets:

- The cream cat on every page. It survives route changes because it's mounted once in
  `App.tsx`, outside the routes.
- A **"Website pet"** switch in both profile menus: the main `Header` and the
  `CraftToolHeader` on tool pages.
- For everyone, logged in or not, the pet's own menu on right-click or long-press: nap,
  clean up poops, hide. When the pet is hidden, a small paw in the bottom-left corner
  brings it back. It sits on the left so it doesn't cover the mobile "I'm Bored" button.
- Reactions to the tools with **no changes inside the tools**. Every tool already reports
  its result with a sonner toast, and a small bridge turns those toasts into pet events:
  - a success toast on a tool page (`/crafts/<tool>`) → `tool-completed` (the cat eats);
  - a success toast elsewhere → `success` (it celebrates);
  - an error toast → `error` (it faints for a moment).
- The pet is lazy-loaded after the page. The main bundle grows by about 0.2 kB; the pet
  itself (19 kB, plus 40 kB for the cat's sprite sheet, gzipped) arrives afterwards.

The integration was dry-run against a copy of the repo at commit `3690383`. It typechecks,
builds, and was checked in the browser (logged out): route changes, the toast bridge, body
scrolling, poops, and the menu with Hide and the paw. The logged-in profile-menu switch
wasn't clicked, because that needs a real login.

---

## 1. Put Sidekick on GitHub (once)

theorycrafter installs Sidekick straight from GitHub. The built files (`dist/`) are
committed, so nothing has to be compiled during install.

The repository is [TheTheoryCrafter/sidekick](https://github.com/TheTheoryCrafter/sidekick).
It must be readable by Lovable's installer, so **public is simplest**. It was set up from
`C:\Users\User\Claude Projects\Sidekick` with:

```bash
git remote add origin https://github.com/TheTheoryCrafter/sidekick.git
```

```bash
git push -u origin main
```

```bash
git tag v0.1.0
```

```bash
git push origin v0.1.0
```

To release a change later: run `npm run build`, commit, tag `v0.1.1`, push the tag, and
bump the tag in theorycrafter's `package.json`.

## 2. Ask Lovable to do it

Paste this into Lovable:

````text
Add the "Sidekick" website pet to the site. Follow these steps exactly and don't change anything else.

1. In package.json "dependencies", add:
   "sidekick-pet": "github:TheTheoryCrafter/sidekick#v0.1.6"

2. Create src/components/WebsitePet.tsx with exactly this content:

```tsx
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Sidekick, useSidekick } from "sidekick-pet/react";
import creamCat from "sidekick-pet/pets/cream-cat";

/**
 * Every tool already reports its result with a sonner toast. Turning those
 * toasts into pet events means all tools (and future ones) reach the pet
 * without any changes inside the tools themselves.
 */
function useToastEvents() {
  const { emit } = useSidekick();
  const { pathname } = useLocation();
  const onCraftTool = /^\/crafts\/[^/]+$/.test(pathname);

  useEffect(() => {
    const seen = new WeakSet<Element>();
    const handle = (toast: Element) => {
      if (seen.has(toast)) return;
      seen.add(toast);
      const type = toast.getAttribute("data-type");
      const message = toast.textContent?.trim() ?? "";
      if (type === "success") emit(onCraftTool ? "tool-completed" : "success", { message });
      else if (type === "error") emit("error", { message });
    };
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node.matches("[data-sonner-toast]")) handle(node);
          node.querySelectorAll("[data-sonner-toast]").forEach(handle);
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [emit, onCraftTool]);
}

function ToastEvents() {
  useToastEvents();
  return null;
}

/** The website pet. Rendered once in App, so it survives route changes. */
export const WebsitePet = () => (
  <>
    <Sidekick
      pets={[creamCat]}
      // Everyone gets the pet's own menu (right-click / long-press); logged-in
      // users also get a switch in the profile menu.
      menu
      // Keep the "bring it back" paw clear of the mobile "I'm Bored" button.
      restoreButton="bottom-left"
    />
    <ToastEvents />
  </>
);

export default WebsitePet;
```

3. Create src/components/PetMenuItem.tsx with exactly this content:

```tsx
import { PawPrint } from "lucide-react";
import { useSidekick } from "sidekick-pet/react";
import { DropdownMenuCheckboxItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

/** "Website pet" on/off switch for the profile dropdown. */
export const PetMenuItem = () => {
  const pet = useSidekick();
  if (!pet.ready) return null;

  return (
    <>
      <DropdownMenuCheckboxItem
        checked={pet.enabled}
        onCheckedChange={(on) => (on ? pet.enable() : pet.disable())}
        // Keep the menu open so the change is visible.
        onSelect={(e) => e.preventDefault()}
      >
        <PawPrint className="mr-2 h-4 w-4" />
        <span>Website pet</span>
      </DropdownMenuCheckboxItem>
      <DropdownMenuSeparator />
    </>
  );
};

export default PetMenuItem;
```

4. In src/App.tsx:
   - Below the line `import CraftToolPage from "./pages/CraftToolPage";` add:
     // Loaded after the page, so the pet never slows the first render.
     const WebsitePet = lazy(() => import("./components/WebsitePet"));
   - Inside <BrowserRouter>, right after <AppLayout />, add:
     <Suspense fallback={null}><WebsitePet /></Suspense>

5. In src/components/Header.tsx and in src/components/CraftToolHeader.tsx:
   - After the import from "@/components/ui/dropdown-menu" (in Header.tsx, after the `toast` import), add:
     const PetMenuItem = React.lazy(() => import("@/components/PetMenuItem"));
   - In the profile DropdownMenuContent, between the <DropdownMenuSeparator /> under the account label and the "Log out" <DropdownMenuItem>, add:
     <React.Suspense fallback={null}><PetMenuItem /></React.Suspense>
````

The exact resulting diff for the existing files is in [`site-changes.diff`](site-changes.diff).
The two new files are [`WebsitePet.tsx`](WebsitePet.tsx) and [`PetMenuItem.tsx`](PetMenuItem.tsx).

## 3. Check it on the site

1. Any page: the cat appears near the bottom, walks around, and hops onto headings and
   cards. Scroll: it rides the element it stands on.
2. Click between Home, Theories and Crafts: the cat stays, and at most hops down once per
   page change.
3. Right-click the cat (or long-press on a phone) and choose "Hide pet". A paw appears
   bottom-left; click it to bring the cat back.
4. Log in, open the avatar menu: "Website pet" is checked. Untick it and the cat goes;
   tick it and it's back. The choice is remembered on reload and in other tabs. Do the same
   from a tool page's header.
5. Open a tool, for example Linkinator, and generate a link: on the success toast the cat
   eats. Trigger a validation error: it faints briefly.
6. On a phone: tap the cat (it's startled), drag and throw it, and check the page still
   scrolls when you swipe anywhere else.

## Tweaks

All of these go in `WebsitePet.tsx`. Grab the instance with `useSidekick().instance`, or
listen for it with `watchInstance` from `sidekick-pet`.

- **Gentler reaction to form errors.** By default an error makes the cat faint for 4 s. To
  have it look grumpy for 2 s instead, register a replacement rule once the pet exists:
  `instance.registerAction({ id: "grumble-short", role: "thrown", duration: 2000 })`, then
  `instance.registerRule({ id: "error", on: "error", priority: 70, cooldown: 3000, action: "grumble-short" })`.
- **Your own events.** Call `useSidekick().emit("article-voted")` anywhere, and add a rule
  for it, such as `{ id: "vote", on: "article-voted", action: "celebrate", priority: 60 }`.
- **Keep the cat off an area** (the article editor, say) by adding `data-sidekick-ignore`
  to its wrapper. **Let it stand on a plain `div`** with `data-sidekick-surface`.
- **Bigger or smaller:** add `scale={3}` (whole numbers) to `<Sidekick>`.

## Notes

- **Your scroll container.** `src/index.css` makes `<body>` the scroll container
  (`html, body { height: 100%; overflow-y: auto }`). Sidekick handles that: surfaces and
  poops follow body scrolling. This was verified on the dry-run copy.
- **Existing dependency conflict.** theorycrafter already has a peer conflict unrelated to
  Sidekick: `react-day-picker@8` wants `date-fns` 2 or 3, but the site uses 4. `npm ci`
  fails without `--legacy-peer-deps`. Bun, which Lovable appears to use, doesn't enforce
  peer dependencies.
- **Generated images.** The tools capture their templates with html2canvas. The pet lives
  in its own layer outside those templates, so it never ends up in a generated image.
- **Data URL for the sprite sheet.** The cat's sheet ships inside the JavaScript as a data
  URL, so no files go in `public/`. If the site ever adds a Content-Security-Policy with
  `img-src`, include `data:`, or switch to serving the `pets/` folder (see the main
  README).
