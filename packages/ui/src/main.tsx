import { Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app.tsx";
import "./index.css";

// An error while the app draws would otherwise leave a blank page, which nothing recovers from but a reload: on a phone's
// installed app, one with no reload button. So it says what broke, with Reload.
class Crash extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {};
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  // The first screen, if it's still up, would cover what broke.
  componentDidCatch() {
    document.querySelector("body > .splash")?.remove();
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="grid min-h-dvh place-content-center gap-3 p-6 text-center">
        <p className="text-lg font-medium">fxbot hit an error</p>
        <p className="max-w-md text-sm break-words text-muted-foreground">{this.state.error.message}</p>
        <button type="button" className="justify-self-center rounded-md border px-4 py-2 text-sm font-medium" onClick={() => location.reload()}>
          Reload
        </button>
      </div>
    );
  }
}

// The first screen, a bot bouncing (index.html), stays until the app shows: React's first render replaced it with a page
// still hidden while its lists load, which on a slow link was a blank screen for seconds. App takes it away.
const splash = document.querySelector("#root > .splash");
if (splash) document.body.append(splash);

// No StrictMode: in development it runs each effect twice, so every request went twice, and the owner's installed app
// is the development server.
createRoot(document.getElementById("root")!).render(
  <Crash>
    <App />
  </Crash>,
);
