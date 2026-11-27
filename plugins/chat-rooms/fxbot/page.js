// \0rolldown/runtime.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
let react = require("react");
let _fxbot_app = require("@fxbot/app");
_fxbot_app = __toESM(_fxbot_app, 1);
let prosemirror_model = require("prosemirror-model");
let prosemirror_state = require("prosemirror-state");
let prosemirror_view = require("prosemirror-view");
let react_jsx_runtime = require("react/jsx-runtime");
// fxbot/faces.jsx
function Chip({ id }) {
	const bot = ((0, _fxbot_app.useBots)() ?? []).find((b) => b.id === id);
	if (id === "all") return (0, react_jsx_runtime.jsx)("span", {
		className: "cr-chip",
		children: "@everyone"
	});
	return (0, react_jsx_runtime.jsxs)("span", {
		className: "cr-chip",
		children: [
			bot && (0, react_jsx_runtime.jsx)("span", {
				className: "cr-chip-face",
				"aria-hidden": "true",
				children: (0, react_jsx_runtime.jsx)(_fxbot_app.ui.Blob, {
					...bot,
					size: 16
				})
			}),
			"@",
			bot?.name ?? "a bot that's gone"
		]
	});
}
function Stack({ ids, size = 18, busy }) {
	const all = (0, _fxbot_app.useBots)() ?? [];
	const bots = ids.map((id) => all.find((b) => b.id === id)).filter(Boolean);
	const shown = bots.length > 4 ? bots.slice(0, 3) : bots;
	return (0, react_jsx_runtime.jsxs)("span", {
		className: "cr-stack",
		"aria-hidden": "true",
		style: { "--cr-size": `${size}px` },
		children: [shown.map((bot) => (0, react_jsx_runtime.jsx)("span", { children: (0, react_jsx_runtime.jsx)(_fxbot_app.ui.Blob, {
			...bot,
			size,
			busy: bot.busy || bot.id === busy
		}) }, bot.id)), bots.length > 4 && (0, react_jsx_runtime.jsxs)("span", {
			className: "cr-more",
			children: ["+", bots.length - 3]
		})]
	});
}
// fxbot/mentions.ts
const all = "<@all>";
const tokenOf = (bot) => `<@bot:${bot}>`;
const tokens = /<@(?:bot:([0-9a-f]{12})|all)>/g;
// fxbot/composer.jsx
const { formatting: formatting$1 } = _fxbot_app;
const schema = new prosemirror_model.Schema({
	nodes: {
		...formatting$1.nodes,
		mention: {
			attrs: { bot: {} },
			group: "inline",
			inline: true,
			atom: true,
			selectable: false,
			marks: "strong em strike",
			parseDOM: [{
				tag: "span[data-bot]",
				getAttrs: (dom) => ({ bot: dom.getAttribute("data-bot") })
			}],
			toDOM: (node) => ["span", { "data-bot": node.attrs.bot }]
		}
	},
	marks: formatting$1.marks
});
const chips$1 = {
	type: "mention",
	pattern: tokens,
	write: (node) => node.attrs.bot === "all" ? all : tokenOf(node.attrs.bot),
	read: (m) => schema.nodes.mention.create({ bot: m[1] ?? "all" })
};
const textOf = (doc) => formatting$1.toMarkdown(doc, chips$1).trim();
const docOf = (text) => formatting$1.fromMarkdown(text, schema, chips$1);
const commands = [{
	id: "/fresh",
	name: "/fresh",
	description: "Start the room over toward what you write next",
	command: true
}];
const fresh = (doc) => prosemirror_state.EditorState.create({
	schema,
	doc,
	plugins: formatting$1.plugins(schema, chips$1)
});
function typing(state) {
	const { $from, empty } = state.selection;
	if (!empty || $from.parent.type.spec.code) return null;
	const before = $from.parent.textBetween(0, $from.parentOffset, null, "￼");
	const command = state.doc.firstChild === $from.parent && /^\/([a-z]{0,10})$/.exec(before);
	if (command) return {
		from: $from.pos - command[0].length,
		to: $from.pos,
		query: command[1],
		command: true
	};
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
	]).filter(([n]) => n < 9).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(([, , c]) => c);
}
function Composer({ bots, placeholder, disabled, onSend, submitRef, onEmpty }) {
	const box = (0, react.useRef)(null);
	const view = (0, react.useRef)(null);
	const [made, setMade] = (0, react.useState)(null);
	const choices = (0, react.useRef)([]);
	choices.current = [...bots.map((bot) => ({
		id: bot.id,
		name: bot.name,
		bot
	})), ...bots.length > 1 ? [{
		id: "all",
		name: "Everyone"
	}] : []];
	const send = (0, react.useRef)(onSend);
	send.current = onSend;
	const [chips, setChips] = (0, react.useState)(() => new Map());
	const [list, setList] = (0, react.useState)(null);
	const shown = (0, react.useRef)(null);
	shown.current = list;
	const dismissed = (0, react.useRef)(-1);
	const [empty, setEmpty] = (0, react.useState)(true);
	const [said, setSaid] = (0, react.useState)("");
	const told = (0, react.useRef)(onEmpty);
	told.current = onEmpty;
	(0, react.useEffect)(() => told.current?.(empty), [empty]);
	function refresh(state) {
		setEmpty(formatting$1.isEmpty(state.doc));
		const at = typing(state);
		if (!at || at.from !== dismissed.current) dismissed.current = -1;
		const matches = !at || at.from === dismissed.current ? [] : at.command ? commands.filter((c) => c.name.startsWith(`/${at.query}`)) : rank(choices.current, at.query);
		const next = matches.length ? {
			...at,
			matches,
			active: shown.current && shown.current.from === at.from && shown.current.query === at.query ? shown.current.active : 0
		} : null;
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
		v.dispatch(tr.setSelection(prosemirror_state.TextSelection.create(tr.doc, at.from + 2)));
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
				setList({
					...at,
					active: (at.active + by + at.matches.length) % at.matches.length
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
		if (event.key === "Enter" && !event.shiftKey && !formatting$1.ownsKey(view.current.state, event)) {
			submit();
			return true;
		}
		return false;
	}
	(0, react.useEffect)(() => {
		const nameOf = (id) => id === "all" ? "everyone" : choices.current.find((c) => c.id === id)?.name ?? "a bot that's gone";
		const chip = (node) => {
			const dom = document.createElement("span");
			dom.dataset.bot = node.attrs.bot;
			dom.contentEditable = "false";
			if (_fxbot_app.createPortal) setChips((now) => new Map(now).set(dom, node.attrs.bot));
			else dom.className = "cr-chip", dom.textContent = `@${nameOf(node.attrs.bot)}`;
			return {
				dom,
				ignoreMutation: () => true,
				destroy: () => _fxbot_app.createPortal && setChips((now) => {
					const next = new Map(now);
					next.delete(dom);
					return next;
				})
			};
		};
		const v = new prosemirror_view.EditorView(box.current, {
			state: fresh(),
			nodeViews: { mention: chip },
			attributes: {
				role: "textbox",
				"aria-multiline": "true",
				"aria-label": "Message the room",
				"aria-autocomplete": "list",
				autocorrect: "on",
				autocapitalize: "sentences",
				spellcheck: "true",
				class: "cr-editor fx-formatted"
			},
			handleKeyDown: (_view, event) => key(event),
			dispatchTransaction(tr) {
				v.updateState(v.state.apply(tr));
				refresh(v.state);
			}
		});
		view.current = v;
		setMade(v);
		return () => (setMade(null), v.destroy());
	}, []);
	(0, react.useEffect)(() => void view.current?.setProps({ editable: () => !disabled }), [disabled]);
	(0, react.useEffect)(() => {
		const dom = view.current?.dom;
		if (!dom) return;
		if (list) dom.setAttribute("aria-controls", "cr-mentions"), dom.setAttribute("aria-activedescendant", `cr-mention-${list.active}`);
		else dom.removeAttribute("aria-controls"), dom.removeAttribute("aria-activedescendant");
	}, [list]);
	return (0, react_jsx_runtime.jsxs)("div", {
		className: "cr-box",
		children: [
			(0, react_jsx_runtime.jsx)(_fxbot_app.ui.FormatBar, {
				view: made,
				className: "pb-1"
			}),
			list && (0, react_jsx_runtime.jsx)("div", {
				id: "cr-mentions",
				role: "listbox",
				"aria-label": list.command ? "Commands" : "Bots",
				className: "absolute right-0 bottom-full left-0 z-10 mb-2 max-h-72 overflow-y-auto rounded-2xl border bg-popover p-1 text-popover-foreground shadow-md",
				children: list.matches.map((choice, i) => (0, react_jsx_runtime.jsxs)("button", {
					id: `cr-mention-${i}`,
					type: "button",
					role: "option",
					"aria-selected": i === list.active,
					onMouseDown: (e) => e.preventDefault(),
					onClick: () => pick(choice),
					className: `flex w-full min-w-0 items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm ${i === list.active ? "bg-accent text-accent-foreground" : ""}`,
					children: [
						choice.command ? null : choice.bot ? (0, react_jsx_runtime.jsx)(_fxbot_app.ui.Blob, {
							...choice.bot,
							size: 24
						}) : (0, react_jsx_runtime.jsx)(Stack, {
							ids: bots.map((bot) => bot.id),
							size: 16
						}),
						(0, react_jsx_runtime.jsx)("span", {
							className: choice.command ? "shrink-0 font-medium" : "min-w-0 flex-1 truncate font-medium",
							children: choice.name
						}),
						choice.command && (0, react_jsx_runtime.jsx)("span", {
							className: "min-w-0 flex-1 truncate text-muted-foreground",
							children: choice.description
						})
					]
				}, choice.id))
			}),
			(0, react_jsx_runtime.jsxs)("div", {
				className: "relative",
				children: [(0, react_jsx_runtime.jsx)("div", { ref: box }), empty && (0, react_jsx_runtime.jsx)("span", {
					className: "cr-placeholder",
					"aria-hidden": "true",
					children: placeholder
				})]
			}),
			(0, react_jsx_runtime.jsx)("div", {
				"aria-live": "polite",
				className: "sr-only",
				children: said
			}),
			_fxbot_app.createPortal && [...chips].map(([dom, id]) => _fxbot_app.createPortal((0, react_jsx_runtime.jsx)(Chip, { id }), dom, `${id}-${[...chips.keys()].indexOf(dom)}`))
		]
	});
}
// fxbot/page.jsx
const pathOf = (room) => `/chat-rooms/rooms/${room.id}`;
const useReorder = _fxbot_app.ui.useReorder ?? (() => ({
	list: void 0,
	item: () => ({}),
	cancel() {}
}));
let rooms = null;
const writing = new Map();
const listeners = new Set();
const tell = () => listeners.forEach((listen) => listen());
async function reload() {
	const res = await (0, _fxbot_app.api)("/rooms").catch(() => null);
	rooms = res?.ok ? await res.json() : rooms ?? [];
	for (const room of rooms) room.writing ? writing.set(room.id, room.writing) : writing.delete(room.id);
	tell();
}
function writes(room, bot) {
	if ((writing.get(room) ?? null) === bot) return;
	bot ? writing.set(room, bot) : writing.delete(room);
	tell();
}
function useRooms() {
	const [, bump] = (0, react.useState)(0);
	(0, react.useEffect)(() => {
		const listen = () => bump((n) => n + 1);
		listeners.add(listen);
		if (rooms === null) reload();
		return () => void listeners.delete(listen);
	}, []);
	return rooms;
}
async function call(path, method, body) {
	const res = await (0, _fxbot_app.api)(path, {
		method,
		headers: { "content-type": "application/json" },
		body: body === void 0 ? void 0 : JSON.stringify(body)
	});
	const answer = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(answer.error ?? `HTTP ${res.status}`);
	return answer;
}
function useRoomBots() {
	const bots = (0, _fxbot_app.useBots)() ?? [];
	const [on, setOn] = (0, react.useState)(null);
	(0, react.useEffect)(() => {
		_fxbot_app.client.plugins.list().then((list) => {
			const mine = list.find((p) => p.name === "chat-rooms");
			setOn(mine && mine.bots !== "all" ? new Set(mine.on ?? []) : null);
		}, () => {});
	}, []);
	return on ? bots.filter((bot) => on.has(bot.id)) : bots;
}
const Plus = () => (0, react_jsx_runtime.jsx)("svg", {
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: "2",
	strokeLinecap: "round",
	"aria-hidden": "true",
	children: (0, react_jsx_runtime.jsx)("path", { d: "M12 5v14M5 12h14" })
});
function BotPicker({ chosen, onChange }) {
	const bots = useRoomBots();
	const toggle = (id, on) => onChange(on ? [...chosen, id] : chosen.filter((bot) => bot !== id));
	return (0, react_jsx_runtime.jsxs)("div", {
		className: "grid gap-2",
		children: [bots.map((bot) => (0, react_jsx_runtime.jsxs)("label", {
			className: "flex items-center gap-3 text-sm",
			children: [
				(0, react_jsx_runtime.jsx)(_fxbot_app.ui.Checkbox, {
					checked: chosen.includes(bot.id),
					onCheckedChange: (on) => toggle(bot.id, on === true)
				}),
				(0, react_jsx_runtime.jsx)(_fxbot_app.ui.Blob, {
					...bot,
					size: 24
				}),
				(0, react_jsx_runtime.jsx)("span", {
					className: "min-w-0 flex-1 truncate",
					children: bot.name
				}),
				chosen[0] === bot.id ? (0, react_jsx_runtime.jsx)("span", {
					className: "text-xs text-muted-foreground",
					children: "Leads"
				}) : chosen.includes(bot.id) && (0, react_jsx_runtime.jsx)("span", {
					className: "text-xs text-muted-foreground tabular-nums",
					children: chosen.indexOf(bot.id) + 1
				})
			]
		}, bot.id)), !bots.length && (0, react_jsx_runtime.jsx)("p", {
			className: "text-sm text-muted-foreground",
			children: "No bot has chat rooms on. Make a bot, or switch chat rooms on for one in Plugins."
		})]
	});
}
function NewRoom({ onClose }) {
	const [name, setName] = (0, react.useState)("");
	const [chosen, setChosen] = (0, react.useState)([]);
	const [error, setError] = (0, react.useState)("");
	const create = (event) => {
		event.preventDefault();
		call("/rooms", "POST", {
			name,
			bots: chosen
		}).then((room) => (reload(), onClose(), (0, _fxbot_app.go)(pathOf(room))), (e) => setError(e.message));
	};
	return (0, react_jsx_runtime.jsx)(_fxbot_app.ui.Dialog, {
		open: true,
		onOpenChange: (open) => !open && onClose(),
		children: (0, react_jsx_runtime.jsxs)(_fxbot_app.ui.DialogContent, { children: [(0, react_jsx_runtime.jsxs)(_fxbot_app.ui.DialogHeader, { children: [(0, react_jsx_runtime.jsx)(_fxbot_app.ui.DialogTitle, { children: "New room" }), (0, react_jsx_runtime.jsx)(_fxbot_app.ui.DialogDescription, { children: "Tag a bot with @ to ask it. The first bot you pick leads: it answers when you tag no one." })] }), (0, react_jsx_runtime.jsxs)("form", {
			onSubmit: create,
			className: "grid gap-4",
			children: [
				(0, react_jsx_runtime.jsxs)("label", {
					className: "grid gap-1.5 text-sm font-medium",
					children: ["Name", (0, react_jsx_runtime.jsx)(_fxbot_app.ui.Input, {
						value: name,
						onChange: (e) => setName(e.target.value),
						autoFocus: true,
						maxLength: 80
					})]
				}),
				(0, react_jsx_runtime.jsx)(BotPicker, {
					chosen,
					onChange: setChosen
				}),
				error && (0, react_jsx_runtime.jsx)("p", {
					className: "text-sm text-destructive",
					children: error
				}),
				(0, react_jsx_runtime.jsx)(_fxbot_app.ui.DialogFooter, { children: (0, react_jsx_runtime.jsx)(_fxbot_app.ui.Button, {
					type: "submit",
					disabled: !name.trim() || !chosen.length,
					children: "Make the room"
				}) })
			]
		})] })
	});
}
function RoomsGroup() {
	const list = useRooms();
	const bots = (0, _fxbot_app.useBots)() ?? [];
	const [making, setMaking] = (0, react.useState)(false);
	const { setOpenMobile } = _fxbot_app.ui.useSidebar();
	const open = (event, room) => {
		if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
		event.preventDefault();
		setOpenMobile(false);
		(0, _fxbot_app.go)(pathOf(room));
	};
	const who = (room) => room.members.map((id) => bots.find((bot) => bot.id === id)?.name ?? "a bot that's gone").join(", ");
	const rows = useReorder((ids) => {
		rooms = ids.map((id) => list.find((room) => String(room.id) === id)).filter(Boolean);
		tell();
		call("/order", "PUT", { ids: ids.map(Number) }).then(reload, reload);
	});
	return (0, react_jsx_runtime.jsxs)(_fxbot_app.ui.SidebarGroup, { children: [
		(0, react_jsx_runtime.jsx)(_fxbot_app.ui.SidebarGroupLabel, { children: "Rooms" }),
		(0, react_jsx_runtime.jsx)(_fxbot_app.ui.SidebarGroupAction, {
			title: "New room",
			"aria-label": "New room",
			onClick: () => setMaking(true),
			children: (0, react_jsx_runtime.jsx)(Plus, {})
		}),
		(0, react_jsx_runtime.jsx)(_fxbot_app.ui.SidebarMenu, {
			ref: rows.list,
			children: list?.map((room) => (0, react_jsx_runtime.jsx)(_fxbot_app.ui.SidebarMenuItem, {
				...rows.item(String(room.id)),
				className: "rounded-md select-none data-lifted:bg-sidebar-accent data-lifted:shadow-md",
				children: (0, react_jsx_runtime.jsx)(_fxbot_app.ui.SidebarMenuButton, {
					asChild: true,
					isActive: location.pathname === pathOf(room),
					children: (0, react_jsx_runtime.jsxs)("a", {
						href: pathOf(room),
						title: who(room),
						onClick: (event) => open(event, room),
						children: [(0, react_jsx_runtime.jsx)(Stack, {
							ids: room.members,
							busy: writing.get(room.id)
						}), (0, react_jsx_runtime.jsx)("span", {
							className: "truncate",
							children: room.name
						})]
					})
				})
			}, room.id))
		}),
		list?.length === 0 && (0, react_jsx_runtime.jsx)("p", {
			className: "px-2 text-xs text-muted-foreground",
			children: "Talk with several bots at once."
		}),
		making && (0, react_jsx_runtime.jsx)(NewRoom, { onClose: () => setMaking(false) })
	] });
}
function EditRoom({ room, onClose }) {
	const [name, setName] = (0, react.useState)(room.name);
	const [chosen, setChosen] = (0, react.useState)(room.members);
	const [untagged, setUntagged] = (0, react.useState)(room.untagged);
	const [replies, setReplies] = (0, react.useState)(String(room.replies));
	const [error, setError] = (0, react.useState)("");
	const save = (event) => {
		event.preventDefault();
		call(`/rooms/${room.id}`, "PUT", {
			name,
			bots: chosen,
			untagged,
			replies: Number(replies)
		}).then(() => (reload(), onClose()), (e) => setError(e.message));
	};
	const remove = () => confirm(`Delete ${room.name} and what was said in it?`) && call(`/rooms/${room.id}`, "DELETE").then(() => (reload(), onClose(), (0, _fxbot_app.go)("/")), (e) => setError(e.message));
	const option = (value, label, detail) => (0, react_jsx_runtime.jsxs)("label", {
		className: "flex items-start gap-2.5 text-sm",
		children: [(0, react_jsx_runtime.jsx)("input", {
			type: "radio",
			name: "untagged",
			className: "mt-1",
			checked: untagged === value,
			onChange: () => setUntagged(value)
		}), (0, react_jsx_runtime.jsxs)("span", {
			className: "grid gap-0.5",
			children: [(0, react_jsx_runtime.jsx)("span", {
				className: "font-medium",
				children: label
			}), (0, react_jsx_runtime.jsx)("span", {
				className: "text-muted-foreground",
				children: detail
			})]
		})]
	});
	return (0, react_jsx_runtime.jsx)(_fxbot_app.ui.Dialog, {
		open: true,
		onOpenChange: (open) => !open && onClose(),
		children: (0, react_jsx_runtime.jsxs)(_fxbot_app.ui.DialogContent, { children: [(0, react_jsx_runtime.jsxs)(_fxbot_app.ui.DialogHeader, { children: [(0, react_jsx_runtime.jsx)(_fxbot_app.ui.DialogTitle, { children: room.name }), (0, react_jsx_runtime.jsx)(_fxbot_app.ui.DialogDescription, { children: "Who's in the room, and how its bots answer." })] }), (0, react_jsx_runtime.jsxs)("form", {
			onSubmit: save,
			className: "grid max-h-[70dvh] gap-4 overflow-y-auto",
			children: [
				(0, react_jsx_runtime.jsxs)("label", {
					className: "grid gap-1.5 text-sm font-medium",
					children: ["Name", (0, react_jsx_runtime.jsx)(_fxbot_app.ui.Input, {
						value: name,
						onChange: (e) => setName(e.target.value),
						maxLength: 80
					})]
				}),
				(0, react_jsx_runtime.jsx)(BotPicker, {
					chosen,
					onChange: setChosen
				}),
				(0, react_jsx_runtime.jsxs)("fieldset", {
					className: "grid gap-2",
					children: [
						(0, react_jsx_runtime.jsx)("legend", {
							className: "mb-1 text-sm font-medium",
							children: "When you tag no one"
						}),
						option("lead", "The lead answers", "The first bot answers, and can bring others in by tagging them."),
						option("everyone", "Everyone answers", "Every bot answers, in order.")
					]
				}),
				(0, react_jsx_runtime.jsxs)("label", {
					className: "grid gap-1.5 text-sm font-medium",
					children: [
						"Bot replies per message",
						(0, react_jsx_runtime.jsx)(_fxbot_app.ui.Input, {
							type: "number",
							min: 1,
							max: 30,
							value: replies,
							onChange: (e) => setReplies(e.target.value),
							className: "w-24"
						}),
						(0, react_jsx_runtime.jsx)("span", {
							className: "font-normal text-muted-foreground",
							children: "Bots stop tagging each other after this many replies, until you tag one."
						})
					]
				}),
				error && (0, react_jsx_runtime.jsx)("p", {
					className: "text-sm text-destructive",
					children: error
				}),
				(0, react_jsx_runtime.jsxs)(_fxbot_app.ui.DialogFooter, {
					className: "gap-2",
					children: [(0, react_jsx_runtime.jsx)(_fxbot_app.ui.Button, {
						type: "button",
						variant: "ghost",
						className: "text-destructive",
						onClick: remove,
						children: "Delete room"
					}), (0, react_jsx_runtime.jsx)(_fxbot_app.ui.Button, {
						type: "submit",
						disabled: !name.trim() || !chosen.length,
						children: "Save"
					})]
				})
			]
		})] })
	});
}
function RoomMemories({ room, onClose }) {
	const bots = (0, _fxbot_app.useBots)() ?? [];
	const [memories, setMemories] = (0, react.useState)(null);
	const [draft, setDraft] = (0, react.useState)("");
	const [editing, setEditing] = (0, react.useState)(null);
	const [error, setError] = (0, react.useState)("");
	const read = () => call(`/rooms/${room.id}/memories`, "GET").then(setMemories, (e) => setError(e.message));
	(0, react.useEffect)(() => void read(), [room.id]);
	const act = (run) => run().then(() => (setError(""), read()), (e) => setError(e.message));
	const add = (event) => {
		event.preventDefault();
		act(() => call(`/rooms/${room.id}/memories`, "POST", { text: draft }).then(() => setDraft("")));
	};
	const save = () => act(() => call(`/rooms/${room.id}/memories/${editing.id}`, "PATCH", { text: editing.text }).then(() => setEditing(null)));
	const remove = (memory) => confirm(`Delete this memory? The bots in ${room.name} won't know it any more.`) && act(() => call(`/rooms/${room.id}/memories/${memory.id}`, "DELETE"));
	const by = (memory) => memory.by === "owner" ? "Added by you" : `Saved by ${bots.find((bot) => bot.id === memory.by)?.name ?? "a removed bot"}`;
	const day = (at) => new Date(at).toLocaleDateString(void 0, {
		year: "numeric",
		month: "short",
		day: "numeric"
	});
	return (0, react_jsx_runtime.jsx)(_fxbot_app.ui.Dialog, {
		open: true,
		onOpenChange: (open) => !open && onClose(),
		children: (0, react_jsx_runtime.jsxs)(_fxbot_app.ui.DialogContent, { children: [(0, react_jsx_runtime.jsxs)(_fxbot_app.ui.DialogHeader, { children: [(0, react_jsx_runtime.jsx)(_fxbot_app.ui.DialogTitle, { children: "Memories" }), (0, react_jsx_runtime.jsxs)(_fxbot_app.ui.DialogDescription, { children: [
			"Every bot in ",
			room.name,
			" reads these here: what the room is for, what was decided, and who does what. Bots save them too."
		] })] }), (0, react_jsx_runtime.jsxs)("div", {
			className: "grid max-h-[70dvh] gap-3 overflow-y-auto",
			children: [
				(0, react_jsx_runtime.jsxs)("form", {
					onSubmit: add,
					className: "grid gap-2",
					children: [(0, react_jsx_runtime.jsx)(_fxbot_app.ui.Textarea, {
						"aria-label": "Add a memory",
						placeholder: "Something this room's bots should remember",
						value: draft,
						maxLength: 1e3,
						onChange: (e) => setDraft(e.target.value),
						className: "min-h-16"
					}), (0, react_jsx_runtime.jsx)(_fxbot_app.ui.Button, {
						type: "submit",
						size: "sm",
						className: "justify-self-start",
						disabled: !draft.trim(),
						children: "Add a memory"
					})]
				}),
				error && (0, react_jsx_runtime.jsx)("p", {
					className: "text-sm text-destructive",
					children: error
				}),
				!memories ? (0, react_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted-foreground",
					children: "Loading…"
				}) : !memories.length ? (0, react_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted-foreground",
					children: "Nothing yet. Add what this room's bots should know, or ask one to remember something for the room."
				}) : (0, react_jsx_runtime.jsx)("ul", {
					className: "grid gap-2",
					"aria-label": "Room memories",
					children: memories.map((memory) => editing?.id === memory.id ? (0, react_jsx_runtime.jsxs)("li", {
						className: "grid gap-2 rounded-lg border p-2.5",
						children: [(0, react_jsx_runtime.jsx)(_fxbot_app.ui.Textarea, {
							"aria-label": "Memory",
							value: editing.text,
							maxLength: 1e3,
							onChange: (e) => setEditing({
								...editing,
								text: e.target.value
							}),
							className: "min-h-20",
							autoFocus: true
						}), (0, react_jsx_runtime.jsxs)("div", {
							className: "flex gap-2",
							children: [(0, react_jsx_runtime.jsx)(_fxbot_app.ui.Button, {
								size: "sm",
								onClick: save,
								disabled: !editing.text.trim() || editing.text === memory.text,
								children: "Save"
							}), (0, react_jsx_runtime.jsx)(_fxbot_app.ui.Button, {
								size: "sm",
								variant: "outline",
								onClick: () => setEditing(null),
								children: "Cancel"
							})]
						})]
					}, memory.id) : (0, react_jsx_runtime.jsxs)("li", {
						className: "grid gap-1 rounded-lg border p-2.5 text-sm",
						children: [(0, react_jsx_runtime.jsx)("p", {
							className: "whitespace-pre-line break-words",
							children: memory.text
						}), (0, react_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-1 text-xs text-muted-foreground",
							children: [
								(0, react_jsx_runtime.jsxs)("span", {
									className: "flex-1",
									children: [
										day(memory.at),
										" · ",
										by(memory)
									]
								}),
								(0, react_jsx_runtime.jsx)(_fxbot_app.ui.Button, {
									variant: "ghost",
									size: "sm",
									onClick: () => setEditing({
										id: memory.id,
										text: memory.text
									}),
									children: "Edit"
								}),
								(0, react_jsx_runtime.jsx)(_fxbot_app.ui.Button, {
									variant: "ghost",
									size: "sm",
									className: "text-destructive",
									onClick: () => remove(memory),
									children: "Delete"
								})
							]
						})]
					}, memory.id))
				})
			]
		})] })
	});
}
function useRoom(id) {
	const [state, setState] = (0, react.useState)(null);
	const [error, setError] = (0, react.useState)("");
	(0, react.useEffect)(() => {
		const stop = new AbortController();
		const apply = (event) => {
			if (event.type === "room") writes(id, event.replying?.bot ?? null);
			if (event.type === "reply") writes(id, event.bot);
			if (event.type === "idle" || event.type === "message" && writing.get(id) === event.message.author) writes(id, null);
			setState((now) => {
				if (event.type === "room") return {
					room: event.room,
					messages: event.messages,
					replying: event.replying,
					queue: event.queue ?? [],
					starting: event.starting === true
				};
				if (!now) return now;
				if (event.type === "message") {
					const messages = now.messages.some((m) => m.id === event.message.id) ? now.messages : [...now.messages, event.message];
					return {
						...now,
						messages,
						replying: now.replying?.bot === event.message.author ? null : now.replying
					};
				}
				if (event.type === "reply") return {
					...now,
					replying: {
						bot: event.bot,
						text: event.text
					}
				};
				if (event.type === "queue") return {
					...now,
					queue: event.bots
				};
				if (event.type === "starting") return {
					...now,
					starting: event.on
				};
				if (event.type === "idle") return {
					...now,
					replying: null,
					queue: []
				};
				return now;
			});
		};
		(async () => {
			while (!stop.signal.aborted) {
				try {
					const res = await (0, _fxbot_app.api)(`/rooms/${id}/stream`, { signal: stop.signal });
					if (!res.ok) {
						setError((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
						return;
					}
					setError("");
					const reader = res.body.getReader();
					const decoder = new TextDecoder();
					let rest = "";
					for (;;) {
						const { value, done } = await reader.read();
						if (done) break;
						const parts = (rest + decoder.decode(value, { stream: true })).split("\n");
						rest = parts.pop();
						for (const part of parts) if (part) apply(JSON.parse(part));
					}
				} catch {
					if (stop.signal.aborted) return;
				}
				await new Promise((resolve) => setTimeout(resolve, 2e3));
			}
		})();
		return () => stop.abort();
	}, [id]);
	return {
		state,
		error
	};
}
const code = /(```[\s\S]*?(?:```|$)|`[^`\n]*`)/;
const tagged = (text) => text.split(code).map((part, i) => i % 2 ? part : part.replace(tokens, (_, bot) => `<mention bot="${bot ?? "all"}"></mention>`)).join("");
const chips = { mention: ({ bot }) => (0, react_jsx_runtime.jsx)(Chip, { id: bot }) };
const Owned = ({ text }) => (0, react_jsx_runtime.jsx)(_fxbot_app.ui.Streamdown, {
	mode: "static",
	parseIncompleteMarkdown: false,
	allowedTags: { mention: ["bot"] },
	components: chips,
	children: tagged(_fxbot_app.formatting.breaks(text))
});
const Markdown = ({ text }) => (0, react_jsx_runtime.jsx)(_fxbot_app.ui.Streamdown, {
	allowedTags: { mention: ["bot"] },
	components: chips,
	children: tagged(text)
});
function Summary({ text }) {
	const [first, ...rest] = text.split("\n\n");
	const idle = /summarized after \d+ minutes idle:$/.test(first);
	const settings = (e) => (e.preventDefault(), (0, _fxbot_app.go)("/settings"));
	return (0, react_jsx_runtime.jsxs)("details", {
		className: "w-full rounded-xl border px-3 py-2 text-sm",
		children: [(0, react_jsx_runtime.jsxs)("summary", {
			className: "cursor-pointer font-medium",
			children: [idle ? "Compacted while idle" : "Started over", idle && (0, react_jsx_runtime.jsxs)("span", {
				className: "pl-2 text-xs font-normal text-muted-foreground",
				children: [
					"Turn off in",
					" ",
					(0, react_jsx_runtime.jsx)("a", {
						href: "/settings",
						onClick: settings,
						className: "underline underline-offset-4",
						children: "Settings"
					})
				]
			})]
		}), (0, react_jsx_runtime.jsx)("p", {
			className: "pt-2 whitespace-pre-wrap text-muted-foreground",
			children: rest.join("\n\n")
		})]
	});
}
function Pill({ message }) {
	const [open, setOpen] = (0, react.useState)(false);
	return (0, react_jsx_runtime.jsxs)("div", {
		className: "grid gap-3",
		children: [(0, react_jsx_runtime.jsxs)("button", {
			type: "button",
			"aria-expanded": message.open ? void 0 : open,
			onClick: () => message.open ? (0, _fxbot_app.openBeside)(message.open) : setOpen(!open),
			className: "mx-auto flex max-w-full items-center gap-1.5 rounded-full border bg-muted px-3 py-1 text-xs text-muted-foreground hover:text-foreground",
			children: [(0, react_jsx_runtime.jsx)("span", {
				className: "min-w-0 truncate",
				children: message.label
			}), (0, react_jsx_runtime.jsx)("span", {
				"aria-hidden": "true",
				children: "›"
			})]
		}), !message.open && open && message.text && (0, react_jsx_runtime.jsx)("p", {
			className: "mx-auto max-w-prose text-sm whitespace-pre-wrap text-muted-foreground",
			children: message.text
		})]
	});
}
function Said({ message, bot }) {
	if (message.author === "note") return (0, react_jsx_runtime.jsx)("p", {
		className: "text-center text-xs text-muted-foreground",
		children: message.text
	});
	if (message.author === "pill") return (0, react_jsx_runtime.jsx)(Pill, { message });
	if (message.author === "summary") return (0, react_jsx_runtime.jsx)(Summary, { text: message.text });
	if (message.author === "owner") return (0, react_jsx_runtime.jsxs)("div", {
		className: "grid justify-items-end gap-1",
		children: [message.label && (0, react_jsx_runtime.jsxs)("span", {
			className: "text-xs text-muted-foreground",
			children: ["From ", message.label]
		}), (0, react_jsx_runtime.jsx)(_fxbot_app.ui.Bubble, {
			align: "end",
			variant: "muted",
			children: (0, react_jsx_runtime.jsx)(_fxbot_app.ui.BubbleContent, {
				className: "said-md",
				children: (0, react_jsx_runtime.jsx)(Owned, { text: message.text })
			})
		})]
	});
	if (message.author === "plugin") return (0, react_jsx_runtime.jsxs)("div", {
		className: "grid min-w-0 grid-cols-1 gap-1 rounded-xl border p-3 wrap-break-word",
		children: [(0, react_jsx_runtime.jsx)("span", {
			className: "text-sm font-medium",
			children: message.label ?? "A plugin"
		}), (0, react_jsx_runtime.jsx)(Markdown, { text: message.text })]
	});
	return (0, react_jsx_runtime.jsxs)("div", {
		className: "flex items-start gap-3",
		children: [bot ? (0, react_jsx_runtime.jsx)(_fxbot_app.ui.Blob, {
			...bot,
			size: 28,
			className: "shrink-0"
		}) : null, (0, react_jsx_runtime.jsxs)("div", {
			className: "grid min-w-0 flex-1 grid-cols-1 gap-1 wrap-break-word",
			children: [(0, react_jsx_runtime.jsx)("span", {
				className: "text-sm font-medium",
				children: bot?.name ?? "A bot that's gone"
			}), (0, react_jsx_runtime.jsx)(Markdown, { text: message.text })]
		})]
	});
}
function RoomScreen({ params }) {
	const id = Number(params.id);
	const bots = (0, _fxbot_app.useBots)() ?? [];
	const botOf = (id) => bots.find((bot) => bot.id === id);
	const { state, error } = useRoom(id);
	const [problem, setProblem] = (0, react.useState)("");
	const [editing, setEditing] = (0, react.useState)(false);
	const [remembering, setRemembering] = (0, react.useState)(false);
	const [empty, setEmpty] = (0, react.useState)(true);
	const submit = (0, react.useRef)(null);
	const end = (0, react.useRef)(null);
	(0, react.useEffect)(() => {
		end.current?.scrollIntoView({ block: "end" });
	}, [state?.messages.length, state?.replying?.text]);
	const room = state?.room;
	const members = (room?.members ?? []).map(botOf).filter(Boolean);
	const send = (text) => call(`/rooms/${id}/messages`, "POST", { text }).then(() => setProblem(""), (e) => {
		setProblem(e.message);
		throw e;
	});
	const stop = () => call(`/rooms/${id}/stop`, "POST").catch((e) => setProblem(e.message));
	const writer = state?.replying && botOf(state.replying.bot);
	const next = (state?.queue ?? []).map((bot) => botOf(bot)?.name ?? "a bot that's gone");
	const busy = Boolean(state?.replying || next.length);
	const lead = members[0];
	return (0, react_jsx_runtime.jsxs)("div", {
		className: "flex h-full min-h-0 flex-col",
		children: [
			(0, react_jsx_runtime.jsx)(_fxbot_app.ui.Header, {
				title: room?.name ?? "Room",
				children: room && (0, react_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-1",
					children: [
						room.members.map((member) => {
							const bot = botOf(member);
							return bot ? (0, react_jsx_runtime.jsx)(_fxbot_app.ui.Blob, {
								...bot,
								size: 24,
								busy: state.replying?.bot === member
							}, member) : null;
						}),
						_fxbot_app.Slot && (0, react_jsx_runtime.jsx)(_fxbot_app.Slot, {
							name: "chat-rooms.room-header",
							props: { room }
						}),
						(0, react_jsx_runtime.jsx)(_fxbot_app.ui.Button, {
							variant: "ghost",
							size: "sm",
							onClick: () => setRemembering(true),
							children: "Memories"
						}),
						(0, react_jsx_runtime.jsx)(_fxbot_app.ui.Button, {
							variant: "ghost",
							size: "sm",
							onClick: () => setEditing(true),
							children: "Edit"
						})
					]
				})
			}),
			(0, react_jsx_runtime.jsx)("main", {
				className: "min-h-0 flex-1 overflow-y-auto",
				children: (0, react_jsx_runtime.jsxs)("div", {
					className: "mx-auto grid w-full max-w-3xl grid-cols-1 gap-5 px-4 py-4",
					children: [
						error && (0, react_jsx_runtime.jsx)("p", {
							className: "text-sm text-destructive",
							children: error
						}),
						state?.messages.length === 0 && (0, react_jsx_runtime.jsx)("p", {
							className: "text-center text-sm text-muted-foreground",
							children: room?.untagged === "everyone" || !lead ? "Tag a bot with @, or say something, and each bot answers in turn." : `Tag a bot with @, or say something, and ${lead.name} answers.`
						}),
						state?.messages.map((message) => (0, react_jsx_runtime.jsx)(Said, {
							message,
							bot: botOf(message.author)
						}, message.id)),
						state?.starting && (0, react_jsx_runtime.jsx)("p", {
							className: "animate-pulse text-center text-xs text-muted-foreground",
							children: "Starting the room over…"
						}),
						state?.replying && (0, react_jsx_runtime.jsxs)("div", {
							className: "flex items-start gap-3",
							"data-replying": true,
							children: [writer ? (0, react_jsx_runtime.jsx)(_fxbot_app.ui.Blob, {
								...writer,
								size: 28,
								busy: true,
								className: "shrink-0"
							}) : null, (0, react_jsx_runtime.jsxs)("div", {
								className: "grid min-w-0 flex-1 grid-cols-1 gap-1 wrap-break-word",
								children: [(0, react_jsx_runtime.jsx)("span", {
									className: "text-sm font-medium",
									children: writer?.name ?? "A bot"
								}), state.replying.text ? (0, react_jsx_runtime.jsx)(Markdown, { text: state.replying.text }) : (0, react_jsx_runtime.jsx)("p", {
									className: "animate-pulse text-muted-foreground",
									children: "Thinking…"
								})]
							})]
						}),
						(0, react_jsx_runtime.jsx)("div", { ref: end })
					]
				})
			}),
			(0, react_jsx_runtime.jsxs)("div", {
				className: "mx-auto w-full max-w-3xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))]",
				children: [
					_fxbot_app.Slot && room && (0, react_jsx_runtime.jsx)("div", {
						className: "grid gap-2 pb-2 empty:hidden",
						children: (0, react_jsx_runtime.jsx)(_fxbot_app.Slot, {
							name: "chat-rooms.room-box",
							props: { room }
						})
					}),
					busy && (0, react_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between gap-2 pb-2 text-xs text-muted-foreground",
						children: [(0, react_jsx_runtime.jsx)("span", {
							className: "min-w-0 truncate",
							children: next.length ? `Next: ${next.join(", ")}` : ""
						}), (0, react_jsx_runtime.jsx)(_fxbot_app.ui.Button, {
							type: "button",
							variant: "outline",
							size: "sm",
							onClick: stop,
							children: "Stop"
						})]
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: "flex items-end gap-2",
						children: [
							(0, react_jsx_runtime.jsx)(_fxbot_app.ui.FormatButton, { className: "mb-1 shrink-0" }),
							(0, react_jsx_runtime.jsx)(Composer, {
								bots: members,
								placeholder: room ? `Message ${room.name}` : "Loading…",
								disabled: !room,
								onSend: send,
								submitRef: submit,
								onEmpty: setEmpty
							}),
							(0, react_jsx_runtime.jsx)(_fxbot_app.ui.Button, {
								type: "button",
								disabled: empty || !room,
								onClick: () => submit.current?.(),
								children: "Send"
							})
						]
					}),
					problem && (0, react_jsx_runtime.jsx)("p", {
						className: "pt-2 text-center text-sm text-destructive",
						children: problem
					})
				]
			}),
			editing && room && (0, react_jsx_runtime.jsx)(EditRoom, {
				room,
				onClose: () => setEditing(false)
			}),
			remembering && room && (0, react_jsx_runtime.jsx)(RoomMemories, {
				room,
				onClose: () => setRemembering(false)
			})
		]
	});
}
function setup(app) {
	app.sidebar(RoomsGroup);
	app.route("/rooms/:id", RoomScreen, { beside: true });
}
module.exports = setup;
