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
// no open one is skipped.
function parse(html: string): Node {
  const root: Node = { tag: "#root", attrs: "", kids: [] };
  const stack = [root];
  const open = (tag: string) => {
    for (let i = stack.length - 1; i > 0; i--) {
      if (stack[i].tag === tag) return i;
      if (scopes.has(stack[i].tag)) break;
    }
    return -1;
  };
  const lower = html.toLowerCase();
  const token = /<!--[\s\S]*?(?:-->|$)|<!\[CDATA\[[\s\S]*?\]\]>|<![^>]*>|<\?[^>]*>|<(\/?)([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|[^<]+|</g;
  for (let m: RegExpExecArray | null; (m = token.exec(html)); ) {
    const [all, slash, name, attrs = ""] = m;
    if (!name) {
      if (all[0] !== "<" || all === "<") stack.at(-1)!.kids.push(decode(all));
      continue;
    }
    const tag = name.toLowerCase();
    if (slash) {
      const at = stack.findLastIndex((n) => n.tag === tag);
      if (at > 0) stack.length = at;
      continue;
    }
    for (const ends of closes[tag] ?? []) {
      const at = open(ends);
      if (at > 0) stack.length = at;
    }
    if (blocks.has(tag) && stack.at(-1)!.tag === "p") stack.pop();
    const node: Node = { tag, attrs, kids: [] };
    stack.at(-1)!.kids.push(node);
    if (raw.has(tag)) {
      const end = lower.indexOf(`</${tag}`, token.lastIndex);
      const body = html.slice(token.lastIndex, end < 0 ? html.length : end);
      node.kids.push(tag === "title" || tag === "textarea" ? decode(body) : body);
      token.lastIndex = end < 0 ? html.length : html.indexOf(">", end) + 1 || html.length;
    } else if (!voids.has(tag) && !all.endsWith("/>")) stack.push(node);
  }
  return root;
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
    case "blockquote":
      return block(inner().trim().split("\n").map((l) => `> ${l}`.trimEnd()).join("\n"));
    case "ul":
    case "ol": {
      let n = Number(attr(node.attrs, "start")) || 1;
      const items = node.kids.filter((k): k is Node => typeof k !== "string" && k.tag === "li" && !hidden(k.attrs));
      const said = items.map((item) => {
        const marker = tag === "ol" ? `${n++}. ` : "- ";
        const body = inner(item, depth + 1).trim().replace(/\n{3,}/g, "\n\n");
        return marker + body.split("\n").join(`\n${" ".repeat(marker.length)}`);
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
  const tree = parse(html);
  const og = /<meta[^>]+(?:property|name)\s*=\s*["']og:title["'][^>]*>/i.exec(html)?.[0];
  const title = line((og && attr(og, "content")) || decode(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? ""));
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
  const outside = html.replace(/<script\b[\s\S]*?<\/script>/gi, "");
  const root = /<div[^>]+id=["']?(?:root|app|__next|__nuxt|___gatsby|svelte)["']?[^>]*>\s*<\/div>/i.test(outside);
  const asks = /enable javascript|requires? javascript|need javascript|javascript is (?:disabled|required|turned off)|turn on javascript/i.test(outside);
  const needsBrowser = /<script\b/i.test(html) && (words < 5 || (words < 60 && root) || (words < 150 && asks));
  return { title, markdown, needsBrowser };
}
