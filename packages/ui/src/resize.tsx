import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import { useSidebar } from "@/components/ui/sidebar";

// The panes' widths, dragged at the gutters between them: the sidebar, the bot panel, and a screen beside the chat.
// Each is kept per browser, in pixels, or null for its default. The chat between them keeps at least 20rem.

const keyOf = (name: string) => `fxbot.width.${name}`;
const widths = new Map<string, number | null>();
const listeners = new Set<() => void>();
function stored(name: string) {
  if (!widths.has(name)) {
    let value: number | null = null;
    try {
      const saved = Number(localStorage.getItem(keyOf(name)));
      if (saved > 0) value = saved;
    } catch {}
    widths.set(name, value);
  }
  return widths.get(name)!;
}
function store(name: string, value: number | null) {
  widths.set(name, value);
  try {
    if (value === null) localStorage.removeItem(keyOf(name));
    else localStorage.setItem(keyOf(name), String(value));
  } catch {}
  for (const listener of listeners) listener();
}
export function useWidth(name: string): [number | null, (value: number | null) => void] {
  const value = useSyncExternalStore(
    (listener) => (listeners.add(listener), () => void listeners.delete(listener)),
    () => stored(name),
  );
  return [value, (next) => store(name, next)];
}

export const chatMin = 320;
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));

type Props = {
  label: string;
  // The pane's edge the gutter sits on: the sidebar's right, a right pane's left. Dragging away from the pane grows it.
  edge: "left" | "right";
  width: number | null;
  // The element and style property a drag writes, without React, and the value for a width.
  target: () => HTMLElement | null;
  property: string;
  css: (px: number) => string;
  // The pane's width now, its bounds now, and its default, in pixels.
  measure: () => number;
  bounds: () => { min: number; max: number };
  home: () => number;
  keep: (px: number | null) => void;
  // A pane that closes when dragged well past its narrowest, and opens when dragged out again.
  shut?: { shut: boolean; set: (shut: boolean) => void };
};

// A gutter between two panes. A drag follows the pointer with nothing animating behind it, over a page's frame too, and
// Escape puts it back. Near its default width it snaps there; a double-click goes back to it. From the keyboard it's a
// window splitter (WAI-ARIA): arrows move it, Shift by more, Home and End to its bounds, Enter closes or opens it, or
// puts back its default.
export function Gutter({ label, edge, width, target, property, css, measure, bounds, home, keep, shut }: Props) {
  const grows = edge === "right" ? 1 : -1;
  const [dragging, setDragging] = useState(false);
  // Ends a drag when the gutter goes, as a pane dragged shut does, leaving what the drag did.
  const gone = useRef<(() => void) | null>(null);
  useEffect(() => () => gone.current?.(), []);
  const cursorAt = (px: number, { min, max }: { min: number; max: number }) =>
    px <= min ? (grows > 0 ? "e-resize" : "w-resize") : px >= max ? (grows > 0 ? "w-resize" : "e-resize") : "col-resize";
  // The default is kept as null, so a pane that follows the window, such as a page, still does.
  const save = (px: number | null) => keep(px === null || px === home() ? null : px);

  function down(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const root = document.documentElement;
    const el = target();
    // What React drew, put back before React draws the kept width, or as it was on Escape.
    const drawn = el?.style.getPropertyValue(property) ?? "";
    const undraw = () => (drawn ? el?.style.setProperty(property, drawn) : el?.style.removeProperty(property));
    const startX = event.clientX;
    const wasShut = Boolean(shut?.shut);
    const from = wasShut ? 0 : measure();
    const limits = bounds();
    const snap = home();
    let now = from;
    let closed = wasShut;
    let moved = false;
    root.dataset.resizing = "";
    root.style.setProperty("--resize-cursor", cursorAt(from, limits));
    setDragging(true);
    const move = (e: globalThis.PointerEvent) => {
      if (!moved && Math.abs(e.clientX - startX) <= 2) return;
      moved = true;
      const raw = from + (e.clientX - startX) * grows;
      if (shut && raw < limits.min * 0.6) {
        if (!closed) shut.set((closed = true));
        root.style.setProperty("--resize-cursor", grows > 0 ? "e-resize" : "w-resize");
        return;
      }
      if (closed) shut?.set((closed = false));
      let px = clamp(Math.round(raw), limits.min, limits.max);
      if (Math.abs(px - snap) <= 8) px = snap;
      now = px;
      el?.style.setProperty(property, css(px));
      root.style.setProperty("--resize-cursor", cursorAt(px, limits));
    };
    const quit = () => {
      removeEventListener("pointermove", move);
      removeEventListener("pointerup", up);
      removeEventListener("pointercancel", cancel);
      removeEventListener("keydown", escape, true);
      delete root.dataset.resizing;
      root.style.removeProperty("--resize-cursor");
      gone.current = null;
    };
    const up = () => {
      quit();
      setDragging(false);
      if (!moved) {
        // A click on a closed pane's edge opens it.
        if (wasShut) shut?.set(false);
        return;
      }
      undraw();
      if (!closed) save(now);
    };
    const cancel = () => {
      quit();
      setDragging(false);
      undraw();
      if (closed !== wasShut) shut?.set(wasShut);
    };
    const escape = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      cancel();
    };
    addEventListener("pointermove", move);
    addEventListener("pointerup", up);
    addEventListener("pointercancel", cancel);
    addEventListener("keydown", escape, true);
    gone.current = quit;
  }

  function key(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      return shut ? shut.set(!shut.shut) : save(null);
    }
    const limits = bounds();
    const step = event.shiftKey ? 64 : 16;
    const from = shut?.shut ? 0 : measure();
    const next =
      event.key === "ArrowRight" ? from + step * grows : event.key === "ArrowLeft" ? from - step * grows : event.key === "Home" ? limits.min : event.key === "End" ? limits.max : null;
    if (next === null) return;
    event.preventDefault();
    if (shut?.shut) shut.set(false);
    save(clamp(next, limits.min, limits.max));
  }

  const limits = bounds();
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={shut?.shut ? 0 : Math.round(width ?? home())}
      aria-valuemin={shut ? 0 : limits.min}
      aria-valuemax={Math.max(limits.min, limits.max)}
      tabIndex={0}
      className="gutter"
      data-edge={edge}
      data-dragging={dragging || undefined}
      onPointerDown={down}
      onPointerEnter={(e) => (e.currentTarget.style.cursor = shut?.shut ? (grows > 0 ? "e-resize" : "w-resize") : cursorAt(measure(), bounds()))}
      onDoubleClick={() => save(null)}
      onKeyDown={key}
    />
  );
}

// The sidebar's right edge: 200 to 480 pixels, at most 35% of the window, 16rem by default. Dragged nearly shut it
// closes, and its edge at the window's side drags it open again.
export const sidebarWidth = (px: number | null) => (px === null ? "16rem" : `min(${px}px, 35vw)`);
export function SidebarGutter() {
  const { open, setOpen, isMobile } = useSidebar();
  const [width, setWidth] = useWidth("sidebar");
  if (isMobile) return null;
  return (
    <Gutter
      label="Resize the sidebar"
      edge="right"
      width={width}
      target={() => document.querySelector<HTMLElement>('[data-slot="sidebar-wrapper"]')}
      property="--sidebar-width"
      css={sidebarWidth}
      measure={() => document.querySelector('[data-slot="sidebar-container"]')?.getBoundingClientRect().width ?? 256}
      bounds={() => ({ min: 200, max: Math.min(480, Math.round(innerWidth * 0.35)) })}
      home={() => 256}
      keep={setWidth}
      shut={{ shut: !open, set: (shut) => setOpen(!shut) }}
    />
  );
}

// A right pane's left edge: the bot panel, or a screen beside the chat. `pane` is the aside it sits in, and `home`
// its default for the width of the row it's in. `close` lets a drag close it.
export function PaneGutter({ pane, label, min, max, home, width, setWidth, close }: {
  pane: RefObject<HTMLElement | null>;
  label: string;
  min: number;
  max?: number;
  home: (row: number) => number;
  width: number | null;
  setWidth: (px: number | null) => void;
  close?: () => void;
}) {
  const row = () => pane.current?.parentElement?.clientWidth ?? innerWidth;
  return (
    <Gutter
      label={label}
      edge="left"
      width={width}
      target={() => pane.current}
      property="width"
      css={(px) => `${px}px`}
      measure={() => pane.current?.getBoundingClientRect().width ?? home(row())}
      bounds={() => ({ min, max: Math.min(max ?? Infinity, row() - chatMin) })}
      home={() => Math.round(home(row()))}
      keep={setWidth}
      shut={close ? { shut: false, set: (shut) => void (shut && close()) } : undefined}
    />
  );
}
