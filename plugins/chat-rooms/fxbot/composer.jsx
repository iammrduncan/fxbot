// The room's message box. It's ProseMirror, the app's own, with the app's formatting, so it formats as the owner types,
// as a bot's chat box does, and a bot you tag is a chip with its avatar, which deletes as one piece. `@` at the start of
// a line or after a space lists the room's bots, then Everyone, filtered by what follows, and the pick replaces what was
// typed. `/` at the start of the message lists the room's commands, /fresh. Enter sends, but in a code block, where it
// starts a line, and Shift+Enter starts a new line, or the next item in a list. Sending writes standard Markdown, with
// each chip as its token.
import { useEffect, useRef, useState } from "react";
import * as app from "@fxbot/app";
import { Schema } from "prosemirror-model";
import { EditorState, TextSelection } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { Chip, Stack } from "./faces.jsx";
import { all, tokenOf, tokens } from "./mentions.ts";

const { formatting } = app;
const schema = new Schema({
  nodes: {
    ...formatting.nodes,
    mention: {
      attrs: { bot: {} },
      group: "inline",
      inline: true,
      atom: true,
      selectable: false,
      // A mention in a bold line is bold, and never code or a link.
      marks: "strong em strike",
      parseDOM: [{ tag: "span[data-bot]", getAttrs: (dom) => ({ bot: dom.getAttribute("data-bot") }) }],
      toDOM: (node) => ["span", { "data-bot": node.attrs.bot }],
    },
  },
  marks: formatting.marks,
});

// A chip as its token, and a token back as a chip.
const chips = { type: "mention", pattern: tokens, write: (node) => (node.attrs.bot === "all" ? all : tokenOf(node.attrs.bot)), read: (m) => schema.nodes.mention.create({ bot: m[1] ?? "all" }) };
// The box's text, Markdown, each chip as its token, and a text back in the box, after a send that failed.
const textOf = (doc) => formatting.toMarkdown(doc, chips).trim();
const docOf = (text) => formatting.fromMarkdown(text, schema, chips);
// The room's commands, for `/` at the start of the message.
const commands = [{ id: "/fresh", name: "/fresh", description: "Start the room over toward what you write next", command: true }];
const fresh = (doc) => EditorState.create({ schema, doc, plugins: formatting.plugins(schema, chips) });

// The @ being typed before the caret, and what follows it: at the start of a line or after a space. Or a / at the
// start of the message, and the letters after it. Not in a code block.
function typing(state) {
  const { $from, empty } = state.selection;
  if (!empty || $from.parent.type.spec.code) return null;
  const before = $from.parent.textBetween(0, $from.parentOffset, null, "￼");
  const command = state.doc.firstChild === $from.parent && /^\/([a-z]{0,10})$/.exec(before);
  if (command) return { from: $from.pos - command[0].length, to: $from.pos, query: command[1], command: true };
  const m = /(?:^|\s)@([^@\n￼]{0,30})$/.exec(before);
  return m ? { from: $from.pos - m[1].length - 1, to: $from.pos, query: m[1] } : null;
}
// What matches what follows @: names that start with it, then names that hold it. Everyone comes last.
function rank(choices, query) {
  const q = query.toLowerCase();
  const score = (c) => (!q || c.name.toLowerCase().startsWith(q) ? 0 : c.name.toLowerCase().includes(q) ? 1 : 9);
  return choices
    .map((c, i) => [score(c), i, c])
    .filter(([n]) => n < 9)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
    .map(([, , c]) => c);
}

// `submitRef` gets the box's send, for a Send button, and `onEmpty` hears whether it's empty.
export function Composer({ bots, placeholder, disabled, onSend, submitRef, onEmpty }) {
  const box = useRef(null);
  const view = useRef(null);
  // The view, once it's made, for the format bar above the box.
  const [made, setMade] = useState(null);
  // The room's bots, then Everyone, for the list.
  const choices = useRef([]);
  choices.current = [...bots.map((bot) => ({ id: bot.id, name: bot.name, bot })), ...(bots.length > 1 ? [{ id: "all", name: "Everyone" }] : [])];
  const send = useRef(onSend);
  send.current = onSend;
  // Each chip's DOM node in the box, and its bot, for its avatar, drawn with createPortal where the app has it.
  const [chips, setChips] = useState(() => new Map());
  const [list, setList] = useState(null);
  const shown = useRef(null);
  shown.current = list;
  // The @ whose list Escape closed, so it stays shut until another is typed.
  const dismissed = useRef(-1);
  const [empty, setEmpty] = useState(true);
  const [said, setSaid] = useState("");
  const told = useRef(onEmpty);
  told.current = onEmpty;
  useEffect(() => told.current?.(empty), [empty]);

  function refresh(state) {
    setEmpty(formatting.isEmpty(state.doc));
    const at = typing(state);
    if (!at || at.from !== dismissed.current) dismissed.current = -1;
    const matches = !at || at.from === dismissed.current ? [] : at.command ? commands.filter((c) => c.name.startsWith(`/${at.query}`)) : rank(choices.current, at.query);
    const next = matches.length ? { ...at, matches, active: shown.current && shown.current.from === at.from && shown.current.query === at.query ? shown.current.active : 0 } : null;
    if (next && (!shown.current || shown.current.matches.length !== matches.length)) setSaid(`${matches.length} ${matches.length === 1 ? "match" : "matches"}`);
    setList(next);
  }

  function pick(choice) {
    const v = view.current;
    const at = shown.current;
    if (!v || !at) return;
    if (choice.command) {
      v.dispatch(v.state.tr.insertText(`${choice.name} `, at.from, at.to));
      v.focus();
      setSaid(`${choice.name}: ${choice.description}`);
      return;
    }
    const tr = v.state.tr.replaceWith(at.from, at.to, [schema.nodes.mention.create({ bot: choice.id }), schema.text(" ")]);
    v.dispatch(tr.setSelection(TextSelection.create(tr.doc, at.from + 2)));
    v.focus();
    setSaid(`Mentioned ${choice.id === "all" ? "everyone" : choice.name}`);
  }

  function submit() {
    const v = view.current;
    const text = textOf(v.state.doc);
    if (!text) return;
    v.updateState(fresh());
    refresh(v.state);
    Promise.resolve(send.current(text)).catch(() => {
      v.updateState(fresh(docOf(text)));
      refresh(v.state);
    });
  }

  if (submitRef) submitRef.current = submit;

  function key(event) {
    if (event.isComposing || event.keyCode === 229) return false;
    const at = shown.current;
    if (at) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        const by = event.key === "ArrowDown" ? 1 : -1;
        setList({ ...at, active: (at.active + by + at.matches.length) % at.matches.length });
        return true;
      }
      if ((event.key === "Enter" || event.key === "Tab") && !event.shiftKey) {
        pick(at.matches[at.active]);
        return true;
      }
      if (event.key === "Escape") {
        dismissed.current = at.from;
        setList(null);
        return true;
      }
    }
    // Enter sends, but in a code block, where it's the box's: a line. Cmd or Ctrl+Enter sends from there too.
    if (event.key === "Enter" && !event.shiftKey && !formatting.ownsKey(view.current.state, event)) {
      submit();
      return true;
    }
    return false;
  }

  useEffect(() => {
    const nameOf = (id) => (id === "all" ? "everyone" : (choices.current.find((c) => c.id === id)?.name ?? "a bot that's gone"));
    const chip = (node) => {
      const dom = document.createElement("span");
      dom.dataset.bot = node.attrs.bot;
      dom.contentEditable = "false";
      if (app.createPortal) setChips((now) => new Map(now).set(dom, node.attrs.bot));
      else (dom.className = "cr-chip"), (dom.textContent = `@${nameOf(node.attrs.bot)}`);
      return {
        dom,
        ignoreMutation: () => true,
        destroy: () =>
          app.createPortal &&
          setChips((now) => {
            const next = new Map(now);
            next.delete(dom);
            return next;
          }),
      };
    };
    const v = new EditorView(box.current, {
      state: fresh(),
      nodeViews: { mention: chip },
      attributes: { role: "textbox", "aria-multiline": "true", "aria-label": "Message the room", "aria-autocomplete": "list", autocorrect: "on", autocapitalize: "sentences", spellcheck: "true", class: "cr-editor fx-formatted" },
      handleKeyDown: (_view, event) => key(event),
      dispatchTransaction(tr) {
        v.updateState(v.state.apply(tr));
        refresh(v.state);
      },
    });
    view.current = v;
    setMade(v);
    return () => (setMade(null), v.destroy());
  }, []);

  useEffect(() => void view.current?.setProps({ editable: () => !disabled }), [disabled]);
  // The list, for assistive technology: the box controls it, and its active option is the box's.
  useEffect(() => {
    const dom = view.current?.dom;
    if (!dom) return;
    if (list) dom.setAttribute("aria-controls", "cr-mentions"), dom.setAttribute("aria-activedescendant", `cr-mention-${list.active}`);
    else dom.removeAttribute("aria-controls"), dom.removeAttribute("aria-activedescendant");
  }, [list]);

  return (
    <div className="cr-box">
      <app.ui.FormatBar view={made} className="pb-1" />
      {list && (
        <div id="cr-mentions" role="listbox" aria-label={list.command ? "Commands" : "Bots"} className="absolute right-0 bottom-full left-0 z-10 mb-2 max-h-72 overflow-y-auto rounded-2xl border bg-popover p-1 text-popover-foreground shadow-md">
          {list.matches.map((choice, i) => (
            <button
              key={choice.id}
              id={`cr-mention-${i}`}
              type="button"
              role="option"
              aria-selected={i === list.active}
              // Keeps the box focused, so the pick lands where the caret was.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(choice)}
              className={`flex w-full min-w-0 items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm ${i === list.active ? "bg-accent text-accent-foreground" : ""}`}
            >
              {choice.command ? null : choice.bot ? <app.ui.Blob {...choice.bot} size={24} /> : <Stack ids={bots.map((bot) => bot.id)} size={16} />}
              <span className={choice.command ? "shrink-0 font-medium" : "min-w-0 flex-1 truncate font-medium"}>{choice.name}</span>
              {choice.command && <span className="min-w-0 flex-1 truncate text-muted-foreground">{choice.description}</span>}
            </button>
          ))}
        </div>
      )}
      <div className="relative">
        <div ref={box} />
        {empty && (
          <span className="cr-placeholder" aria-hidden="true">
            {placeholder}
          </span>
        )}
      </div>
      <div aria-live="polite" className="sr-only">
        {said}
      </div>
      {app.createPortal && [...chips].map(([dom, id]) => app.createPortal(<Chip id={id} />, dom, `${id}-${[...chips.keys()].indexOf(dom)}`))}
    </div>
  );
}
