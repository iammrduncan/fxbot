import { useEffect, useRef, useState, type ReactNode } from "react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { BesideFrame } from "./header.tsx";
import { besideWith, go } from "./nav.ts";
import { pluginRoute, usePluginRoute, usePlugins } from "./plugins.tsx";
import { PaneGutter, useWidth } from "./resize.tsx";

// A plugin's screen beside the chat, such as a page a bot linked, so the chat stays where it was: a bot's chat, or a
// plugin's screen that asks for it, such as a room. Its path is in the chat's address, as ?beside=/pages/<id>, so a
// reload keeps it and Back closes it.
const read = () => new URLSearchParams(location.search).get("beside");
const moved = () => dispatchEvent(new PopStateEvent("popstate"));

export function useBeside() {
  const [path, setPath] = useState(read);
  useEffect(() => {
    const update = () => setPath(read());
    addEventListener("popstate", update);
    return () => removeEventListener("popstate", update);
  }, []);
  const plugins = usePlugins();
  // Only a plugin's screen opens here, and not another chat, such as a room; the app's own, such as Settings, replace
  // the chat as before. A second one takes the first one's place, in history too.
  useEffect(
    () =>
      besideWith((next) => {
        const route = pluginRoute(plugins, next);
        if (!route || route.beside) return false;
        const url = `${location.pathname}?beside=${encodeURIComponent(next)}`;
        if (read()) history.replaceState(history.state, "", url);
        else history.pushState({ beside: true }, "", url);
        moved();
        return true;
      }),
    [plugins],
  );
  const close = () => {
    if (history.state?.beside) return history.back();
    history.replaceState(null, "", location.pathname);
    moved();
  };
  return { path, close };
}

// Half the chat's width on a computer, between 22rem and 50rem, or as its gutter makes it, in place of the bot panel; the whole screen on a
// phone, over the chat, which stays as it was underneath.
export function BesidePanel({ path, close }: { path: string; close: () => void }) {
  const mobile = useIsMobile();
  const aside = useRef<HTMLElement>(null);
  const [width, setWidth] = useWidth("beside");
  const route = usePluginRoute(path);
  if (!route || route.beside) return null;
  const screen = route.screen;
  const body = (
    <BesideFrame.Provider value={{ full: () => go(path), close }}>
      <div data-beside className="flex min-h-0 flex-1 flex-col">
        {screen}
      </div>
    </BesideFrame.Provider>
  );
  if (mobile)
    return (
      <Sheet open onOpenChange={(open) => !open && close()}>
        <SheetContent side="right" showCloseButton={false} className="w-full gap-0 p-0 sm:max-w-none">
          <SheetTitle className="sr-only">Beside the chat</SheetTitle>
          <SheetDescription className="sr-only">{path}</SheetDescription>
          {body}
        </SheetContent>
      </Sheet>
    );
  return (
    <aside
      ref={aside}
      aria-label="Beside the chat"
      className="relative flex max-w-[calc(100%-20rem)] shrink-0 flex-col border-l print:w-full! print:max-w-none print:border-0"
      style={{ width: width ?? "clamp(22rem, 50%, 50rem)" }}
    >
      <PaneGutter pane={aside} label="Resize the page beside the chat" min={320} home={(row) => Math.min(Math.max(352, row / 2), 800)} width={width} setWidth={setWidth} />
      {body}
    </aside>
  );
}

// A plugin's screen that shows others beside it, as a bot's chat does. It's always wrapped, so opening one doesn't
// remount the screen.
export function BesideHost({ children }: { children: ReactNode }) {
  const beside = useBeside();
  return (
    <div className="flex min-h-0 flex-1">
      <div data-chat className="flex min-w-0 flex-1 flex-col">
        {children}
      </div>
      {beside.path && <BesidePanel path={beside.path} close={beside.close} />}
    </div>
  );
}
