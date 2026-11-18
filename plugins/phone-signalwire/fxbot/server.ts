import { readFile } from "node:fs/promises";
import type { PluginApi } from "@fxbot/sdk";
import type { LineEvents, Provider, Voice } from "../../phone/fxbot/line.ts";
import { endKept, line, type Relay } from "./relay.ts";

// phone-signalwire: SignalWire's RELAY as a line for phone (docs/_completed/phases/phone-signalwire.md and phone.md).
// phone holds the call, its rules, and the owner's number. This holds the connection to SignalWire, one for each call,
// and nothing ever connects to fxbot.

const number = /^\+[1-9]\d{6,14}$/;

export default async function setup(fx: PluginApi) {
  const setting = (name: string) => (fx.settings[name] ?? "").trim();
  // RELAY has one address for every space: the project says whose. A checkout's checks point the plugin at a fake
  // one, read once at start.
  const fake = process.env.FXBOT_PHONE_RELAY ?? "";
  const relay = (): Relay => ({
    url: fake || "wss://relay.signalwire.com",
    project: setting("project"),
    token: setting("token"),
    from: setting("from"),
    voice: setting("voice") || "amazon.Joanna:neural:en-US",
    language: setting("language") || "en-US",
    log: (...parts) => fx.log(...parts),
  });
  function missing() {
    const out = ["project", "token"].filter((name) => !setting(name));
    if (!number.test(setting("from"))) out.push("from");
    return out;
  }
  // What a bot may pick is the voice setting's own list.
  const manifest = JSON.parse(await readFile(new URL("../plugin.json", import.meta.url), "utf8"));
  const voices: Voice[] = manifest.extensions["sh.fxbot"].settings.find((s: { name: string }) => s.name === "voice")?.options ?? [];

  // After a restart, a call the last process left may still be up, since SignalWire keeps calls across connections:
  // each is ended from a new connection with its protocol. Nothing is placed again.
  async function sweep() {
    for (const kept of await fx.sql<{ sid: string; node: string; protocol: string }[]>`select sid, node, protocol from kept`) {
      if (!missing().length) await endKept(relay(), { id: kept.sid, node: kept.node, protocol: kept.protocol });
      await fx.sql`delete from kept where sid = ${kept.sid}`;
    }
  }
  void sweep().catch((error) => fx.log(`The start's sweep failed: ${error.message}`));

  // The lines that may still be up, which unloading ends.
  const open = new Set<ReturnType<typeof line>>();
  const provider: Provider = {
    label: "SignalWire",
    missing,
    voices: () => voices,
    line(events: LineEvents) {
      let sid = "";
      const one = line(relay(), { ...events, ended: (how) => (open.delete(one), events.ended(how)) }, (found) => {
        // Saved as soon as SignalWire names the call, so a crash while it rings leaves nothing up.
        if (found) (sid = found.id), void fx.sql`insert into kept (sid, node, protocol) values (${found.id}, ${found.node}, ${found.protocol})
          on conflict (sid) do update set node = excluded.node, protocol = excluded.protocol`.catch(() => {});
        else if (sid) void fx.sql`delete from kept where sid = ${sid}`.catch(() => {});
      });
      const place = one.place;
      one.place = async (call) => {
        const result = await place(call);
        if (result.outcome !== "answered") open.delete(one);
        return result;
      };
      open.add(one);
      return one;
    },
  };
  fx.provide(provider);

  // Unloading ends this plugin's calls, which phone saves: fxbot waits 5 seconds at most for a cleanup.
  return async () => {
    const ending = Promise.all([...open].map((one) => one.drop("fxbot reloaded phone-signalwire.")));
    await Promise.race([ending, new Promise((resolve) => setTimeout(resolve, 3000))]);
  };
}
