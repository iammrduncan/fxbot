import { useEffect, useState } from "react";
import { PencilIcon, SearchIcon, Trash2Icon, UsersIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Memory, Profile } from "@fxbot/sdk/client";
import { client } from "./client.ts";
import { follow } from "./nav.ts";

const most = 1000;
const day = (at: string) => new Date(at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

// What a list of memories reads and changes, and its words: a bot's own, or the team's.
type Calls = {
  list(query: string): Promise<Memory[]>;
  add(text: string): Promise<unknown>;
  update(id: string, text: string): Promise<unknown>;
  remove(id: string): Promise<unknown>;
  share?(id: string): Promise<unknown>;
};
type Words = { placeholder: string; empty: string; forget: string; seen: string; by(memory: Memory): string };

// A list of memories: newest first, or the matches for a search. The owner adds, edits, and deletes; a change reaches
// the bots' next turns. `version` changes when a turn ends, so a memory a bot just saved shows up.
function MemoryList({ calls, words, version, keyed }: { calls: Calls; words: Words; version: number; keyed: string }) {
  const [memories, setMemories] = useState<Memory[] | null>(null);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<Memory | null>(null);
  const [error, setError] = useState("");
  const read = () =>
    calls.list(query).then(
      (list) => (setMemories(list), setError("")),
      (e: Error) => setError(e.message),
    );
  // A search waits for a pause in typing.
  useEffect(() => {
    const timer = setTimeout(() => void read(), query ? 250 : 0);
    return () => clearTimeout(timer);
  }, [keyed, version, query]);

  const act = async (run: () => Promise<unknown>) => {
    try {
      await run();
      await read();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const add = () => act(async () => (await calls.add(draft), setDraft("")));
  const remove = (memory: Memory) => confirm(`Delete this memory? ${words.forget}`) && act(() => calls.remove(memory.id));
  const share = (memory: Memory) =>
    calls.share && confirm("Share this memory with every bot? It moves to the team's memories, in Settings › Memory.") && act(() => calls.share!(memory.id));

  return (
    <div className="grid gap-3 pt-2">
      <form
        className="grid gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) void add();
        }}
      >
        <Textarea aria-label="Add a memory" placeholder={words.placeholder} value={draft} maxLength={most} onChange={(e) => setDraft(e.target.value)} className="min-h-16" />
        <Button type="submit" size="sm" className="justify-self-start" disabled={!draft.trim()}>
          Add a memory
        </Button>
      </form>
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input aria-label="Search memories" placeholder="Search memories" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-8" />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!memories ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !memories.length ? (
        <p className="text-sm text-muted-foreground">{query ? "No memories match." : words.empty}</p>
      ) : (
        <ul className="grid gap-2" aria-label="Memories">
          {memories.map((memory) => (
            <li key={memory.id} className="grid gap-1 rounded-lg border p-2.5 text-sm">
              <p className="whitespace-pre-line break-words">{memory.text}</p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span className="flex-1">
                  {day(memory.updatedAt)} · {words.by(memory)}
                </span>
                {calls.share && (
                  <Button variant="ghost" size="icon-sm" aria-label="Share with every bot" title="Share with every bot" onClick={() => void share(memory)}>
                    <UsersIcon />
                  </Button>
                )}
                <Button variant="ghost" size="icon-sm" aria-label="Edit memory" onClick={() => setEditing(memory)}>
                  <PencilIcon />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label="Delete memory" onClick={() => void remove(memory)}>
                  <Trash2Icon />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing && <EditMemory memory={editing} seen={words.seen} save={(text) => calls.update(editing.id, text)} onDone={() => (setEditing(null), void read())} onClose={() => setEditing(null)} />}
    </div>
  );
}

// A bot's memories, on its edit screen, with a way to share each with every bot, and a line about the team's.
export function BotMemories({ profile, version }: { profile: Profile; version: number }) {
  const id = profile.id;
  return (
    <>
      <MemoryList
        keyed={id}
        version={version}
        calls={{
          list: (query) => client.profiles.memories.list(id, query),
          add: (text) => client.profiles.memories.add(id, text),
          update: (memoryId, text) => client.profiles.memories.update(id, memoryId, text),
          remove: (memoryId) => client.profiles.memories.remove(id, memoryId),
          share: (memoryId) => client.profiles.memories.share(id, memoryId),
        }}
        words={{
          placeholder: `Something ${profile.name} should remember`,
          empty: `Nothing yet. ${profile.name} saves what it learns about you as you chat, and you can add your own.`,
          forget: `${profile.name} won't know it any more.`,
          seen: `${profile.name} sees the change on its next turn.`,
          by: (memory) => (memory.savedBy === "bot" ? `Saved by ${profile.name}` : "Added by you"),
        }}
      />
      <p className="text-sm text-muted-foreground">
        {profile.name} also reads the team's memories, in{" "}
        <a href="/settings/memory" onClick={follow} className="text-foreground underline underline-offset-4">
          Settings › Memory
        </a>
        .
      </p>
    </>
  );
}

// The team's memories, in Settings › Memory: what every bot reads, and who saved each one.
export function TeamMemories({ profiles }: { profiles: Profile[] | null }) {
  const name = (id: string | null) => (id && profiles?.find((p) => p.id === id)?.name) || "a removed bot";
  return (
    <section className="grid gap-1" aria-labelledby="team-memories">
      <h2 id="team-memories" className="font-medium">
        Team memories
      </h2>
      <p className="text-sm text-muted-foreground">Every bot reads these. Add what all of them should know.</p>
      <MemoryList
        keyed="team"
        version={0}
        calls={{ list: (query) => client.memories.list(query), add: (text) => client.memories.add(text), update: (id, text) => client.memories.update(id, text), remove: (id) => client.memories.remove(id) }}
        words={{
          placeholder: "Something every bot should remember",
          empty: "Nothing yet. Add what all your bots should know, or ask a bot to remember something for all of them.",
          forget: "Your bots won't know it any more.",
          seen: "Every bot sees the change on its next turn.",
          by: (memory) => (memory.savedBy === "bot" ? `Saved by ${name(memory.savedByBot)}` : "Added by you"),
        }}
      />
    </section>
  );
}

function EditMemory({ memory, seen, save, onDone, onClose }: { memory: Memory; seen: string; save: (text: string) => Promise<unknown>; onDone: () => void; onClose: () => void }) {
  const [text, setText] = useState(memory.text);
  const [error, setError] = useState("");
  const submit = async () => {
    try {
      await save(text);
      onDone();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit memory</DialogTitle>
          <DialogDescription>One fact, in a sentence that stands on its own. {seen}</DialogDescription>
        </DialogHeader>
        <Textarea aria-label="Memory" value={text} maxLength={most} onChange={(e) => setText(e.target.value)} className="min-h-28" />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={!text.trim() || text === memory.text}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
