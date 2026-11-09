// Builds fxbot/server.js, the plugin's server code as one file with everything it uses, which fxbot loads with no
// node_modules. Run `npx rolldown -c` in this folder after changing anything under fxbot/ or packages/web-app/protocol/.
import { readFileSync } from "node:fs";
import { patch } from "./werift-patches.mjs";

// @achingbrain/ssdp reads its own package.json at runtime, for its name and version, which the bundle doesn't carry.
const ssdp = JSON.parse(readFileSync(new URL("./node_modules/@achingbrain/ssdp/package.json", import.meta.url), "utf8"));

export default {
  input: "fxbot/server.ts",
  platform: "node",
  output: { file: "fxbot/server.js", format: "esm", minify: true, comments: { legal: false } },
  plugins: [
    {
      name: "ssdp-package",
      transform(code, id) {
        if (id.includes("@achingbrain/ssdp/dist/src/ssdp.js")) return code.replace("req('../../package.json')", JSON.stringify({ name: ssdp.name, version: ssdp.version }));
        if (/werift\/lib\/index\.mjs$/.test(id)) return patch(code);
      },
    },
  ],
};
