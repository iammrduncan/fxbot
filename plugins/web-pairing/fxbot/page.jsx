// The Web pairing tab in Settings: pair a device with a code and a QR, approve it by six digits, the devices and
// passkeys, what fxbot found about its network, the ICE servers in order, and the relay. Built into page.js; see the README.
import { useEffect, useState } from "react";
import { api, ui } from "@fxbot/app";
import qrcode from "qrcode-generator";

const ago = (t) => {
  if (!t) return "never";
  const s = (Date.now() - new Date(t).getTime()) / 1000;
  return s < 90 ? "just now" : s < 5400 ? `${Math.round(s / 60)} minutes ago` : s < 129600 ? `${Math.round(s / 3600)} hours ago` : `${Math.round(s / 86400)} days ago`;
};
async function call(path, init) {
  const res = await api(path, init && { ...init, headers: { "content-type": "application/json" }, body: init.body && JSON.stringify(init.body) });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error ?? `HTTP ${res.status}`);
  return out;
}

function Qr({ text }) {
  const q = qrcode(0, "M");
  q.addData(text);
  q.make();
  // qrcode-generator's own SVG, made from the link alone.
  return <div className="wp-qr" role="img" aria-label="QR code of the pairing link" dangerouslySetInnerHTML={{ __html: q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }) }} />;
}
const Section = ({ title, children }) => (
  <section className="grid gap-2" aria-label={title}>
    <h3 className="text-sm font-medium">{title}</h3>
    {children}
  </section>
);
const mark = { good: "✓", warn: "!", bad: "✕", unknown: "?" };

function Pairing({ state, refresh }) {
  const { Button } = ui;
  const [ticket, setTicket] = useState(null);
  const [error, setError] = useState("");
  const open = ticket && ["open", "pairing", "compare"].includes(ticket.state);
  useEffect(() => {
    if (!open) return;
    const timer = setInterval(() => call(`pair/${ticket.tid}`).then(setTicket, () => {}), 1500);
    return () => clearInterval(timer);
  }, [open, ticket?.tid]);
  useEffect(() => void (ticket && !open && refresh()), [ticket?.state]);
  const start = () => (setError(""), call("pair", { method: "POST" }).then(setTicket, (e) => setError(e.message)));
  const decide = (body) => call(`pair/${ticket.tid}`, { method: "POST", body }).then(setTicket, (e) => setError(e.message));
  return (
    <Section title="Pair a device">
      {!open && (
        <p className="text-sm text-muted-foreground">
          Opens your fxbot on a phone or another computer, at <a className="underline" href={state.shell} target="_blank" rel="noreferrer">{new URL(state.shell).host}</a>, peer to peer. On an iPhone, add it to the Home Screen first, and pair in that app.
        </p>
      )}
      {ticket?.state === "open" && (
        <div className="grid gap-3 rounded-xl border p-3 text-sm">
          <p>
            On the new device, open <strong>{new URL(state.shell).host}</strong>, choose Pair a device, and type this code, or scan the QR code with its camera.
          </p>
          {ticket.code ? <p className="wp-code">{ticket.code}</p> : <p className="text-destructive">The relay didn't give a code, so only the QR code works now.</p>}
          <Qr text={ticket.link} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => navigator.clipboard?.writeText(ticket.link)}>Copy the link</Button>
            <Button size="sm" variant="ghost" onClick={() => decide({ cancel: true })}>Cancel</Button>
          </div>
          <p className="text-xs text-muted-foreground">The code works once, for 10 minutes. Only show it to a device of your own.</p>
        </div>
      )}
      {ticket?.state === "pairing" && <p className="text-sm text-muted-foreground">A device is pairing…</p>}
      {ticket?.state === "compare" && (
        <div className="grid gap-3 rounded-xl border p-3 text-sm">
          <p>
            <strong>{ticket.device?.name ?? "A device"}</strong>
            {ticket.device?.platform && <span className="text-muted-foreground"> · {ticket.device.platform}</span>} wants to pair. Check that it shows these six digits:
          </p>
          <p className="wp-sas">{`${ticket.sas.slice(0, 3)} ${ticket.sas.slice(3)}`}</p>
          <p className="text-xs text-muted-foreground">If they don't match, deny it: someone else may be pairing.</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => decide({ ok: true })}>Approve</Button>
            <Button size="sm" variant="outline" onClick={() => decide({ ok: false })}>Deny</Button>
          </div>
        </div>
      )}
      {ticket && !open && <p className={`text-sm ${ticket.state === "approved" ? "" : "text-destructive"}`}>{ticket.state === "approved" ? `Paired ${ticket.device?.name ?? "the device"}.` : ticket.why ?? "That pairing ended."}</p>}
      {state.locked && <p className="text-sm text-destructive">Pairing is locked after three wrong codes, until {new Date(state.locked).toLocaleTimeString()}.</p>}
      {!open && (
        <div>
          <Button size="sm" disabled={!state.on || Boolean(state.locked)} onClick={start}>Pair a device</Button>
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </Section>
  );
}

function Devices({ state, refresh }) {
  const { Button } = ui;
  const act = (p) => p.then(refresh, (e) => alert(e.message));
  if (!state.devices.length) return null;
  return (
    <Section title="Devices">
      <ul className="divide-y rounded-xl border text-sm">
        {state.devices.map((d) => (
          <li key={d.id} className="flex items-center gap-3 px-3 py-2">
            <span className={`wp-dot ${d.connected ? "wp-on" : ""}`} aria-label={d.connected ? "Connected" : "Not connected"} />
            <span className="grid min-w-0 flex-1 gap-0.5">
              <span className="truncate font-medium">{d.name}</span>
              <span className="text-xs text-muted-foreground">
                {[d.platform, d.connected && (d.route ? `connected ${d.route}` : "connected"), `paired ${ago(d.pairedAt)} by ${d.how}, approved on ${d.pairedBy}`, `seen ${ago(d.lastSeen)}`].filter(Boolean).join(" · ")}
              </span>
            </span>
            <Button size="sm" variant="ghost" onClick={() => { const name = prompt("Name this device", d.name); if (name) act(call(`devices/${d.id}`, { method: "PATCH", body: { name } })); }}>Rename</Button>
            <Button size="sm" variant="ghost" onClick={() => confirm(`Remove ${d.name}? It can't reach this fxbot again until it pairs again.`) && act(call(`devices/${d.id}`, { method: "DELETE" }))}>Remove</Button>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Passkeys({ state, refresh }) {
  const { Button } = ui;
  if (!state.passkeys.length) return null;
  return (
    <Section title="Passkeys">
      <ul className="divide-y rounded-xl border text-sm">
        {state.passkeys.map((k) => (
          <li key={k.id} className="flex items-center gap-3 px-3 py-2">
            <span className="min-w-0 flex-1 truncate">
              Added by {k.addedBy} {ago(k.addedAt)}
              <span className="text-muted-foreground">{k.usedAt ? ` · last used ${ago(k.usedAt)}` : " · never used"}</span>
            </span>
            <Button size="sm" variant="ghost" onClick={() => confirm("Remove this passkey? It won't pair a device again.") && call(`passkeys/${encodeURIComponent(k.id)}`, { method: "DELETE" }).then(refresh)}>Remove</Button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">A passkey pairs a wiped device again, with no code. Paired devices add them, from their own Devices screen.</p>
    </Section>
  );
}

function Reachability({ state, refresh }) {
  const { Button } = ui;
  const [busy, setBusy] = useState(false);
  const again = () => (setBusy(true), call("reach", { method: "POST" }).finally(() => (setBusy(false), refresh())));
  const r = state.reach;
  return (
    <Section title="Reachability">
      {r ? (
        <>
          <p className="text-sm font-medium">{r.summary}</p>
          <ul className="grid gap-1.5 text-sm">
            {r.findings.map((f) => (
              <li key={f.check} className="flex gap-2">
                <span className={`wp-mark wp-${f.result}`} aria-label={f.result}>{mark[f.result]}</span>
                <span>
                  {f.text}
                  {f.docs && (
                    <>
                      {" "}
                      <a className="underline" href={f.docs} target="_blank" rel="noreferrer">How to fix it</a>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Checking…</p>
      )}
      <div className="flex items-center gap-3">
        <Button size="sm" variant="outline" disabled={busy} onClick={again}>{busy ? "Checking…" : "Check again"}</Button>
        {state.reachAt && <span className="text-xs text-muted-foreground">Checked {ago(state.reachAt)}</span>}
      </div>
    </Section>
  );
}

const kinds = {
  stun: { label: "STUN server", fields: [["urls", "Address", "stun:stun.example.com:3478"]] },
  turn: { label: "TURN server", fields: [["urls", "Address", "turns:turn.example.com:443?transport=tcp"], ["username", "Username"], ["credential", "Password", "", true]] },
  secret: { label: "TURN with a shared secret (coturn, eturnal)", fields: [["urls", "Address", "turns:turn.example.com:443?transport=tcp"], ["secret", "Shared secret", "", true]] },
  cloudflare: { label: "Cloudflare TURN key", fields: [["keyId", "TURN key ID"], ["token", "API token", "", true]] },
};

function IceServers({ state, refresh }) {
  const { Button, Input, NativeSelect, NativeSelectOption } = ui;
  const [kind, setKind] = useState("stun");
  const [form, setForm] = useState({});
  const [error, setError] = useState("");
  const act = (p) => p.then(refresh, (e) => setError(e.message));
  const add = (e) => {
    e.preventDefault();
    setError("");
    call("ice", { method: "POST", body: { kind, ...form } }).then(() => (setForm({}), refresh()), (err) => setError(err.message));
  };
  return (
    <Section title="ICE servers">
      <p className="text-sm text-muted-foreground">Tried in this order. STUN finds each end's public address; a TURN server of your own carries the traffic where no direct path works. fxbot contacts no others.</p>
      {state.ice.length ? (
        <ol className="divide-y rounded-xl border text-sm">
          {state.ice.map((e, i) => (
            <li key={e.id} className="flex items-center gap-2 px-3 py-2">
              <span className="min-w-0 flex-1 truncate">
                <span className="font-mono text-xs">{e.urls}</span>
                <span className="text-muted-foreground"> · {e.id === "cloudflare" ? "Cloudflare's STUN" : kinds[e.kind].label}{e.username ? `, as ${e.username}` : ""}{e.keyId ? `, key ${e.keyId}` : ""}</span>
              </span>
              <Button size="sm" variant="ghost" disabled={i === 0} aria-label="Move up" onClick={() => act(call(`ice/${e.id}/move`, { method: "POST", body: { by: -1 } }))}>↑</Button>
              <Button size="sm" variant="ghost" disabled={i === state.ice.length - 1} aria-label="Move down" onClick={() => act(call(`ice/${e.id}/move`, { method: "POST", body: { by: 1 } }))}>↓</Button>
              <Button size="sm" variant="ghost" onClick={() => act(call(`ice/${e.id}`, { method: "DELETE" }))}>Remove</Button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-destructive">No ICE servers: devices can connect only on this network.</p>
      )}
      {!state.ice.some((e) => e.id === "cloudflare") && (
        <div>
          <Button size="sm" variant="outline" onClick={() => act(call("ice/cloudflare", { method: "POST" }))}>Add Cloudflare's STUN back</Button>
        </div>
      )}
      <form className="grid gap-2 rounded-xl border p-3" onSubmit={add}>
        <NativeSelect value={kind} onChange={(e) => (setKind(e.target.value), setForm({}))} aria-label="Kind of server">
          {Object.entries(kinds).map(([k, v]) => (
            <NativeSelectOption key={k} value={k}>{v.label}</NativeSelectOption>
          ))}
        </NativeSelect>
        {kinds[kind].fields.map(([name, label, placeholder, secret]) => (
          <Input key={name} aria-label={label} placeholder={placeholder || label} type={secret ? "password" : "text"} autoComplete="off" value={form[name] ?? ""} onChange={(e) => setForm({ ...form, [name]: e.target.value })} />
        ))}
        <div>
          <Button size="sm" type="submit">Add</Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </form>
    </Section>
  );
}

function Advanced({ state, refresh }) {
  const { Button, Input, Switch } = ui;
  const [relay, setRelay] = useState(state.relay);
  const [ports, setPorts] = useState(state.ports.join("-"));
  const [error, setError] = useState("");
  const save = (body) => (setError(""), call("config", { method: "POST", body }).then(refresh, (e) => setError(e.message)));
  const m = state.mapped;
  return (
    <Section title="Relay and ports">
      <form className="flex gap-2" onSubmit={(e) => (e.preventDefault(), save({ relay }))}>
        <Input aria-label="Relay" value={relay} onChange={(e) => setRelay(e.target.value)} />
        <Button size="sm" variant="outline" type="submit">Save</Button>
      </form>
      <p className="text-xs text-muted-foreground">
        {state.relay === state.defaultRelay ? "fxbot.sh's relay, which passes sealed handshakes and stores nothing." : "A relay of your own. Pairing links carry its address."}{" "}
        {state.listening ? "Connected to it." : "Not connected to it: fxbot connects only while a pairing is open or a device is paired."}
      </p>
      <form className="flex items-center gap-2" onSubmit={(e) => (e.preventDefault(), save({ ports: ports.split(/\D+/).map(Number) }))}>
        <span className="text-sm">UDP ports</span>
        <Input className="w-32" aria-label="UDP ports" value={ports} onChange={(e) => setPorts(e.target.value)} />
        <Button size="sm" variant="outline" type="submit">Save</Button>
      </form>
      <label className="flex items-center justify-between gap-3 text-sm">
        Map the ports on the router, by NAT-PMP or UPnP
        <Switch checked={state.mapping} onCheckedChange={(mapping) => save({ mapping })} />
      </label>
      <p className="text-xs text-muted-foreground">
        {m.container ? "fxbot runs in a container, so it can't map ports: publish them instead, as the docs show." : m.how ? `Mapped by ${m.how}${m.external ? `, at ${m.external}` : ""}.` : m.error ?? (state.mapping ? "Mapped while fxbot listens." : "Off.")}
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </Section>
  );
}

function WebPairing() {
  const { Switch } = ui;
  const [state, setState] = useState(null);
  const [error, setError] = useState("");
  const refresh = () => call("state").then((s) => (setState(s), setError("")), (e) => setError(e.message));
  useEffect(() => {
    void refresh();
    const timer = setInterval(refresh, 10_000);
    return () => clearInterval(timer);
  }, []);
  if (!state) return error ? <p className="text-sm text-muted-foreground">{error}</p> : null;
  return (
    <div className="grid gap-6">
      <label className="flex items-center justify-between gap-3 text-sm">
        <span>
          <span className="font-medium">Remote access</span>
          <span className="block text-xs text-muted-foreground">Off closes the relay connection and every device's connection.</span>
        </span>
        <Switch checked={state.on} onCheckedChange={(on) => call("config", { method: "POST", body: { on } }).then(refresh)} />
      </label>
      <Pairing state={state} refresh={refresh} />
      <Devices state={state} refresh={refresh} />
      <Passkeys state={state} refresh={refresh} />
      <Reachability state={state} refresh={refresh} />
      <IceServers state={state} refresh={refresh} />
      <Advanced state={state} refresh={refresh} />
      <p className="text-xs text-muted-foreground">
        This fxbot's key fingerprint: <span className="font-mono">{state.rid.match(/.{1,4}/g).join(" ")}</span>. A paired device's Devices screen shows the same.
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

export default function setup(app) {
  app.settings(WebPairing);
}
