import type { MouseEvent } from "react";

export function go(path: string) {
  history.pushState(null, "", path);
  dispatchEvent(new PopStateEvent("popstate"));
}

// A screen the chat shows beside itself, such as a page: the chat on screen sets it, and it answers false for a path
// it can't show there. Anywhere else, the path opens as a screen of its own.
let beside: ((path: string) => boolean) | null = null;
export function besideWith(open: (path: string) => boolean) {
  beside = open;
  return () => void (beside === open && (beside = null));
}
export function openBeside(path: string) {
  if (!beside?.(path)) go(path);
}

// A plain click on a link to a screen opens it beside the chat, if one is showing.
export function followBeside(event: MouseEvent<HTMLAnchorElement>) {
  if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  openBeside(event.currentTarget.pathname + event.currentTarget.search);
}

// In-app navigation for plain links. Modified clicks keep the browser's behavior.
export function follow(event: MouseEvent<HTMLAnchorElement>) {
  if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  go(event.currentTarget.pathname + event.currentTarget.search);
}
