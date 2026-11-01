# PWA

v1 meant fxbot to install as a PWA, and on a phone it doesn't. The parts exist: a manifest, icons, and a service worker that precaches the shell. They only reach the production build, though, which nothing in daily use serves, and they were never checked on a phone. This phase makes the tailnet address a real app:
- it installs on Android, iOS, and desktop
- it opens offline
- it takes updates without running stale code
- it looks native, with theme colors, safe areas, and the keyboard handled

Status: planned, not built. Research and plan only. It changes the UI (the Vite config, `index.html`, some CSS, and a small `pwa.ts`), one server line, the root `package.json`, and the README, with nothing in `@fxbot/sdk`. Updating fxbot itself stays with [app updates](app-updates.md); this page covers the page noticing a new build.

## 1. Research

These are read from the repository at `41a9e66`, specs, docs, and source, as of November 2026.

**What v1 built, and why it isn't an app**
- **What exists.** `vite-plugin-pwa` 2.0.0 writes a manifest and a Workbox service worker that precaches the shell and never touches `/api` (`packages/ui/vite.config.ts`).
  - The manifest has `fxbot`, `standalone`, `start_url: /`, white colors, and 192 and 512 pixel PNG icons.
- **What v1 checked.** "Chromium reports no installability errors for the production build", on this machine. Its "Not checked" list includes "Safari, iOS, Firefox, … a real install prompt, a browser on another device" (`docs/_completed/v1-plan.md`).
- **Development has no PWA.** The owner runs `npm run dev`, with `tailscale serve` pointing `/` at `127.0.0.1:5173`.
  - The plugin leaves development alone unless `devOptions.enabled` is set ("Should the service worker be available on development?", `@default false`).
  - So that page has no manifest and no worker, and Android's Chrome can't install it. iOS 26 can still open it from the Home Screen as a web app, but with neither the manifest's icons nor an offline shell.
- **The built app is out of reach.** It exists only after `npm run build`. Then `npm run server`, or the API that `npm run dev` now starts, serves it on 8787, where `tailscale serve` doesn't point.
- **Updates don't reach an open app.** The config has `registerType: "autoUpdate"` but imports no `virtual:pwa-register`. The plugin's guide says that then "any client tab/window will not be reloaded (the old service worker will be still controlling the application)". An app left open on a phone keeps running old code.
- **Looks.**
  - The theme color is always `#ffffff`, but the app follows `prefers-color-scheme`, with a dark background of `oklch(0.145 0 0)` (`index.css`).
  - Only the composer pads for `env(safe-area-inset-bottom)`.
  - No icon is marked `maskable`. The icon itself is opaque out to its corners (`#171717`), and its bubble stays within 34% of the width from the center.
- **Serving.** The server sends each built file with `cache-control: no-cache`. It knows `.html`, `.js`, `.css`, `.webmanifest`, `.png`, and `.svg`, so the precached `.woff2` font goes out as `application/octet-stream`.

**Install rules by platform**
- **Chrome** ([install criteria](https://web.dev/articles/install-criteria)). Before it offers an install, the app must:
  - not be installed already
  - have had the user click or tap the page at least once, and view it for 30 seconds or more
  - be served over HTTPS
  - have a manifest with `name` or `short_name`, a 192px and a 512px icon, `start_url`, and a `display` of `fullscreen`, `standalone`, `minimal-ui`, or `window-controls-overlay`
  - not set `prefer_related_applications: true`
  - The list has no service worker requirement.
- **Android's install sheet.** With `description` and `screenshots` in the manifest, "on Android only, these values will be shown in the install prompt" ([MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)).
- **Safari 26** ([WebKit](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)).
  - "By default, every website added to the Home Screen opens as a web app", unless the user turns off "Open as Web App" when adding it.
  - "there are now zero requirements for 'installability' in Safari", and "If you define your icons in the manifest, they're used". Safari also takes SVG icons wherever it shows one.
- **iOS push and badges** ([WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)). A Home Screen web app can ask for push permission only "in response to direct user interaction". Its pushes come from `*.push.apple.com`, and it can "support the Badging API".
- **Maskable icons** ([web.dev](https://web.dev/articles/maskable-icon)). What matters must sit "within a circular area in the center of the icon with a radius equal to 40% of the icon width".
- **Page metadata** (MDN).
  - `<meta name="theme-color">` takes a `media` attribute, so light and dark can differ.
  - The viewport's `interactive-widget=resizes-content` means "The viewport gets resized by the interactive widget", such as the keyboard.
  - The `display-mode` media feature tells a standalone app from a browser tab.
  - `beforeinstallprompt` lets the page show its own install button, which calls `prompt()`.

**vite-plugin-pwa 2.0** (installed; [guide](https://vite-pwa-org.netlify.app/guide/))
- **Prompting** is the default `registerType`. `onNeedRefresh` tells the page about a new build, and "When the user clicks the 'refresh' button when onNeedRefresh called, then call updateSW()".
- **Periodic checks.** The guide calls `registration.update()` on an interval, hourly in its example. Otherwise a page that never navigates checks only when it opens.
- **Development.** A development worker precaches a single entry, the `navigateFallback`, so it can't open offline.

**References**
- **opencode's web app** (`packages/app/vite.pwa.ts`, `manifest.json`, and `src/entry.tsx`, at `9a611d3`).
  - It sets `registerType: "prompt"`, and registers its worker itself, only in production.
  - `skipWaiting` and `clientsClaim` are `false`, to "Keep each open tab on its complete build until all old clients close".
  - Each precache entry carries a sha256 integrity hash, which "rejects mixed deployments".
  - Its manifest sets `id`, `scope`, and `start_url` to `/`, and lists each icon twice, as `any` and as `maskable`.
  - Its Playwright suite checks that "the production build installs as an app behind an authenticating proxy" (`e2e/service-worker/cache.spec.ts`).
- **The research directive's projects.** No clone of them here ships a manifest or a service worker, and Grok Bot's docs don't describe installing it.

**Tailscale**
- `tailscale serve --https=<port>` serves another HTTPS port on the same machine name (`tailscale serve --help`).
- A port is part of an origin. So `https://<machine>.<tailnet>.ts.net` and `…:8443` keep separate service workers and storage.

## 2. Key takeaways

1. **The installed app is the built app, at its own address.**
   - The plain tailnet address (443) goes to 8787, the API serving `packages/ui/dist`.
   - Development moves to 8443, which goes to Vite on 5173.
   - The two origins never share a service worker, so the dev server can't disturb the installed app, and Vite needs no development worker.
2. **One command runs the app.** `npm start` builds, then serves. `npm run dev` starts the same API, which serves the last build, so the phone app keeps working during development.
3. **Updates are offered, never forced.**
   - An open app stays on its whole build until the owner taps Reload.
   - It checks for a new build hourly, and whenever it comes to the front.
   - The draft survives the reload.
4. **Small changes make it installable everywhere:**
   - `id`, `scope`, and `description` in the manifest
   - the icons marked `maskable` too, since they already fit the safe zone
   - light and dark theme colors
   - safe areas on every edge
   - a keyboard that resizes the page
   - the font's type
5. **Each platform gets its install path.** Android and desktop Chrome get an Install button, and iOS gets the steps. An installed app shows neither.
6. **Push notifications and badges wait for their own phase.** They need VAPID keys sealed on the server, stored subscriptions, and worker code, and on iOS they only work from the Home Screen. Nothing here blocks them: the generated worker can import a push handler later.

## 3. Implementation

### Two addresses

| Address | Serves | One-time command |
| --- | --- | --- |
| `https://<machine>.<tailnet>.ts.net` | The installed app: the API and the built page, on 8787 | `tailscale serve --bg 8787` |
| `https://<machine>.<tailnet>.ts.net:8443` | Development: Vite on 5173, never installed | `tailscale serve --bg --https=8443 5173` |

- The root `package.json` gets `npm start`: `npm run build && npm run server`.
- The README's run section describes both addresses, and says to install from the first.
- Vite's `allowedHosts` already admits `.ts.net`, and its hot reload follows the page's port.

### Manifest and icons (`packages/ui/vite.config.ts`)

```ts
manifest: {
  id: "/",
  name: "fxbot",
  short_name: "fxbot",
  description: "Long-running chats with your bots",
  start_url: "/",
  scope: "/",
  display: "standalone",
  background_color: "#ffffff",
  theme_color: "#ffffff",
  icons: [
    { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
},
```

- **Icons.** The current ones stay. They're opaque, and the bubble fits the 40% safe zone. `index.html` keeps `apple-touch-icon` for iOS before 26.
- **Theme colors.** `index.html` gets two theme colors, `<meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff">` and the same for dark with `#0a0a0a`, `index.css`'s dark `--background`.
- **The keyboard.** The viewport gains `interactive-widget=resizes-content`, so Android's keyboard resizes the page and the composer stays above it.
- **The server.** It learns `.woff2` as `font/woff2`.

### Updates (`packages/ui/src/pwa.ts`)

- **The worker waits.** `registerType: "prompt"` and `injectRegister: false`, with `skipWaiting` and `clientsClaim` left `false`, as opencode does. A new worker installs, then waits, and the open page keeps its whole build.
- **Registration.** `main.tsx` calls `registerSW` from `virtual:pwa-register` in production builds only.
  - `onNeedRefresh` sets a flag. The sidebar footer then shows "New version" with a Reload button, built from the existing Button, with no new component.
  - `onRegisteredSW` calls `registration.update()` every hour, and when `visibilitychange` brings the app back to the front.
- **Reload** saves the open chat's draft text to `sessionStorage`, then calls `updateSW()`. The chat puts the draft back after the reload. A streaming reply survives a reload already (v1).
- **Old pages and a new server.** A page left on an old build can meet a newer API. That stays with [app updates](app-updates.md). This phase only offers the newer page.

### Looking native (`index.css`, `app.tsx`)

- **Safe areas.** With `viewport-fit=cover`, which `index.html` already sets:
  - the header and sidebar pad `env(safe-area-inset-top)`
  - the left and right edges pad their insets
  - the composer keeps its bottom inset
- **Install, in Settings.** A small row, about 30 lines in `pwa.ts`:
  - **Chrome and Edge,** once `beforeinstallprompt` fires: an **Install** button that calls `prompt()`.
  - **Safari on iOS:** the steps, Share and then Add to Home Screen, with "Open as Web App" left on.
  - **Already installed** (`display-mode: standalone`): no row.

### Where the code goes

- **`packages/ui`:**
  - `vite.config.ts`: the manifest and prompt mode
  - `index.html`: theme colors and viewport
  - `index.css` and `app.tsx`: safe areas and the Reload row
  - `pwa.ts`: registration, update checks, the draft handoff, and the install row
- **`packages/server`:** the `.woff2` type.
- **The root `package.json` and README:** `npm start`, and the two addresses.

### Size

About 130 lines:

| Part | Lines |
| --- | --- |
| `pwa.ts` | about 60 |
| UI: the Reload row, the install row, and safe areas | about 45 |
| Config, HTML, and CSS | about 25 |
| Server and scripts | about 3 |

Plus the README.

## 4. Checklist

Checks run the production build on a disposable port and database, with Playwright's Chromium on this machine. Phones are the human's.

**M1. Installs**
- [ ] `npm start` builds and serves the app. The API that `npm run dev` starts serves the same build.
- [ ] The manifest comes as `application/manifest+json` with `id`, `scope`, `description`, and both icons as `any` and `maskable`. Chromium reports no installability errors (`Page.getInstallabilityErrors`).
- [ ] The font comes as `font/woff2`.
- [ ] In dark mode, the dark theme color applies.

**M2. Offline and updates**
- [ ] With the server stopped, the cached shell opens and says it can't reach the server, as in v1.
- [ ] Build A and open it, then build B. A visibility change brings up "New version".
  - The page keeps running A, and no request mixes A's page with B's files.
  - Reload runs B.
- [ ] A draft typed before Reload is still there after it.
- [ ] A development page on another port leaves the app's worker alone.

**M3. Install row and looks**
- [ ] A dispatched `beforeinstallprompt` shows Install, and clicking it calls `prompt()`.
- [ ] An iOS user agent shows the steps. Standalone display shows no row.
- [ ] `npm run typecheck`, `npm run build`, and `git diff --check` pass.

**The human runs these:**
- Point `tailscale serve` 443 at 8787, and add 8443 for development.
- **Android Chrome:** install from the tailnet address, and check:
  - the icon's shape, and the colors in light and dark
  - the composer stays above the keyboard
  - "New version" appears after a rebuild
  - the app opens in airplane mode
- **iPhone on iOS 26:** Add to Home Screen with "Open as Web App" on. The status bar and the home indicator don't cover the header or the composer. Repeat the update and offline checks.
- **Desktop Chrome:** install from the address bar.

## 5. Open questions

Each has a default.

1. **Which address gets the app.** *Default:* the plain tailnet address for the app, and :8443 for development. The other way round works too, with the app on :8443.
2. **Push notifications and badges.** "Bob replied", and a count of unread chats on the icon. *Default:* a later phase of its own, with VAPID keys sealed on the server like every other secret.
3. **Screenshots for Android's install sheet.** *Default:* none for now. Two can be added later, with `form_factor` set.
4. **A worker in development.** *Default:* none. A development worker would cache only the entry page, and the dev address is never installed.
5. **Keeping the server running.** *Default:* no service, as now. When the server is down, the installed app opens its shell and says so.
