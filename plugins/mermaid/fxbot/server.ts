import { readFileSync } from "node:fs";
import { Worker } from "node:worker_threads";
import { gzipSync } from "node:zlib";
import type { PluginApi } from "@fxbot/sdk";

// Mermaid diagrams: the page draws each ```mermaid block with Pele, from this plugin's own copy, in a worker of its own
// (docs/_completed/phases/plugin-mermaid.md). Here are that copy's route, the line in each chat, and mermaid_check,
// which draws a diagram on the server for the bot.

// Pele 1.12.0's dist/pele.js, as npm has it: see the README.
const pele = readFileSync(new URL("pele.js", import.meta.url));
const zipped = gzipSync(pele, { level: 9 });
// Pele's own limit on a diagram's source, and how long a check may take.
const most = 50_000;
const seconds = 3;

const line =
  "Your replies and Markdown pages draw ```mermaid code blocks as diagrams. Draw one when a picture explains it better than words: a process, " +
  "the steps between people or systems, a structure, states, or a timeline. Keep it small. Your skill mermaid says how to write one that draws, " +
  "and mermaid_check tries one before you send it.";

// A diagram's source, with any fence a bot left around it.
const sourceOf = (value: unknown) =>
  String(value ?? "")
    .replace(/^\s*```\s*mermaid[^\n]*\n/i, "")
    .replace(/\n```\s*$/, "")
    .trim();

// Draws one diagram in a thread of its own, ended after `seconds`, so a diagram that never finishes can't hold fxbot.
function check(code: string): Promise<string> {
  if (!code) return Promise.resolve("Give the diagram's Mermaid source.");
  if (code.length > most) return Promise.resolve(`Doesn't draw: it's ${code.length.toLocaleString("en-US")} characters, over ${most.toLocaleString("en-US")}.`);
  return new Promise((done) => {
    const worker = new Worker(new URL("check.js", import.meta.url), { workerData: code });
    const end = (answer: string) => {
      clearTimeout(timer);
      void worker.terminate();
      done(answer);
    };
    const timer = setTimeout(() => end(`Doesn't draw: it took longer than ${seconds} seconds.`), seconds * 1000);
    worker.once("message", (answer: string) => end(answer));
    worker.once("error", (error) => end(`Doesn't draw: ${error.message}`));
  });
}

export default function mermaid(fx: PluginApi) {
  fx.on("instructions", (event) => void event.instructions.push(line));

  // Pele, for the page's worker. The page asks with the plugin's version in the address, so a browser keeps it.
  fx.route("GET", "/pele.js", (request) => {
    const gzip = /\bgzip\b/.test(request.headers.get("accept-encoding") ?? "");
    return new Response(gzip ? zipped : pele, {
      headers: {
        "content-type": "text/javascript; charset=utf-8",
        "cache-control": "public, max-age=31536000, immutable",
        vary: "accept-encoding",
        ...(gzip ? { "content-encoding": "gzip" } : {}),
      },
    });
  });

  fx.tool({
    name: "check",
    description:
      "Try a Mermaid diagram before you send it: it's drawn as the owner will see it. Answers what it drew, such as 'Draws: flowchart, " +
      "6 nodes', or why it doesn't, with the line. Give the source without the ``` fence.",
    inputSchema: { type: "object", properties: { code: { type: "string", description: "The diagram's Mermaid source" } }, required: ["code"] },
    idempotent: true,
    safe: true,
    execute: (input: Record<string, unknown>) => check(sourceOf(input.code)),
  });
}
