import { createContext, useContext, type ReactNode } from "react";
import { Maximize2Icon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";

// Set while a screen shows beside the chat (beside.tsx), so its header leaves out the sidebar's button and offers the
// whole screen and closing instead.
export const BesideFrame = createContext<{ full: () => void; close: () => void } | null>(null);

// A screen's top bar: the sidebar's button, then its title. Plugins' screens use it too.
export function Header({ title, lead, children }: { title: ReactNode; lead?: ReactNode; children?: ReactNode }) {
  const beside = useContext(BesideFrame);
  return (
    <header className="box-content flex h-14 shrink-0 items-center gap-2 px-3 pt-[env(safe-area-inset-top)]">
      {!beside && <SidebarTrigger />}
      {lead}
      <h1 className="min-w-0 flex-1 truncate font-medium">{title}</h1>
      {children}
      {beside && (
        <>
          <Button variant="ghost" size="icon" aria-label="Open full screen" title="Open full screen" onClick={beside.full}>
            <Maximize2Icon />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Close" title="Close" onClick={beside.close}>
            <XIcon />
          </Button>
        </>
      )}
    </header>
  );
}
