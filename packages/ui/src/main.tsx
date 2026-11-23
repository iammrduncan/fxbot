import { Component, StrictMode, type ReactNode } from "react";
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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Crash>
      <App />
    </Crash>
  </StrictMode>,
);
