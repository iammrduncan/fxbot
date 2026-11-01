import type { MouseEvent } from "react";

export function go(path: string) {
  history.pushState(null, "", path);
  dispatchEvent(new PopStateEvent("popstate"));
}

// In-app navigation for plain links. Modified clicks keep the browser's behavior.
export function follow(event: MouseEvent<HTMLAnchorElement>) {
  if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  go(event.currentTarget.pathname + event.currentTarget.search);
}
