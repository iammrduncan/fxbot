// A page's HTML as Markdown, with the plugin's own few hundred lines, as eve's and fx's converters do: no DOM,
// Readability, or Turndown to add. The page's main part is kept (<main>, else its first <article>, else <body>), and
// what isn't the page's words (scripts, styles, navigation, the site's header and footer, forms) is dropped.

type Node = { tag: string; attrs: string; kids: (Node | string)[] };

const voids = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const raw = new Set(["script", "style", "textarea", "title", "noscript", "template", "svg", "math"]);
const dropped = new Set(["script", "style", "noscript", "svg", "math", "iframe", "form", "nav", "footer", "aside", "template", "head", "button", "select", "dialog", "canvas", "object"]);
const blocks = new Set(["p", "div", "section", "article", "main", "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6", "table", "pre", "blockquote", "dl", "dt", "dd", "figure", "figcaption", "hr", "address", "details", "summary", "header", "footer", "nav", "aside", "form", "fieldset"]);
// Tags that end one of the same still open, as a browser reads them: a new <li> ends the last.
const closes: Record<string, string[]> = { li: ["li"], dt: ["dt", "dd"], dd: ["dt", "dd"], tr: ["tr", "td", "th"], td: ["td", "th"], th: ["td", "th"], option: ["option"], thead: ["tbody", "tfoot"], tbody: ["thead", "tbody"] };
// Where that search stops, so a <li> in a nested list doesn't end its parent's.
const scopes = new Set(["ul", "ol", "table", "dl", "blockquote", "div", "section", "article", "main", "body"]);

const entities: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ensp: " ", emsp: " ", thinsp: " ", shy: "", mdash: "—", ndash: "–", hellip: "…", copy: "©", reg: "®", trade: "™",
  lsquo: "‘", rsquo: "’", sbquo: "‚", ldquo: "“", rdquo: "”", bdquo: "„", laquo: "«", raquo: "»", middot: "·", bull: "•", deg: "°", times: "×", divide: "÷", euro: "€",
  pound: "£", yen: "¥", cent: "¢", sect: "§", para: "¶", plusmn: "±", micro: "µ", frac12: "½", frac14: "¼", frac34: "¾", larr: "←", rarr: "→", uarr: "↑", darr: "↓", hearts: "♥", check: "✓",
};
export const decode = (text: string) =>
  text.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);?/gi, (all, code: string) => {
    if (code[0] !== "#") return entities[code.toLowerCase()] ?? all;
    const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : Number(code.slice(1));
    return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : all;
  });
const attr = (attrs: string, name: string) => {
  const found = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(attrs);
  return found ? decode(found[1] ?? found[2] ?? found[3] ?? "") : "";
};
const hidden = (attrs: string) => /(?:^|\s)hidden(?:\s|=|\/|$)/i.test(attrs.replace(/"[^"]*"|'[^']*'/g, '""')) || /aria-hidden\s*=\s*["']?true/i.test(attrs);
// A page's chrome, by its role, class, or id: menus, sidebars, dropdowns, banners, and share buttons, as in Wikipedia's
// language list or a site's cookie notice.
const chromeRole = /^(navigation|banner|contentinfo|complementary|search|menu|menubar|toolbar|dialog|alertdialog)$/i;
const chromeName = /(?:^|[\s_-])(nav|navbar|navigation|menu|sidebar|dropdown|breadcrumbs?|cookies?|consent|share|sharing|social|toolbar|skip-?link|advert|ads|promo|popup|modal|newsletter|subscribe)(?:[\s_-]|$)/i;
const chrome = (attrs: string) => chromeRole.test(attr(attrs, "role")) || chromeName.test(attr(attrs, "class")) || chromeName.test(attr(attrs, "id"));
const line = (text: string) => text.replace(/\s+/g, " ").trim();

// The HTML as a tree, the way a browser mostly reads it: an unclosed tag closes with its parent, and a close tag with
// no open one is skipped. It reads the page once, from start to end, so no page takes longer than its size: a tag,
// comment, or quoted value left open runs to the end of the page, as in a browser, and past 256 tags inside one another,
// a tag's words join its parent's, as a browser's do past 512.
const deepest = 256;
const space = (c: number) => c === 32 || c === 9 || c === 10 || c === 12 || c === 13;
const nameChar = (c: number) => (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95 || c === 58 || c === 45;
const letter = (c: number) => (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
// Lower case for A to Z only, so each character stays where it was: toLowerCase makes some longer, such as İ.
const ascii = (html: string) => html.replace(/[A-Z]+/g, (m) => m.toLowerCase());
function parse(html: string) {
  const root: Node = { tag: "#root", attrs: "", kids: [] };
  const stack = [root];
  // Where each tag is open in the stack, and where its scopes are, so closing one doesn't walk the stack.
  const where = new Map<string, number[]>();
  const scoped: number[] = [];
  const push = (node: Node) => {
    let at = where.get(node.tag);
    if (!at) where.set(node.tag, (at = []));
    at.push(stack.length);
    if (scopes.has(node.tag)) scoped.push(stack.length);
    stack.push(node);
  };
  const cut = (to: number) => {
    while (stack.length > to) {
      const node = stack.pop()!;
      where.get(node.tag)!.pop();
      if (scopes.has(node.tag)) scoped.pop();
    }
  };
  const last = (tag: string) => where.get(tag)?.at(-1) ?? -1;
  // The open `tag` a new one ends, above the nearest scope, so a <li> in a nested list doesn't end its parent's.
  const open = (tag: string) => {
    const at = last(tag);
    return at > (scoped.at(-1) ?? 0) ? at : -1;
  };
  const text = (words: string) => stack.at(-1)!.kids.push(decode(words));
  // The first `what` at or after `from`, kept, since `from` only grows: a page that never closes one is searched once.
  const seen = new Map<string, number>();
  const next = (what: string, from: number) => {
    const at = seen.get(what);
    if (at !== undefined && (at < 0 || at >= from)) return at;
    const found = html.indexOf(what, from);
    seen.set(what, found);
    return found;
  };
  // Where a tag's `>` is: one in a quoted value, after `=`, doesn't end it. -1 if the page ends first.
  const tagEnd = (from: number) => {
    for (let k = from; k < html.length; k++) {
      const c = html.charCodeAt(k);
      if (c === 62) return k;
      if (c !== 61) continue;
      k++;
      while (k < html.length && space(html.charCodeAt(k))) k++;
      const quote = html[k];
      if (quote === '"' || quote === "'") {
        k = html.indexOf(quote, k + 1);
        if (k < 0) return -1;
      } else k--;
    }
    return -1;
  };
  const lower = ascii(html);
  let title: string | null = null;
  let og = "";
  for (let i = 0; i < html.length; ) {
    const lt = next("<", i);
    if (lt < 0) {
      text(html.slice(i));
      break;
    }
    if (lt > i) text(html.slice(i, lt));
    i = lt;
    if (html.startsWith("<!--", i)) {
      const close = next("-->", i + 4);
      i = close < 0 ? html.length : close + 3;
      continue;
    }
    if (html.startsWith("<![CDATA[", i)) {
      const close = next("]]>", i + 9);
      if (close >= 0) {
        i = close + 3;
        continue;
      }
    }
    if (html[i + 1] === "!" || html[i + 1] === "?") {
      const close = next(">", i + 2);
      i = close < 0 ? html.length : close + 1;
      continue;
    }
    const slash = html[i + 1] === "/";
    const from = slash ? i + 2 : i + 1;
    if (!letter(html.charCodeAt(from))) {
      text("<");
      i++;
      continue;
    }
    let after = from + 1;
    while (after < html.length && nameChar(html.charCodeAt(after))) after++;
    const close = tagEnd(after);
    if (close < 0) break;
    const tag = lower.slice(from, after);
    const attrs = html.slice(after, close);
    i = close + 1;
    if (slash) {
      const at = last(tag);
      if (at > 0) cut(at);
      continue;
    }
    for (const ends of closes[tag] ?? []) {
      const at = open(ends);
      if (at > 0) cut(at);
    }
    if (blocks.has(tag) && stack.at(-1)!.tag === "p") cut(stack.length - 1);
    const node: Node = { tag, attrs, kids: [] };
    stack.at(-1)!.kids.push(node);
    if (tag === "meta" && !og && [attr(attrs, "property"), attr(attrs, "name")].some((v) => v.toLowerCase() === "og:title")) og = attr(attrs, "content");
    if (raw.has(tag)) {
      const end = lower.indexOf(`</${tag}`, i);
      const body = html.slice(i, end < 0 ? html.length : end);
      node.kids.push(tag === "title" || tag === "textarea" ? decode(body) : body);
      if (tag === "title" && title === null) title = node.kids[0] as string;
      i = end < 0 ? html.length : html.indexOf(">", end) + 1 || html.length;
    } else if (!voids.has(tag) && html[close - 1] !== "/" && stack.length < deepest) push(node);
  }
  return { tree: root, title: title ?? "", og };
}

const find = (node: Node, tag: string): Node | null => {
  if (node.tag === tag) return node;
  for (const kid of node.kids)
    if (typeof kid !== "string" && !dropped.has(kid.tag)) {
      const found = find(kid, tag);
      if (found) return found;
    }
  return null;
};
const textOf = (node: Node | string): string => (typeof node === "string" ? node : node.kids.map(textOf).join(""));
// How many characters of words a part shows: no scripts, styles, or chrome.
const shownLength = (node: Node | string): number =>
  typeof node === "string" ? node.trim().length : dropped.has(node.tag) || chrome(node.attrs) || hidden(node.attrs) ? 0 : node.kids.reduce((sum, kid) => sum + shownLength(kid), 0);
// A mark around text, with the spaces that were around it kept outside.
const mark = (text: string, by: string) => (text.trim() ? `${/^\s/.test(text) ? " " : ""}${by}${text.trim()}${by}${/\s$/.test(text) ? " " : ""}` : text);

let quoted = 0;
// One node as Markdown. Only `pre` keeps its spaces. `header`: whether a <header> is the page's words, as an article's
// is, or the site's, which is dropped.
function render(node: Node, base: string, depth: number, header: boolean): string {
  const inner = (n = node, d = depth) => n.kids.map((k) => (typeof k === "string" ? k.replace(/\s+/g, " ") : render(k, base, d, header))).join("");
  const block = (text: string) => (text.trim() ? `\n\n${text.trim()}\n\n` : "");
  const href = (value: string) => {
    if (!value || /^(javascript|data|vbscript):/i.test(value.trim())) return "";
    return URL.canParse(value, base) ? new URL(value, base).href : "";
  };
  const { tag } = node;
  if (dropped.has(tag) || (tag === "header" && !header) || hidden(node.attrs) || chrome(node.attrs)) return "";
  if (/^h[1-6]$/.test(tag)) return block(`${"#".repeat(Number(tag[1]))} ${line(inner())}`);
  switch (tag) {
    case "br":
      return "  \n";
    case "hr":
      return "\n\n---\n\n";
    case "strong":
    case "b":
      return mark(inner(), "**");
    case "em":
    case "i":
      return mark(inner(), "_");
    case "s":
    case "del":
      return mark(inner(), "~~");
    case "code": {
      const text = textOf(node).replace(/\s+/g, " ");
      return text.trim() ? mark(text, text.includes("`") ? "``" : "`") : "";
    }
    case "a": {
      const text = line(inner());
      const to = href(attr(node.attrs, "href"));
      return !text ? "" : to && !to.startsWith(`${base.split("#")[0]}#`) ? `[${text}](${to})` : text;
    }
    case "img": {
      const alt = line(attr(node.attrs, "alt"));
      const src = href(attr(node.attrs, "src"));
      return src ? `![${alt}](${src})` : alt;
    }
    case "pre": {
      const code = textOf(node).replace(/^\n/, "").replace(/\s+$/, "");
      const language = /(?:language-|lang-|brush:\s*)([\w+-]+)/.exec(`${attr(node.attrs, "class")} ${attr((find(node, "code") ?? node).attrs, "class")}`)?.[1] ?? "";
      const fence = "`".repeat(Math.max(3, ...[...code.matchAll(/`{3,}/g)].map((m) => m[0].length + 1)));
      return code ? block(`${fence}${language}\n${code}\n${fence}`) : "";
    }
    case "blockquote": {
      // Past 4 quotes inside one another, one adds no more ">", as past 8 lists one indents no more, so a page of them
      // can't make its text longer at every one.
      if (quoted >= 4) return block(inner());
      quoted++;
      try {
        return block(inner().trim().split("\n").map((l) => `> ${l}`.trimEnd()).join("\n"));
      } finally {
        quoted--;
      }
    }
    case "ul":
    case "ol": {
      let n = Number(attr(node.attrs, "start")) || 1;
      const items = node.kids.filter((k): k is Node => typeof k !== "string" && k.tag === "li" && !hidden(k.attrs));
      const said = items.map((item) => {
        const marker = tag === "ol" ? `${n++}. ` : "- ";
        const body = inner(item, depth + 1).trim().replace(/\n{3,}/g, "\n\n");
        return depth >= 8 ? `${marker}${body}` : marker + body.split("\n").join(`\n${" ".repeat(marker.length)}`);
      });
      return said.length ? (depth ? `\n${said.join("\n")}\n` : block(said.join("\n"))) : "";
    }
    case "table":
      return block(table(node, base, header));
    case "dt":
      return block(`**${line(inner())}**`);
    default:
      return blocks.has(tag) ? block(inner()) : inner();
  }
}

// A simple table, whose rows hold cells and no table, as a Markdown table; any other as its rows, each a line of text.
function table(node: Node, base: string, header: boolean) {
  const rows: Node[] = [];
  const walk = (n: Node) => n.kids.forEach((k) => typeof k !== "string" && (k.tag === "tr" ? rows.push(k) : k.tag !== "table" && walk(k)));
  walk(node);
  const cells = rows.map((row) => row.kids.filter((k): k is Node => typeof k !== "string" && (k.tag === "td" || k.tag === "th")));
  const text = (n: Node) => line(render({ ...n, tag: "span" }, base, 0, header));
  const simple = cells.length > 0 && cells.every((row) => row.length && row.every((cell) => !find(cell, "table") && !/\b(colspan|rowspan)\s*=\s*["']?[2-9]/i.test(cell.attrs)));
  if (!simple) return rows.map(text).filter(Boolean).join("\n\n");
  const width = Math.max(...cells.map((row) => row.length));
  const said = cells.map((row) => `| ${Array.from({ length: width }, (_, i) => (row[i] ? text(row[i]).replace(/\|/g, "\\|") : "")).join(" | ")} |`);
  return [said[0], `|${" --- |".repeat(width)}`, ...said.slice(1)].join("\n");
}

/** The page's text from its bytes, in the charset its header or its own <meta> names, else UTF-8. */
export function textFrom(bytes: Buffer, charset: string) {
  const label = charset || /<meta[^>]+charset\s*=\s*["']?([\w-]+)/i.exec(bytes.subarray(0, 4096).toString("latin1"))?.[1] || "utf-8";
  try {
    return new TextDecoder(label).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

/** An HTML page as its title and Markdown, and whether it seems to need a browser: little text, and scripts. */
export function toMarkdown(html: string, base: string) {
  const { tree, title: named, og } = parse(html);
  const title = line(og || named);
  // The page's main part, or the article in it that holds most of its words, as a README does on its repository's page.
  const outer = find(tree, "main");
  const inside = outer && find({ ...outer, tag: "#main" }, "article");
  const main = (inside && shownLength(inside) > 0.4 * shownLength(outer) ? inside : outer) ?? find(tree, "article");
  let fenced = false;
  const markdown = render(main ?? find(tree, "body") ?? tree, base, 0, Boolean(main))
    .split("\n")
    .map((l) => {
      if (/^\s*```/.test(l)) return (fenced = !fenced), l.trimEnd();
      return fenced ? l : l.replace(/^(\s*)(.*)$/, (_, lead: string, rest: string) => lead + rest.replace(/[ \t]+/g, " ")).trimEnd();
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const words = markdown.replace(/[#*_`>[\]()!|~-]/g, " ").split(/\s+/).filter(Boolean).length;
  // Only JavaScript: scripts and next to no words, and an empty app root, or words asking for JavaScript, or none at all.
  const scripted = /<script\b/i.test(html);
  const needsBrowser = scripted && (words < 5 || (words < 60 && emptyRoot(tree)) || (words < 150 && asks.test(withoutScripts(html))));
  return { title, markdown, needsBrowser };
}

// An app's root, a <div> with an id such as root, with nothing in it: the page is drawn by its scripts.
const roots = new Set(["root", "app", "__next", "__nuxt", "___gatsby", "svelte"]);
function emptyRoot(tree: Node) {
  for (const todo: Node[] = [tree]; todo.length; ) {
    const node = todo.pop()!;
    if (node.tag === "div" && roots.has(attr(node.attrs, "id").toLowerCase()) && node.kids.every((k) => typeof k === "string" && !k.trim())) return true;
    for (const kid of node.kids) if (typeof kid !== "string" && kid.tag !== "script") todo.push(kid);
  }
  return false;
}
const asks = /enable javascript|requires? javascript|need javascript|javascript is (?:disabled|required|turned off)|turn on javascript/i;
// The page without its scripts, in one pass: one with no </script> after it stays, as does every one after it.
function withoutScripts(html: string) {
  const lower = ascii(html);
  let kept = "";
  let from = 0;
  for (let at = lower.indexOf("<script"); at >= 0; at = lower.indexOf("<script", at)) {
    if (/\w/.test(lower[at + 7] ?? "")) {
      at += 7;
      continue;
    }
    const end = lower.indexOf("</script>", at + 7);
    if (end < 0) break;
    kept += html.slice(from, at);
    at = from = end + 9;
  }
  return kept + html.slice(from);
}
