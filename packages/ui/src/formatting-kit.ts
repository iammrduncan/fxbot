// What loads as a chunk of its own as the page starts (Input Markdown): ProseMirror, the formatting, the app's box,
// and the format bar. The page's `require` hands plugins these same modules, so every box on the page shares one copy
// of ProseMirror, and the formatting's list of boxes, which the format bar reads.
import * as commands from "prosemirror-commands";
import * as historyModule from "prosemirror-history";
import * as inputrules from "prosemirror-inputrules";
import * as keymap from "prosemirror-keymap";
import * as model from "prosemirror-model";
import * as schemaList from "prosemirror-schema-list";
import * as state from "prosemirror-state";
import * as transform from "prosemirror-transform";
import * as view from "prosemirror-view";
import * as formatting from "./formatting.ts";

export const modules: Record<string, unknown> = {
  "prosemirror-commands": commands,
  "prosemirror-history": historyModule,
  "prosemirror-inputrules": inputrules,
  "prosemirror-keymap": keymap,
  "prosemirror-model": model,
  "prosemirror-schema-list": schemaList,
  "prosemirror-state": state,
  "prosemirror-transform": transform,
  "prosemirror-view": view,
};
export { formatting };
export { Editor } from "./editor.tsx";
export { FormatBar, FormatButton } from "./format-bar.tsx";
