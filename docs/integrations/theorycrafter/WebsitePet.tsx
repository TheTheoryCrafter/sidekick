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
