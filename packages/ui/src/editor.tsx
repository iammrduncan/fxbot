// The app's message box (Input Markdown): ProseMirror, built from the formatting, in place of the textarea. To the app
// it acts as the textarea did, as Messages' box does: `value` is the text, standard Markdown, `onChange` hands over the
// text and the caret's offset in it, and its ref has `value`, `selectionStart`, and `setSelectionRange`. So sending,
// drafts, the $ skill list, and pasted files work on text, as before.
import { useLayoutEffect, useRef, useState, type ComponentProps } from "react";
import { Schema } from "prosemirror-model";
import { EditorState, Selection, TextSelection } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import * as formatting from "./formatting.ts";

const schema = new Schema({ nodes: formatting.nodes, marks: formatting.marks });
const stateOf = (text: string) => {
  const doc = formatting.fromMarkdown(text, schema);
  return EditorState.create({ schema, doc, selection: Selection.atEnd(doc), plugins: formatting.plugins(schema) });
};

type Handler = ((event: any) => void) | undefined;
// A textarea's props, and its ref, which gets the editor's DOM, acting as a textarea.
type Props = Omit<ComponentProps<"textarea">, "ref"> & { ref?: any };

export function Editor({ value, onChange, onKeyDown, onPaste, onFocus, onBlur, placeholder, disabled, className, ref, rows: _rows, ...aria }: Props) {
  const mount = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const text = String(value ?? "");
  const [empty, setEmpty] = useState(!text);
  // The app's handlers as they are now, for the editor, which is made once.
  const latest = useRef<Record<string, Handler>>({});
  latest.current = { onChange, onKeyDown, onPaste, onFocus, onBlur } as Record<string, Handler>;

  useLayoutEffect(() => {
    const v: EditorView = new EditorView(mount.current, {
      state: stateOf(text),
      // The app's keys after the box's own Enter in a code block: it sends with Enter, and its skills list takes
      // arrows, Enter, and Tab while it's open. A key it takes is one it stops.
      handleKeyDown(view, event) {
        if (formatting.ownsKey(view.state, event)) return false;
        (event as KeyboardEvent & { nativeEvent?: KeyboardEvent }).nativeEvent = event;
        latest.current.onKeyDown?.(event);
        return event.defaultPrevented;
      },
      handlePaste(_view, event) {
        latest.current.onPaste?.(event);
        return event.defaultPrevented;
      },
      handleDOMEvents: {
        focus: (_view, event) => (latest.current.onFocus?.(event), false),
        blur: (_view, event) => (latest.current.onBlur?.(event), false),
      },
      dispatchTransaction(tr) {
        v.updateState(v.state.apply(tr));
        setEmpty(formatting.isEmpty(v.state.doc));
        if (tr.docChanged) latest.current.onChange?.({ target: { value: formatting.toMarkdown(v.state.doc), selectionStart: formatting.offsetOf(v.state.doc, v.state.selection.from) } });
      },
    });
    view.current = v;
    // What the app reads from a textarea.
    Object.defineProperty(v.dom, "selectionStart", { get: () => formatting.offsetOf(v.state.doc, v.state.selection.from) });
    Object.defineProperty(v.dom, "value", { get: () => formatting.toMarkdown(v.state.doc) });
    Object.assign(v.dom, { setSelectionRange: (at: number) => v.dispatch(v.state.tr.setSelection(TextSelection.near(v.state.doc.resolve(formatting.posOf(v.state.doc, at))))) });
    if (ref) ref.current = v.dom;
    return () => {
      if (ref) ref.current = null;
      view.current = null;
      v.destroy();
    };
  }, []);

  // A change from the app: a send clears the box, and a pick from the skills list or a plugin's setDraft rewrites it.
  useLayoutEffect(() => {
    const v = view.current;
    if (!v || text === formatting.toMarkdown(v.state.doc)) return;
    v.updateState(stateOf(text));
    setEmpty(formatting.isEmpty(v.state.doc));
  }, [text]);

  // Its role and state for assistive technology, the app's, and its classes, set before the page paints, so the box
  // has its padding and height from the start. The keyboard keeps its habits: autocorrect, capitals, and spelling.
  useLayoutEffect(() => {
    const attributes: Record<string, string> = { "aria-multiline": "true", "data-slot": "input-group-control", autocorrect: "on", autocapitalize: "sentences", spellcheck: "true", class: `fx-editor fx-formatted ${className ?? ""}` };
    for (const [name, value] of Object.entries(aria)) if (value !== undefined && (name.startsWith("aria-") || name === "role")) attributes[name] = String(value);
    view.current?.setProps({ attributes, editable: () => !disabled });
  });

  return (
    <div className="relative min-w-0 flex-1">
      <div ref={mount} />
      {empty && (
        <span className="pointer-events-none absolute inset-x-2.5 top-3 truncate text-base text-muted-foreground md:text-sm" aria-hidden="true">
          {placeholder}
        </span>
      )}
    </div>
  );
}
