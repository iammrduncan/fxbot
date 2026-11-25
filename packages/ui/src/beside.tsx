import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { BesideFrame } from "./header.tsx";
import { besideWith, go } from "./nav.ts";
import { pluginScreen, usePluginScreen, usePlugins } from "./plugins.tsx";

// A plugin's screen beside the chat, such as a page a bot linked, so the chat stays where it was. Its path is in the
// chat's address, as ?beside=/pages/<id>, so a reload keeps it and Back closes it.
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
  // Only a plugin's screen opens here; the app's own, such as Settings, replace the chat as before. A second one takes
  // the first one's place, in history too.
  useEffect(
    () =>
      besideWith((next) => {
        if (!pluginScreen(plugins, next)) return false;
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

// Half the chat's width on a computer, between 22rem and 50rem, in place of the bot panel; the whole screen on a
// phone, over the chat, which stays as it was underneath.
export function BesidePanel({ path, close }: { path: string; close: () => void }) {
  const mobile = useIsMobile();
  const screen = usePluginScreen(path);
  if (!screen) return null;
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
    <aside aria-label="Beside the chat" className="flex w-[clamp(22rem,50%,50rem)] shrink-0 flex-col border-l print:w-full print:border-0">
      {body}
    </aside>
  );
}
