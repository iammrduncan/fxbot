// Soul's parts of the app: the first meeting, started when a new bot's chat is first open; the Soul box on a bot's edit
// screen, with its history; and the card a new soul makes in a reply. Built into page.js; see the README.
import { useEffect, useRef, useState } from "react";
import { api, ui } from "@fxbot/app";

async function call(path, method = "GET", body) {
  const res = await api(path, { method, ...(body ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}) });
  const answer = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(answer.error ?? `HTTP ${res.status}`);
  return answer;
}

const dayOf = (at) => new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric" });

// Asks once for a new bot's first meeting: one that has a provider and has never had a chat. The server decides, and
// marks it, so it starts once. Once it has, the chat reads the bot again, to follow the chat the meeting started.
function Meeting({ bot, reload }) {
  const asked = useRef("");
  useEffect(() => {
    if (bot.sessionId || !bot.provider || asked.current === bot.id) return;
    asked.current = bot.id;
    call(`souls/${bot.id}/meet`, "POST").then((answer) => answer.started && reload?.(), () => {});
  }, [bot.id, bot.sessionId, bot.provider]);
  return null;
}

// The Soul box: the soul, which the owner edits in place, who saved it last, and every version, to restore one.
function SoulBox({ bot }) {
  const { Button, Textarea } = ui;
  const [data, setData] = useState(null);
  const [draft, setDraft] = useState("");
  const [versions, setVersions] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const load = () =>
    call(`souls/${bot.id}`).then(
      (next) => (setData(next), setDraft(next.text), setError("")),
      (e) => setError(e.message),
    );
  const history = () => call(`souls/${bot.id}/versions`).then(setVersions, (e) => setError(e.message));
  useEffect(() => void ((setVersions(null), load())), [bot.id]);
  if (!data) return error ? <p className="text-sm text-destructive">{error}</p> : null;

  const who = (by) => (by === "bot" ? bot.name : "you");
  const after = () => (load(), versions && history());
  const save = () => {
    setSaving(true);
    call(`souls/${bot.id}`, "PUT", { text: draft })
      .then(after, (e) => setError(e.message))
      .finally(() => setSaving(false));
  };
  const restore = (version) => call(`souls/${bot.id}/versions/${version.id}/restore`, "POST").then(after, (e) => setError(e.message));
  const about = !data.on
    ? "soul is off for this bot, so its soul isn't in its chats."
    : data.text
      ? `Written by ${bot.name}, with you. Your instructions above come first.`
      : `${bot.name} hasn't written its soul yet. Ask it to, in its chat, or write one here.`;

  return (
    <section className="grid gap-3 text-sm" aria-label="Soul">
      <h2 className="font-medium">Soul</h2>
      <p className="text-muted-foreground">{about}</p>
      <Textarea rows={6} className="max-h-[50dvh]" maxLength={4000} value={draft} onChange={(e) => setDraft(e.target.value)} aria-label={`${bot.name}'s soul`} />
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex-1 text-muted-foreground">{data.savedAt ? `Saved by ${who(data.savedBy)}, ${dayOf(data.savedAt)}` : ""}</span>
        <Button type="button" size="sm" variant="ghost" onClick={() => (versions ? setVersions(null) : history())}>
          {versions ? "Hide history" : "History"}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={saving || draft.trim() === data.text} onClick={save}>
          Save soul
        </Button>
      </div>
      {error && <p className="text-destructive">{error}</p>}
      {versions &&
        (versions.length ? (
          <ul className="divide-y">
            {versions.map((version, i) => (
              <li key={version.id} className="grid gap-1 py-2">
                <div className="flex items-center gap-3">
                  <span className="flex-1 text-muted-foreground">
                    {dayOf(version.at)} · by {who(version.by)}
                    {i === 0 ? " · now" : ""}
                  </span>
                  {i > 0 && (
                    <Button type="button" size="sm" variant="outline" onClick={() => restore(version)}>
                      Restore
                    </Button>
                  )}
                </div>
                <p className="whitespace-pre-wrap break-words">{version.text || "(empty)"}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">No versions yet.</p>
        ))}
    </section>
  );
}

// soul_save in a reply: a card that opens to the new soul. A refusal shows only as the step's result.
function Saved({ call: tool }) {
  const text = typeof tool.input?.text === "string" ? tool.input.text.trim() : "";
  const saved = tool.done && /^Saved your soul/.test(tool.output ?? "");
  if (tool.done && !saved) return null;
  return (
    <details className="rounded-xl border px-3 py-2 text-sm">
      <summary className="font-medium">{saved ? "Updated its soul" : "Writing its soul…"}</summary>
      {text && <p className="pt-2 whitespace-pre-wrap text-muted-foreground">{text}</p>}
    </details>
  );
}

export default function setup(app) {
  app.chat(Meeting);
  app.botSettings(SoulBox);
  app.toolView("save", Saved, { open: true });
}
