// Runs first in every page of fxbot's that the frame serves, before fxbot's own code. It gives the page's fetch a
// direct line to the shell for this origin, so a chat's endless stream doesn't wait on the service worker; replaces
// WebSocket for this host; keeps the service worker in place; and hands the worker a new port when it asks.
import { askShell } from "./ask.ts";
import { Line, versioned } from "./port.ts";

const w = window as any;
if (!w.__fxbotFrame) {
  w.__fxbotFrame = true;
  let line: Promise<Line> | null = null;
  const get = () => (line ??= askShell().then((p) => new Line(p), (e) => ((line = null), Promise.reject(e))));

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (url.origin !== location.origin) return nativeFetch(request);
    // A plugin's page code, named by its version, goes through the service worker, which keeps it: it crossed the
    // connection at every launch before.
    if (request.method === "GET" && navigator.serviceWorker?.controller && versioned(url)) return nativeFetch(request);
    return (await get()).fetch(request);
  };

  const Native = window.WebSocket;
  class Bridged extends EventTarget {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    CONNECTING = 0;
    OPEN = 1;
    CLOSING = 2;
    CLOSED = 3;
    readyState = 0;
    protocol = "";
    extensions = "";
    bufferedAmount = 0;
    binaryType: BinaryType = "blob";
    onopen: ((e: Event) => void) | null = null;
    onmessage: ((e: MessageEvent) => void) | null = null;
    onclose: ((e: CloseEvent) => void) | null = null;
    onerror: ((e: Event) => void) | null = null;
    private s: { send(d: string | ArrayBuffer): void; close(): void } | null = null;
    private queued: (string | ArrayBuffer)[] = [];
    url: string;
    constructor(url: string, protocols?: string | string[]) {
      super();
      this.url = url;
      const u = new URL(url);
      const list = protocols === undefined ? [] : [protocols].flat();
      void get().then((l) => {
        if (this.readyState === 3) return;
        this.s = l.socket(u.pathname + u.search, list, {
          open: (protocol) => {
            this.readyState = 1;
            this.protocol = protocol;
            for (const d of this.queued.splice(0)) this.s!.send(d);
            this.fire(new Event("open"));
          },
          msg: (data) => this.fire(new MessageEvent("message", { data: typeof data === "string" || this.binaryType === "arraybuffer" ? data : new Blob([data]) })),
          close: (code, reason) => this.ended(code, reason),
        });
      }, () => this.ended(1006, ""));
    }
    private fire(e: Event) {
      this.dispatchEvent(e);
      (this as any)[`on${e.type}`]?.(e);
    }
    private ended(code: number, reason: string) {
      if (this.readyState === 3) return;
      const wasOpen = this.readyState === 1;
      this.readyState = 3;
      if (!wasOpen && code !== 1000) this.fire(new Event("error"));
      this.fire(new CloseEvent("close", { code, reason, wasClean: code === 1000 }));
    }
    send(data: string | ArrayBuffer | ArrayBufferView | Blob) {
      if (this.readyState === 0) throw new DOMException("Still connecting", "InvalidStateError");
      if (this.readyState !== 1) return;
      if (data instanceof Blob) return void data.arrayBuffer().then((b) => this.s?.send(b));
      const d = typeof data === "string" ? data : ArrayBuffer.isView(data) ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) : data;
      this.s!.send(d as string | ArrayBuffer);
    }
    close(code = 1000, reason = "") {
      if (this.readyState >= 2) return;
      this.readyState = 2;
      this.s?.close();
      this.ended(code, reason);
    }
  }
  w.WebSocket = function WebSocket(url: string | URL, protocols?: string | string[]) {
    const u = new URL(url, location.href);
    if (u.host === location.host) return new Bridged(u.href, protocols);
    return new Native(url, protocols);
  };
  Object.assign(w.WebSocket, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3, prototype: Bridged.prototype });

  // The frame's worker stays the only one: fxbot's page registers its own at the same address, which would replace it.
  if (navigator.serviceWorker) {
    navigator.serviceWorker.register = (() => navigator.serviceWorker.ready) as any;
    navigator.serviceWorker.addEventListener("message", (e) => {
      if (e.data?.fxbot !== "want-port") return;
      void askShell().then((port) => (e.source as ServiceWorker).postMessage({ fxbot: "port" }, [port]));
    });
  }
}
