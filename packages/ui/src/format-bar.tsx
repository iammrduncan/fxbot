// The format bar (Input Markdown): Bold, Italic, Strike, Code, Link, Quote, Code block, and the two lists, for the
// box it's beside, and Aa, which shows or hides it. On a phone, where *, _, and ` are hard to reach, Aa is in the +
// row. Plugins get both, as ui.FormatBar and ui.FormatButton, for a box the app doesn't place, as a room's.
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { BoldIcon, CaseSensitiveIcon, CodeIcon, ItalicIcon, LinkIcon, ListIcon, ListOrderedIcon, SquareCodeIcon, StrikethroughIcon, TextQuoteIcon } from "lucide-react";
import type { EditorView } from "prosemirror-view";
import { InputGroupButton } from "@/components/ui/input-group";
import * as formatting from "./formatting.ts";

// Whether the bar is open, kept in this browser.
const key = "fxbot.formatBar";
let open = (() => {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
})();
const listeners = new Set<() => void>();
function setOpen(next: boolean) {
  open = next;
  try {
    if (next) localStorage.setItem(key, "1");
    else localStorage.removeItem(key);
  } catch {}
  listeners.forEach((listener) => listener());
}
const useOpen = () => useSyncExternalStore((listener) => (listeners.add(listener), () => void listeners.delete(listener)), () => open);

const mac = typeof navigator !== "undefined" && /Mac|iP(hone|[oa]d)/.test(navigator.platform);
const shortcut = (keys: string) => {
  const parts = keys.split("-");
  const last = parts.pop()!.toUpperCase();
  const names: Record<string, string> = mac ? { Mod: "⌘", Alt: "⌥", Shift: "⇧" } : { Mod: "Ctrl+", Alt: "Alt+", Shift: "Shift+" };
  return parts.map((part) => names[part]).join("") + last;
};
const buttons = [
  { name: "strong", label: "Bold", keys: "Mod-b", Icon: BoldIcon },
  { name: "em", label: "Italic", keys: "Mod-i", Icon: ItalicIcon },
  { name: "strike", label: "Strikethrough", keys: "Mod-Shift-x", Icon: StrikethroughIcon },
  { name: "code", label: "Code", keys: "Mod-Shift-c", Icon: CodeIcon },
  { name: "link", label: "Link", keys: "Mod-Shift-u", Icon: LinkIcon },
  { name: "blockquote", label: "Quote", keys: "Mod-Shift-9", Icon: TextQuoteIcon },
  { name: "code_block", label: "Code block", keys: "Mod-Alt-Shift-c", Icon: SquareCodeIcon },
  { name: "bullet_list", label: "Bulleted list", keys: "Mod-Shift-8", Icon: ListIcon },
  { name: "ordered_list", label: "Numbered list", keys: "Mod-Shift-7", Icon: ListOrderedIcon },
] as const;

export function FormatButton({ className }: { className?: string }) {
  const shown = useOpen();
  return (
    <InputGroupButton size="icon-sm" className={`rounded-full ${className ?? ""}`} aria-label="Formatting" title="Formatting" aria-pressed={shown} onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen(!shown)}>
      <CaseSensitiveIcon />
    </InputGroupButton>
  );
}

// The bar, for `view`, or for the box inside `within`. A link takes an address, https: or mailto:, which the field
// asks for: Link, or Cmd or Ctrl+Shift+U in the box.
export function FormatBar({ view: given, within, className }: { view?: EditorView | null; within?: { current: Element | null }; className?: string }) {
  const shown = useOpen();
  // Each change in any box, for what shows pressed.
  useSyncExternalStore(formatting.watch, formatting.seen);
  const view = given ?? formatting.viewIn(within?.current) ?? null;
  const [address, setAddress] = useState<string | null>(null);
  const [wrong, setWrong] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const dom = view?.dom;
    if (!dom) return;
    const ask = () => (setOpen(true), setWrong(false), setAddress(formatting.linkAt(view.state)));
    dom.addEventListener("fx-format-link", ask);
    return () => dom.removeEventListener("fx-format-link", ask);
  }, [view]);
  const asking = address !== null;
  useEffect(() => {
    if (asking) field.current?.focus();
  }, [asking]);
  if (!shown || !view) return null;
  const run = formatting.commands(view.state.schema);
  const done = () => (setAddress(null), view.focus());
  const link = () => {
    const typed = (address ?? "").trim();
    const href = !typed || /^(https?:\/\/|mailto:)/i.test(typed) ? typed : /^[a-z][\w+.-]*:/i.test(typed) ? null : `https://${typed}`;
    if (href === null) return setWrong(true);
    formatting.setLink(view, href);
    setAddress(null);
  };
  return (
    <div role="toolbar" aria-label="Formatting" className={`flex w-full flex-wrap items-center gap-0.5 ${className ?? ""}`}>
      {buttons.map(({ name, label, keys, Icon }) => (
        <InputGroupButton
          key={name}
          size="icon-sm"
          className="rounded-full aria-pressed:bg-accent aria-pressed:text-accent-foreground"
          aria-label={label}
          title={`${label} (${shortcut(keys)})`}
          aria-pressed={formatting.active(view.state, name)}
          // Keeps the box focused, and its selection where it was.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (name === "link") return void (setWrong(false), setAddress(formatting.linkAt(view.state)));
            run[name](view.state, view.dispatch, view);
            view.focus();
          }}
        >
          <Icon />
        </InputGroupButton>
      ))}
      {asking && (
        <span className="flex min-w-48 flex-1 items-center gap-1 px-1">
          <input
            ref={field}
            type="url"
            inputMode="url"
            aria-label="Link address"
            aria-invalid={wrong || undefined}
            placeholder="https://… or mailto:…"
            value={address}
            onChange={(e) => (setAddress(e.target.value), setWrong(false))}
            onKeyDown={(e) => {
              // Enter here links, and doesn't send the message.
              if (e.key === "Enter") e.preventDefault(), link();
              if (e.key === "Escape") e.preventDefault(), done();
            }}
            className="h-7 min-w-0 flex-1 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring aria-invalid:border-destructive"
          />
          <InputGroupButton size="sm" className="rounded-full" onClick={link}>
            {address?.trim() ? "Link" : "Remove"}
          </InputGroupButton>
        </span>
      )}
    </div>
  );
}
