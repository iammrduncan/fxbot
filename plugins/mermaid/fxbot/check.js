// mermaid_check's worker: draws one diagram with Pele, as the page does, and answers what it drew or why it can't. It
// runs in a thread of its own, so the server can end one that never finishes.
import { parentPort, workerData } from "node:worker_threads";
import { PeleError, render } from "./pele.js";

const names = { flowchart: "flowchart", sequence: "sequence diagram", class: "class diagram", state: "state diagram", er: "ER diagram", gantt: "Gantt chart", pie: "pie chart", xychart: "XY chart", gitGraph: "git graph" };
// What the parts of the commonest types are called, counted by Pele's own class names.
const parts = { flowchart: ["node", "nodes", /class="[^"]*pele-node\b/g], sequence: ["message", "messages", /class="[^"]*pele-message\b/g], state: ["state", "states", /class="[^"]*pele-node\b/g], class: ["class", "classes", /class="[^"]*pele-node\b/g] };
try {
  const { type, svg, width, height } = render(workerData, { links: false, images: false });
  const [one, many, pattern] = parts[type] ?? [];
  const count = pattern ? (svg.match(pattern) ?? []).length : 0;
  parentPort.postMessage(`Draws: ${names[type] ?? type}${count ? `, ${count} ${count === 1 ? one : many}` : ""}, ${Math.round(width)} by ${Math.round(height)} pixels.`);
} catch (error) {
  parentPort.postMessage(`Doesn't draw: ${error instanceof PeleError ? error.message : `Pele failed: ${error?.message ?? error}`}`);
}
