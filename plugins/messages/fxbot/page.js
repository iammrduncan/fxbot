let react = require("react");
let _fxbot_app = require("@fxbot/app");
let prosemirror_model = require("prosemirror-model");
let prosemirror_state = require("prosemirror-state");
let prosemirror_view = require("prosemirror-view");
let react_jsx_runtime = require("react/jsx-runtime");
// fxbot/box.jsx
const tagLink = /\[@([^\]\n]*)\]\(\/profiles\/([0-9a-f]{12})\)/g;
const anyTag = /\[@([^\]\n]*)\]\((\/[^\s)"]*)(?: "([^"\n]*)")?\)/g;
const botPath = /^\/profiles\/([0-9a-f]{12})$/;
const schema = new prosemirror_model.Schema({
	nodes: {
		..._fxbot_app.formatting.nodes,
		tag: {
			attrs: {
				bot: { default: "" },
				name: {},
				link: { default: "" },
				title: { default: "" }
			},
			group: "inline",
			inline: true,
			atom: true,
			selectable: false,
			marks: "strong em strike",
			parseDOM: [{
				tag: "span[data-bot]",
				getAttrs: (dom) => ({
					bot: dom.getAttribute("data-bot"),
					name: dom.getAttribute("data-name"),
					link: dom.getAttribute("data-link") ?? "",
					title: dom.getAttribute("data-title") ?? ""
				})
			}],
			toDOM: (node) => ["span", {
				"data-bot": node.attrs.bot,
				"data-name": node.attrs.name,
				"data-link": node.attrs.link,
				"data-title": node.attrs.title
			}]
		}
	},
	marks: _fxbot_app.formatting.marks
});
const linkOf = ({ bot, name, link, title }) => bot ? `[@${name}](/profiles/${bot})` : `[@${name}](${link}${title ? ` "${title}"` : ""})`;
const chips = {
	type: "tag",
	pattern: anyTag,
	write: (node) => linkOf(node.attrs),
	read: (m) => {
		const bot = botPath.exec(m[2])?.[1];
		return schema.nodes.tag.create(bot && !m[3] ? {
			bot,
			name: m[1]
		} : {
			name: m[1],
			link: m[2],
			title: m[3] ?? ""
		});
	}
};
const textOf = (doc) => _fxbot_app.formatting.toMarkdown(doc, chips);
const docOf = (text) => _fxbot_app.formatting.fromMarkdown(text, schema, chips);
const stateOf = (text) => {
	const doc = docOf(text);
	return prosemirror_state.EditorState.create({
		schema,
		doc,
		selection: prosemirror_state.Selection.atEnd(doc),
		plugins: _fxbot_app.formatting.plugins(schema, chips)
	});
};
const offsetOf = (doc, pos) => _fxbot_app.formatting.offsetOf(doc, pos, chips);
const posOf = (doc, offset) => _fxbot_app.formatting.posOf(doc, offset, chips);
function typing(state) {
	const { $from, empty } = state.selection;
	if (!empty || $from.parent.type.spec.code) return null;
	const before = $from.parent.textBetween(0, $from.parentOffset, null, "￼");
	const m = /(?:^|\s)@([^@\n￼]{0,30})$/.exec(before);
	return m ? {
		from: $from.pos - m[1].length - 1,
		to: $from.pos,
		query: m[1]
	} : null;
}
function rank(choices, query) {
	const q = query.toLowerCase();
	const score = (c) => !q || c.name.toLowerCase().startsWith(q) ? 0 : c.name.toLowerCase().includes(q) ? 1 : 9;
	return choices.map((c, i) => [
		score(c),
		i,
		c
	]).filter(([n]) => n < 9).sort((a, b) => a[0] - b[0] || a[1] - b[1]).slice(0, 8).map(([, , c]) => c);
}
function Chip({ id, name }) {
	const bot = ((0, _fxbot_app.useBots)() ?? []).find((b) => b.id === id);
	return (0, react_jsx_runtime.jsxs)("span", {
		className: "fm-chip",
		children: [
			bot && (0, react_jsx_runtime.jsx)("span", {
				className: "fm-chip-face",
				"aria-hidden": "true",
				children: (0, react_jsx_runtime.jsx)(_fxbot_app.ui.Blob, {
					...bot,
					size: 16
				})
			}),
			"@",
			bot?.name ?? name
		]
	});
}
function Box({ bot, value, onChange, onKeyDown, onPaste, onFocus, onBlur, placeholder, disabled, className, ref, rows: _rows, ...aria }) {
	const mount = (0, react.useRef)(null);
	const view = (0, react.useRef)(null);
	const bots = (0, _fxbot_app.useBots)() ?? [];
	const sources = (0, react.useRef)([]);
	sources.current = _fxbot_app.useMentions?.() ?? [];
	const found = (0, react.useRef)(new Map());
	const asking = (0, react.useRef)(null);
	const [reach, setReach] = (0, react.useState)(() => new Map());
	const choices = (0, react.useRef)([]);
	choices.current = bots.filter((b) => reach.has(b.id)).map((b) => ({
		...b,
		about: reach.get(b.id)
	}));
	const load = () => {
		if (bot?.id) (0, _fxbot_app.api)(`/tags/${bot.id}`).then((res) => res.ok ? res.json() : []).then((list) => setReach(new Map(list.map((one) => [one.id, one.about]))), () => {});
	};
	(0, react.useEffect)(load, [bot?.id]);
	const latest = (0, react.useRef)({});
	latest.current = {
		onChange,
		onKeyDown,
		onPaste,
		onFocus,
		onBlur,
		load,
		bot
	};
	const [chips, setChips] = (0, react.useState)(() => new Map());
	const [list, setList] = (0, react.useState)(null);
	const shown = (0, react.useRef)(null);
	shown.current = list;
	const dismissed = (0, react.useRef)(-1);
	const [empty, setEmpty] = (0, react.useState)(!value);
	const [said, setSaid] = (0, react.useState)("");
	function refresh(state) {
		setEmpty(_fxbot_app.formatting.isEmpty(state.doc));
		const at = typing(state);
		if (!at || at.from !== dismissed.current) dismissed.current = -1;
		const open = at && at.from !== dismissed.current;
		const theirs = open ? found.current.get(at.query) : [];
		if (open && !theirs && sources.current.length) ask(at.query);
		const matches = open ? [...rank(choices.current, at.query), ...theirs ?? []] : [];
		const next = matches.length ? {
			...at,
			matches,
			active: shown.current && shown.current.from === at.from && shown.current.query === at.query ? shown.current.active : 0
		} : null;
		if (next && (!shown.current || shown.current.matches.length !== matches.length)) setSaid(`${matches.length} ${matches.length === 1 ? "match" : "matches"}`);
		setList(next);
	}
	function ask(query) {
		clearTimeout(asking.current);
		asking.current = setTimeout(async () => {
			const lists = await Promise.all(sources.current.map((source) => Promise.resolve().then(() => source.search(query, latest.current.bot)).then((list) => (Array.isArray(list) ? list.slice(0, 8) : []).map((choice) => ({
				...choice,
				plugin: source.plugin,
				iconKey: source.iconKey,
				mention: true
			})), () => [])));
			found.current.set(query, lists.flat());
			if (found.current.size > 50) found.current.delete(found.current.keys().next().value);
			const v = view.current;
			if (v && typing(v.state)?.query === query) refresh(v.state);
		}, 150);
	}
	function pick(choice) {
		const v = view.current;
		const at = shown.current;
		if (!v || !at) return;
		const clean = (text) => String(text ?? "").replace(/[[\]\n]/g, "");
		const node = choice.mention ? schema.nodes.tag.create({
			name: clean(choice.name),
			link: String(choice.link).replace(/[\s)"]/g, ""),
			title: String(choice.title ?? "").replace(/["\n]/g, "")
		}) : schema.nodes.tag.create({
			bot: choice.id,
			name: clean(choice.name)
		});
		const tr = v.state.tr.replaceWith(at.from, at.to, [node, schema.text(" ")]);
		v.dispatch(tr.setSelection(prosemirror_state.TextSelection.create(tr.doc, at.from + 2)));
		v.focus();
		setSaid(`Tagged ${choice.name}`);
	}
	function key(event) {
		if (event.isComposing || event.keyCode === 229) return false;
		const at = shown.current;
		if (at) {
			if (event.key === "ArrowDown" || event.key === "ArrowUp") {
				setList({
					...at,
					active: (at.active + (event.key === "ArrowDown" ? 1 : -1) + at.matches.length) % at.matches.length
				});
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
		if (view.current && _fxbot_app.formatting.ownsKey(view.current.state, event)) return false;
		event.nativeEvent = event;
		latest.current.onKeyDown?.(event);
		return event.defaultPrevented;
	}
	(0, react.useLayoutEffect)(() => {
		const chip = (node) => {
			const dom = document.createElement("span");
			dom.dataset.bot = node.attrs.bot;
			dom.contentEditable = "false";
			setChips((now) => new Map(now).set(dom, {
				id: node.attrs.bot,
				name: node.attrs.name
			}));
			return {
				dom,
				ignoreMutation: () => true,
				destroy: () => setChips((now) => {
					const next = new Map(now);
					next.delete(dom);
					return next;
				})
			};
		};
		const v = new prosemirror_view.EditorView(mount.current, {
			state: stateOf(value ?? ""),
			nodeViews: { tag: chip },
			handleKeyDown: (_view, event) => key(event),
			handlePaste(_view, event) {
				latest.current.onPaste?.(event);
				return event.defaultPrevented;
			},
			handleDOMEvents: {
				focus: (_view, event) => (latest.current.load(), latest.current.onFocus?.(event), false),
				blur: (_view, event) => (setList(null), latest.current.onBlur?.(event), false)
			},
			dispatchTransaction(tr) {
				v.updateState(v.state.apply(tr));
				refresh(v.state);
				if (tr.docChanged) latest.current.onChange?.({ target: {
					value: textOf(v.state.doc),
					selectionStart: offsetOf(v.state.doc, v.state.selection.from)
				} });
			}
		});
		view.current = v;
		Object.defineProperty(v.dom, "selectionStart", { get: () => offsetOf(v.state.doc, v.state.selection.from) });
		Object.defineProperty(v.dom, "value", { get: () => textOf(v.state.doc) });
		v.dom.setSelectionRange = (at) => v.dispatch(v.state.tr.setSelection(prosemirror_state.TextSelection.near(v.state.doc.resolve(posOf(v.state.doc, at)))));
		if (ref) ref.current = v.dom;
		return () => {
			if (ref) ref.current = null;
			view.current = null;
			v.destroy();
		};
	}, []);
	(0, react.useLayoutEffect)(() => {
		const v = view.current;
		if (!v || (value ?? "") === textOf(v.state.doc)) return;
		v.updateState(stateOf(value ?? ""));
		refresh(v.state);
	}, [value]);
	(0, react.useLayoutEffect)(() => {
		const attributes = {
			role: "combobox",
			"aria-multiline": "true",
			"data-slot": "input-group-control",
			autocorrect: "on",
			autocapitalize: "sentences",
			spellcheck: "true",
			class: `fm-editor fx-formatted ${className ?? ""}`,
			...aria
		};
		if (list) Object.assign(attributes, {
			"aria-expanded": "true",
			"aria-controls": "tag-picker",
			"aria-activedescendant": `tag-option-${list.active}`
		});
		else attributes["aria-expanded"] = String(Boolean(aria["aria-expanded"]));
		for (const name of Object.keys(attributes)) if (attributes[name] === void 0) delete attributes[name];
		view.current?.setProps({
			attributes,
			editable: () => !disabled
		});
	});
	const form = view.current?.dom.closest("form");
	return (0, react_jsx_runtime.jsxs)("div", {
		className: "fm-box",
		children: [
			(0, react_jsx_runtime.jsx)("div", { ref: mount }),
			empty && (0, react_jsx_runtime.jsx)("span", {
				className: "fm-placeholder",
				"aria-hidden": "true",
				children: placeholder
			}),
			(0, react_jsx_runtime.jsx)("div", {
				"aria-live": "polite",
				className: "sr-only",
				children: said
			}),
			list && form && (0, _fxbot_app.createPortal)((0, react_jsx_runtime.jsx)("div", {
				id: "tag-picker",
				role: "listbox",
				"aria-label": "Tags",
				className: "absolute right-4 bottom-full left-4 z-10 mb-2 max-h-72 overflow-y-auto rounded-2xl border bg-popover p-1 text-popover-foreground shadow-md",
				children: list.matches.map((choice, i) => (0, react_jsx_runtime.jsxs)("button", {
					id: `tag-option-${i}`,
					type: "button",
					role: "option",
					"aria-selected": i === list.active,
					onMouseDown: (e) => e.preventDefault(),
					onClick: () => pick(choice),
					className: `flex w-full min-w-0 items-start gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm ${i === list.active ? "bg-accent text-accent-foreground" : ""}`,
					children: [choice.mention ? _fxbot_app.ui.PluginIcon ? (0, react_jsx_runtime.jsx)(_fxbot_app.ui.PluginIcon, {
						iconKey: choice.iconKey,
						size: 20
					}) : (0, react_jsx_runtime.jsx)("span", { style: { width: 20 } }) : (0, react_jsx_runtime.jsx)(_fxbot_app.ui.Blob, {
						...choice,
						size: 20
					}), (0, react_jsx_runtime.jsxs)("span", {
						className: "grid min-w-0 flex-1",
						children: [(0, react_jsx_runtime.jsx)("span", {
							className: "font-medium",
							children: choice.name
						}), (0, react_jsx_runtime.jsx)("span", {
							className: "line-clamp-1 text-xs text-muted-foreground",
							children: choice.mention ? choice.detail : choice.about || choice.id
						})]
					})]
				}, choice.mention ? `${choice.plugin}:${choice.key}` : choice.id))
			}), form),
			[...chips].map(([dom, { id, name }], i) => (0, _fxbot_app.createPortal)((0, react_jsx_runtime.jsx)(Chip, {
				id,
				name
			}), dom, `${id}-${i}`))
		]
	});
}
// fxbot/page.jsx
async function call(path, method = "GET", body) {
	const res = await (0, _fxbot_app.api)(path, {
		method,
		...body ? {
			headers: { "content-type": "application/json" },
			body: JSON.stringify(body)
		} : {}
	});
	const answer = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(answer.error ?? `HTTP ${res.status}`);
	return answer;
}
const today = (at) => new Date(at).toDateString() === new Date().toDateString();
const when = (at) => (today(at) ? "Today " : `${new Date(at).toLocaleDateString(void 0, {
	month: "short",
	day: "numeric"
})} `) + new Date(at).toLocaleTimeString(void 0, {
	hour: "2-digit",
	minute: "2-digit"
});
const live = (message) => message.state === "waiting" || message.state === "working";
const outcome = (message) => ({
	waiting: "Waiting",
	working: "Working…",
	failed: message.error || "Failed",
	stopped: "Stopped",
	done: message.answered ? "Answered" : "Read"
})[message.state];
const column = {
	display: "grid",
	gridTemplateColumns: "minmax(0, 1fr)"
};
const wraps = { overflowWrap: "anywhere" };
function Face({ bot }) {
	return bot ? (0, react_jsx_runtime.jsx)(_fxbot_app.ui.Blob, {
		...bot,
		size: 20
	}) : null;
}
function Row({ message, bots }) {
	const from = bots.find((bot) => bot.id === message.from);
	const to = bots.find((bot) => bot.id === message.to);
	const open = () => to && (0, _fxbot_app.go)(`/profiles/${to.id}`);
	return (0, react_jsx_runtime.jsx)("li", { children: (0, react_jsx_runtime.jsxs)("button", {
		type: "button",
		className: "w-full gap-1 rounded-md px-2 py-1.5 text-left hover:bg-muted",
		style: column,
		onClick: open,
		children: [
			(0, react_jsx_runtime.jsxs)("span", {
				className: "flex flex-wrap items-center gap-1.5",
				children: [
					(0, react_jsx_runtime.jsx)(Face, { bot: from }),
					(0, react_jsx_runtime.jsx)("span", {
						className: "font-medium",
						children: from?.name ?? "A bot that's gone"
					}),
					(0, react_jsx_runtime.jsx)("span", {
						className: "text-muted-foreground",
						children: "→"
					}),
					(0, react_jsx_runtime.jsx)(Face, { bot: to }),
					(0, react_jsx_runtime.jsx)("span", {
						className: "font-medium",
						children: to?.name ?? "A bot that's gone"
					}),
					(0, react_jsx_runtime.jsx)("span", {
						className: "ml-auto text-muted-foreground",
						children: outcome(message)
					})
				]
			}),
			(0, react_jsx_runtime.jsx)("span", {
				className: "whitespace-pre-wrap",
				style: wraps,
				children: named(message.text)
			}),
			message.files.length > 0 && (0, react_jsx_runtime.jsx)("span", {
				className: "text-muted-foreground",
				style: wraps,
				children: message.files.map((file) => file.name).join(", ")
			})
		]
	}) });
}
function Thread({ conversation, most, bots, onStop }) {
	const count = conversation.messages.length;
	return (0, react_jsx_runtime.jsxs)("section", {
		className: "gap-1",
		style: column,
		"aria-label": `Conversation ${conversation.id}`,
		children: [(0, react_jsx_runtime.jsxs)("div", {
			className: "flex items-center gap-3 px-2",
			children: [(0, react_jsx_runtime.jsxs)("p", {
				className: "min-w-0 flex-1 text-muted-foreground",
				children: [
					when(conversation.at),
					" · ",
					count,
					" of ",
					most,
					conversation.stopped ? " · stopped" : ""
				]
			}), !conversation.stopped && conversation.messages.some(live) && (0, react_jsx_runtime.jsx)(_fxbot_app.ui.Button, {
				type: "button",
				size: "xs",
				variant: "outline",
				onClick: () => onStop(conversation),
				children: "Stop"
			})]
		}), (0, react_jsx_runtime.jsx)("ul", {
			className: "gap-1",
			style: column,
			children: conversation.messages.map((message) => (0, react_jsx_runtime.jsx)(Row, {
				message,
				bots
			}, message.id))
		})]
	});
}
function Screen() {
	const bots = (0, _fxbot_app.useBots)() ?? [];
	const [data, setData] = (0, react.useState)(null);
	const [earlier, setEarlier] = (0, react.useState)([]);
	const [more, setMore] = (0, react.useState)(null);
	const [error, setError] = (0, react.useState)("");
	const load = () => call("conversations").then(setData, (e) => setError(e.message));
	(0, react.useEffect)(() => void load(), []);
	const going = data?.conversations.some((conversation) => conversation.messages.some(live));
	(0, react.useEffect)(() => {
		if (!going) return;
		const again = setTimeout(load, 5e3);
		return () => clearTimeout(again);
	}, [data]);
	const shown = [...data?.conversations ?? [], ...earlier];
	const older = async () => {
		const page = await call(`conversations?before=${shown.at(-1).id}`);
		setEarlier((all) => [...all, ...page.conversations]);
		setMore(page.older);
	};
	const stop = (conversation) => call(`conversations/${conversation.id}/stop`, "POST").then(load, (e) => setError(e.message));
	return (0, react_jsx_runtime.jsxs)("div", {
		className: "flex min-h-0 flex-1 flex-col overflow-y-auto",
		children: [(0, react_jsx_runtime.jsx)(_fxbot_app.ui.Header, { title: "Messages" }), (0, react_jsx_runtime.jsxs)("div", {
			className: "w-full gap-6 px-4 pb-6 text-sm",
			style: {
				...column,
				maxWidth: "42rem",
				marginInline: "auto"
			},
			children: [
				(0, react_jsx_runtime.jsx)("p", {
					className: "text-muted-foreground",
					children: bots.length < 2 ? "With two bots or more, they message each other here to get work done, and you can watch it. Make another bot to start." : "Your bots talking to each other. Each message is in both bots' chats."
				}),
				data && !shown.length && bots.length > 1 && (0, react_jsx_runtime.jsx)("p", {
					className: "text-muted-foreground",
					children: "Nothing yet. Ask a bot to ask another."
				}),
				shown.map((conversation) => (0, react_jsx_runtime.jsx)(Thread, {
					conversation,
					most: data.most,
					bots,
					onStop: stop
				}, conversation.id)),
				(more ?? data?.older) && (0, react_jsx_runtime.jsx)(_fxbot_app.ui.Button, {
					type: "button",
					size: "sm",
					variant: "outline",
					className: "justify-self-start",
					onClick: () => older().catch((e) => setError(e.message)),
					children: "Older"
				}),
				error && (0, react_jsx_runtime.jsx)("p", {
					className: "text-destructive",
					children: error
				})
			]
		})]
	});
}
function Sent({ call: tool }) {
	const { to, text } = tool.input ?? {};
	const out = tool.done && tool.output && !/^Sent to /.test(tool.output);
	const id = (/\/profiles\/([0-9a-f]{12})/i.exec(to ?? "")?.[1] ?? to ?? "").toLowerCase();
	const bot = ((0, _fxbot_app.useBots)() ?? []).find((b) => b.id === id);
	return (0, react_jsx_runtime.jsxs)("div", {
		className: "grid gap-1 text-sm",
		children: [
			(0, react_jsx_runtime.jsxs)("p", {
				className: "flex items-center gap-2 font-medium",
				children: [
					(0, react_jsx_runtime.jsx)(Face, { bot }),
					"To ",
					bot?.name ?? named(to) ?? "a bot"
				]
			}),
			text && (0, react_jsx_runtime.jsx)("p", {
				className: "whitespace-pre-wrap",
				style: wraps,
				children: named(text)
			}),
			(0, react_jsx_runtime.jsx)("p", {
				className: out ? "text-destructive" : "text-muted-foreground",
				children: tool.done ? tool.output : "Sending…"
			})
		]
	});
}
function About({ bot }) {
	const [about, setAbout] = (0, react.useState)(null);
	const [saved, setSaved] = (0, react.useState)("");
	const [error, setError] = (0, react.useState)("");
	(0, react.useEffect)(() => void call(`bots/${bot.id}`).then(({ about }) => (setAbout(about), setSaved(about)), (e) => setError(e.message)), [bot.id]);
	if (about === null) return null;
	const save = () => {
		if (about.trim() === saved) return;
		setError("");
		call(`bots/${bot.id}`, "PUT", { about }).then(({ about }) => (setAbout(about), setSaved(about)), (e) => setError(e.message));
	};
	return (0, react_jsx_runtime.jsxs)("section", {
		className: "grid gap-2 text-sm",
		"aria-label": "Messages",
		children: [
			(0, react_jsx_runtime.jsx)("h2", {
				className: "font-medium",
				children: "Messages"
			}),
			(0, react_jsx_runtime.jsxs)("label", {
				className: "grid gap-1.5",
				children: [(0, react_jsx_runtime.jsx)("span", {
					className: "text-muted-foreground",
					children: "What this bot does, for your other bots"
				}), (0, react_jsx_runtime.jsx)(_fxbot_app.ui.Input, {
					value: about,
					maxLength: 120,
					onChange: (e) => setAbout(e.target.value),
					onBlur: save
				})]
			}),
			error && (0, react_jsx_runtime.jsx)("p", {
				className: "text-destructive",
				children: error
			})
		]
	});
}
const named = (text) => text?.replace(tagLink, "@$1");
function Conversations() {
	return (0, react_jsx_runtime.jsxs)("section", {
		className: "grid gap-2 text-sm",
		"aria-label": "Conversations",
		children: [
			(0, react_jsx_runtime.jsx)("h2", {
				className: "font-medium",
				children: "Conversations"
			}),
			(0, react_jsx_runtime.jsx)("p", {
				className: "text-muted-foreground",
				children: "Read what your bots have said to each other, and stop a conversation that's running."
			}),
			(0, react_jsx_runtime.jsx)(_fxbot_app.ui.Button, {
				variant: "outline",
				size: "sm",
				className: "justify-self-start",
				onClick: () => (0, _fxbot_app.go)("/messages"),
				children: "Open conversations"
			})
		]
	});
}
function Tag({ match }) {
	const bot = ((0, _fxbot_app.useBots)() ?? []).find((b) => b.id === match[2]);
	return (0, react_jsx_runtime.jsxs)("span", {
		style: {
			display: "inline-flex",
			alignItems: "center",
			gap: 4,
			padding: "0 6px 0 3px",
			borderRadius: 9999,
			background: "rgb(255 255 255 / 0.2)",
			fontWeight: 500,
			verticalAlign: "bottom"
		},
		children: [
			bot && (0, react_jsx_runtime.jsx)(_fxbot_app.ui.Blob, {
				...bot,
				size: 16
			}),
			"@",
			bot?.name ?? match[1]
		]
	});
}
function setup(app) {
	app.box(Box);
	app.said(tagLink, Tag);
	app.fold({
		message(id) {
			const [, kind, bot] = /^messages-(in|ask|again)-\d+(?:-([0-9a-f]{12}))?$/.exec(id) ?? [];
			return kind ? {
				fold: kind === "in" ? "message" : "turn",
				bot
			} : void 0;
		},
		tool(call) {
			if (call.name !== "messages_send" || call.done && !/^Sent to /.test(call.output ?? "")) return;
			const to = call.input?.to ?? "";
			return {
				bot: (/\/profiles\/([0-9a-f]{12})/i.exec(to)?.[1] ?? (/^[0-9a-f]{12}$/i.test(to) ? to : void 0))?.toLowerCase(),
				name: named(to).replace(/^@/, "")
			};
		}
	});
	app.route("/", Screen);
	app.settings(Conversations);
	app.toolView("send", Sent, { open: true });
	app.botSettings(About);
}
module.exports = setup;
