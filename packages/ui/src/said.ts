// What the owner said, drawn as Markdown (Input Markdown), as they typed it: each line outside a fence ends in two
// spaces, a hard break, which Markdown ignores at a block's end. Plain, so the app's first chunk has it.
export function breaks(text: string) {
  let fence = "";
  return text
    .split("\n")
    .map((line) => {
      // A fence counts inside a quote or a list too.
      const bare = line.replace(/^(?:\s*>)*\s*(?:(?:[-+*]|\d{1,9}[.)])\s+)*/, "");
      const at = /^(`{3,}|~{3,})/.exec(bare);
      if (fence) {
        if (at && at[1][0] === fence[0] && at[1].length >= fence.length && !bare.slice(at[1].length).trim()) fence = "";
        return line;
      }
      if (at) {
        fence = at[1];
        return line;
      }
      return line.trim() ? `${line}  ` : line;
    })
    .join("\n");
}

// Code, fenced or in a line, which a plugin's `said` pattern doesn't reach into.
export const code = /(```[\s\S]*?(?:```|$)|`[^`\n]*`)/;
