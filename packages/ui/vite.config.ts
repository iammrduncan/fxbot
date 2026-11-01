import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const repo = fileURLToPath(new URL("../..", import.meta.url));
const apiPort = process.env.FXBOT_PORT ?? "8787";

// `npm run dev` runs the API beside Vite, and restarts it when the server or the SDK changes. Vite on its own watches
// only this package, so it is told to watch those two as well. Its watcher drives the restarts too: Node's
// --watch-path missed a second edit to a file that an editor had replaced. The API outlives a Vite restart.
function api(): Plugin {
  return {
    name: "fxbot-api",
    apply: "serve",
    configureServer(server) {
      const dirs = ["sdk", "server"].map((name) => `${repo}packages/${name}/src/`);
      server.watcher.add(dirs);
      const running = ((globalThis as { fxbotApi?: ReturnType<typeof runApi> }).fxbotApi ??= runApi());
      server.watcher.on("all", (_event, file) => {
        if (!dirs.some((dir) => file.startsWith(dir))) return;
        server.config.logger.info(`restarting the API: ${file.slice(repo.length)} changed`, { timestamp: true });
        running.restart();
      });
    },
  };
}

// The API as a child process, stopped when Vite exits. A restart lets the old one finish and free the port first,
// and a change after a crash starts it again.
function runApi() {
  let child: ChildProcess | undefined;
  let restarting = false;
  const start = () => {
    child = spawn(process.execPath, ["--env-file-if-exists=.env", "packages/server/src/index.ts"], { cwd: repo, stdio: ["ignore", "inherit", "inherit"] });
    child.once("exit", () => {
      child = undefined;
      if (restarting) (restarting = false), start();
    });
  };
  start();
  process.once("exit", () => child?.kill());
  return {
    restart() {
      if (!child) return start();
      if (restarting) return;
      restarting = true;
      child.kill("SIGTERM");
    },
  };
}

export default defineConfig({
  plugins: [
    api(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "fxbot",
        short_name: "fxbot",
        display: "standalone",
        start_url: "/",
        background_color: "#ffffff",
        theme_color: "#ffffff",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      // The shell is precached. /api is never cached and never answered by the worker.
      workbox: { globPatterns: ["**/*.{js,css,html,woff2}"], navigateFallbackDenylist: [/^\/api\//] },
    }),
  ],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: {
    // IPv4 loopback, like the API server, so `tailscale serve 5173` reaches it. Tailnet names end in .ts.net.
    host: "127.0.0.1",
    // Fail rather than move to another port, which `tailscale serve 5173` would not reach.
    strictPort: true,
    allowedHosts: [".ts.net"],
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${apiPort}`,
        // Vite's proxy keeps the page's stream open after the API server stops. Close it too, so the chat sees the drop.
        configure: (proxy) => proxy.on("proxyRes", (upstream, _req, res) => upstream.on("close", () => upstream.complete || res.destroy())),
      },
    },
  },
});
