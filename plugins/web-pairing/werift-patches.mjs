// werift 0.25.2's SCTP fixes, applied to its bundle by rolldown.config.mjs, each an exact replacement that must match once.
// Found by loading fxbot's page over a channel with 3 to 5% packet loss, which stalled it within a minute.
export const patches = [
  // Ordered delivery: after handing up a message, the next one starts fresh, with its own sequence check. werift kept the
  // last message's start, so a message already waiting was compared with the wrong TSN and left behind until another
  // chunk arrived on its stream, which, for a request waiting on its answer, is never.
  [
    "        pos = startPos;\n        yield [chunk.streamId, chunk.protocol, userData];\n      } else {",
    "        pos = startPos;\n        startPos = void 0;\n        yield [chunk.streamId, chunk.protocol, userData];\n        continue;\n      } else {",
  ],
  // SACK gap blocks: TSNs in order of their distance past the cumulative TSN, not as text, and across the 32-bit wrap.
  ["[...this.sackMisOrdered].sort().forEach((tsn) => {", "[...this.sackMisOrdered].sort((a, b) => ((a - this.lastReceivedTsn) >>> 0) - ((b - this.lastReceivedTsn) >>> 0)).forEach((tsn) => {"],
  ["const pos = (tsn - this.lastReceivedTsn) % SCTP_TSN_MODULO;", "const pos = (tsn - this.lastReceivedTsn) >>> 0;"],
  // Moving the cumulative TSN on: the same order, or at the 32-bit wrap 0 sorts before 4294967295 and it stops for good.
  ["    for (const tsn2 of [...this.sackMisOrdered].sort()) {", "    for (const tsn2 of [...this.sackMisOrdered].sort((a, b) => ((a - this.lastReceivedTsn) >>> 0) - ((b - this.lastReceivedTsn) >>> 0))) {"],
  ["    for (const tsn of [...this.sackMisOrdered].sort()) {", "    for (const tsn of [...this.sackMisOrdered].sort((a, b) => ((a - this.lastReceivedTsn) >>> 0) - ((b - this.lastReceivedTsn) >>> 0))) {"],
];
export function patch(code) {
  for (const [from, to] of patches) {
    const n = code.split(from).length - 1;
    if (n !== 1) throw new Error(`werift patch matched ${n} times: ${from.slice(0, 60)}`);
    code = code.replace(from, to);
  }
  return code;
}
