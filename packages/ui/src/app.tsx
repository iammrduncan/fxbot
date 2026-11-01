import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type MouseEvent, type ReactNode } from "react";
import { ArrowUpIcon, CheckIcon, CircleCheckIcon, CopyIcon, FileTextIcon, LoaderCircleIcon, MessageCircleDashedIcon, PaperclipIcon, PlusIcon, SettingsIcon, XIcon } from "lucide-react";
import { Streamdown } from "streamdown";
import { Attachment, AttachmentAction, AttachmentActions, AttachmentContent, AttachmentGroup, AttachmentMedia, AttachmentTitle } from "@/components/ui/attachment";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@/components/ui/input-group";
import { Message, MessageContent, MessageFooter } from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Trace, TraceCollapsible, TraceCollapsibleContent, TraceCollapsibleTrigger, TraceIcon, TraceLine, TraceTitle } from "@/components/ui/trace";
import { unreachable, type Fields, type Profile, type Turn, type Upload } from "@fxbot/sdk/client";
import { client } from "./client.ts";
import { maxFiles, readFile } from "./attachments.ts";
import { useTurnStream } from "./use-turn-stream.ts";

function go(path: string) {
  history.pushState(null, "", path);
  dispatchEvent(new PopStateEvent("popstate"));
}

// In-app navigation for plain links. Modified clicks keep the browser's behavior.
function follow(event: MouseEvent<HTMLAnchorElement>) {
  if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  go(event.currentTarget.pathname);
}

export function App() {
  const [path, setPath] = useState(location.pathname);
  useEffect(() => {
    const update = () => setPath(location.pathname);
    addEventListener("popstate", update);
    return () => removeEventListener("popstate", update);
  }, []);

  // The sidebar's list. Forms bump `version` after a change; a failed load retries.
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [offline, setOffline] = useState(false);
  const [version, setVersion] = useState(0);
  const refresh = () => setVersion((v) => v + 1);
  useEffect(() => {
    let stopped = false;
    const load = () =>
      client.profiles.list().then(
        (list) => {
          if (stopped) return;
          setProfiles(list);
          setOffline(false);
        },
        () => {
          if (stopped) return;
          setOffline(true);
          setTimeout(load, 3000);
        },
      );
    load();
    return () => {
      stopped = true;
    };
  }, [version]);

  const [, top, id, sub] = path.split("/");
  let screen: ReactNode;
  if (path === "/") screen = <Home profiles={profiles} offline={offline} />;
  else if (path === "/settings") screen = <SettingsForm />;
  else if (top === "profiles" && id === "new" && sub === undefined) screen = <ProfileForm key="new" onSaved={refresh} />;
  else if (top === "profiles" && id && sub === "edit") screen = <ProfileForm key={id} id={id} onSaved={refresh} />;
  else if (top === "profiles" && id && sub === undefined) screen = <Chat key={id} id={id} onReply={refresh} />;
  else screen = <Header title="Not found" />;

  return (
    <TooltipProvider>
      <SidebarProvider>
        <BotSidebar profiles={profiles} offline={offline} active={id} />
        <SidebarInset className="h-dvh overflow-hidden">{screen}</SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}

function BotSidebar({ profiles, offline, active }: { profiles: Profile[] | null; offline: boolean; active?: string }) {
  const { setOpenMobile } = useSidebar();
  const open = (event: MouseEvent<HTMLAnchorElement>) => {
    follow(event);
    setOpenMobile(false);
  };
  return (
    <Sidebar>
      <SidebarHeader className="flex-row items-center justify-between">
        <a href="/" onClick={open} className="px-2 text-lg font-semibold">
          fxbot
        </a>
        <Tooltip>
          <TooltipTrigger asChild>
            <a href="/profiles/new" onClick={open} aria-label="New bot" className={buttonVariants({ variant: "ghost", size: "icon" })}>
              <PlusIcon />
            </a>
          </TooltipTrigger>
          <TooltipContent>New bot</TooltipContent>
        </Tooltip>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          {offline && <p className="px-2 text-sm text-destructive">{unreachable}</p>}
          <SidebarMenu>
            {profiles?.map((profile) => (
              <SidebarMenuItem key={profile.id}>
                <SidebarMenuButton asChild size="lg" isActive={profile.id === active} className="h-auto gap-3 py-2">
                  <a href={`/profiles/${profile.id}`} onClick={open}>
                    <BotAvatar profile={profile} />
                    <span className="grid min-w-0 gap-0.5 leading-tight">
                      <span className="truncate text-base">{profile.name}</span>
                      <span className="truncate text-muted-foreground">{profile.preview ?? "No messages yet"}</span>
                    </span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={location.pathname === "/settings"}>
              <a href="/settings" onClick={open}>
                <SettingsIcon />
                Settings
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

// A colored initial, picked from the id so a bot keeps its color.
const avatarColors = ["bg-orange-500", "bg-pink-500", "bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500", "bg-teal-500", "bg-rose-500"];
const BotAvatar = ({ profile }: { profile: Profile }) => (
  <Avatar className="size-10">
    <AvatarFallback className={`${avatarColors[parseInt(profile.id.slice(0, 2), 16) % avatarColors.length]} font-semibold text-white`}>
      {profile.name.slice(0, 1).toUpperCase()}
    </AvatarFallback>
  </Avatar>
);

function Header({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 px-3">
      <SidebarTrigger />
      <h1 className="min-w-0 flex-1 truncate font-medium">{title}</h1>
      {children}
    </header>
  );
}

const label = "grid gap-1.5 text-sm font-medium";

const Problem = ({ children }: { children: ReactNode }) => (
  <p role="alert" className="mx-auto w-full max-w-3xl rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
    {children}
  </p>
);

function Home({ profiles, offline }: { profiles: Profile[] | null; offline: boolean }) {
  const some = Boolean(profiles?.length);
  return (
    <>
      <Header title="fxbot" />
      {offline && (
        <div className="px-4">
          <Problem>{unreachable} Retrying…</Problem>
        </div>
      )}
      <Empty className="flex-1">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MessageCircleDashedIcon />
          </EmptyMedia>
          <EmptyTitle>{profiles === null ? "fxbot" : some ? "Pick a bot" : "No bots yet"}</EmptyTitle>
          <EmptyDescription>{some ? "Choose one from the list, or make another." : "Make a bot to start a conversation."}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <a href="/profiles/new" onClick={follow} className={buttonVariants()}>
            New bot
          </a>
        </EmptyContent>
      </Empty>
    </>
  );
}

function ProfileForm({ id, onSaved }: { id?: string; onSaved: () => void }) {
  const [fields, setFields] = useState<Fields>({ name: "", instructions: "", model: "" });
  const [loaded, setLoaded] = useState(!id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [defaultModel, setDefaultModel] = useState("");
  useEffect(() => {
    if (!id) return;
    client.settings.get().then((settings) => setDefaultModel(settings.defaultModel), () => {});
    client.profiles.get(id).then(
      ({ name, instructions, model }) => {
        setFields({ name, instructions, model });
        setLoaded(true);
      },
      (e: Error) => setError(e.message),
    );
  }, [id]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const saved = await (id ? client.profiles.update(id, fields) : client.profiles.create({ name: fields.name }));
      onSaved();
      go(`/profiles/${saved.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Delete ${fields.name}? Its conversation files stay on the server.`)) return;
    try {
      await client.profiles.remove(id!);
      onSaved();
      go("/");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const set = (key: keyof Fields) => (event: { target: { value: string } }) => setFields({ ...fields, [key]: event.target.value });
  return (
    <>
      <Header title={id ? `Edit ${fields.name || "bot"}` : "New bot"} />
      <main className="flex-1 overflow-y-auto px-4 py-6">
        <form onSubmit={save} className="mx-auto grid max-w-xl gap-5">
          <label className={label}>
            Name
            <Input required maxLength={200} value={fields.name} onChange={set("name")} disabled={!loaded} />
          </label>
          {/* A new bot is just a name. Its model and instructions are set here later, if at all. */}
          {id && (
            <>
              <label className={label}>
                Model
                <Input maxLength={200} value={fields.model} onChange={set("model")} disabled={!loaded} placeholder={`Default: ${defaultModel || "none set in Settings"}`} />
              </label>
              <label className={label}>
                Instructions
                <Textarea rows={8} className="max-h-[50dvh]" value={fields.instructions} onChange={set("instructions")} disabled={!loaded} />
              </label>
            </>
          )}
          {error && <Problem>{error}</Problem>}
          <div className="flex gap-2">
            <Button type="submit" disabled={busy || !loaded}>
              Save
            </Button>
            {id && (
              <Button type="button" variant="destructive" onClick={remove} disabled={!loaded}>
                Delete
              </Button>
            )}
          </div>
        </form>
      </main>
    </>
  );
}

function SettingsForm() {
  const [defaultModel, setDefaultModel] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState("");
  useEffect(() => {
    client.settings.get().then(
      (settings) => {
        setDefaultModel(settings.defaultModel);
        setLoaded(true);
      },
      (e: Error) => setStatus(e.message),
    );
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setStatus("");
    try {
      await client.settings.update({ defaultModel });
      setStatus("Saved.");
    } catch (e) {
      setStatus((e as Error).message);
    }
  }

  return (
    <>
      <Header title="Settings" />
      <main className="flex-1 overflow-y-auto px-4 py-6">
        <form onSubmit={save} className="mx-auto grid max-w-xl gap-5">
          <label className={label}>
            Default model
            <Input maxLength={200} value={defaultModel} onChange={(e) => setDefaultModel(e.target.value)} disabled={!loaded} placeholder="A model id your endpoint serves" />
            <span className="font-normal text-muted-foreground">Bots without a model of their own use this one.</span>
          </label>
          {status && <p className="text-sm text-muted-foreground">{status}</p>}
          <div>
            <Button type="submit" disabled={!loaded}>
              Save
            </Button>
          </div>
        </form>
      </main>
    </>
  );
}

const newMessageId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

function Chat({ id, onReply }: { id: string; onReply: () => void }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [attached, setAttached] = useState<Upload[]>([]);
  const [notice, setNotice] = useState("");
  const box = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const { turns, setTurns, connected } = useTurnStream(id, Boolean(profile?.sessionId));

  // The box starts one line tall and grows with its text up to its max height, where it scrolls.
  useLayoutEffect(() => {
    if (!box.current) return;
    box.current.style.height = "auto";
    box.current.style.height = `${box.current.scrollHeight}px`;
  }, [draft]);

  // Keeps trying, so the chat comes back on its own when the server does.
  useEffect(() => {
    let stopped = false;
    const load = () =>
      client.profiles.get(id).then(
        (loaded) => {
          if (stopped) return;
          setProfile(loaded);
          setError("");
        },
        (e: Error) => {
          if (stopped) return;
          setError(e.message);
          setTimeout(load, 3000);
        },
      );
    load();
    return () => {
      stopped = true;
    };
  }, [id]);

  // The server saves each reply's preview for the sidebar, so reload the list as replies finish.
  const finished = turns.filter((turn) => turn.done).length;
  useEffect(() => {
    if (finished) onReply();
  }, [finished]); // Only the count matters; onReply is a new function on every render.

  // An unsent turn keeps its files' data, so Retry sends them again.
  async function send(text: string, messageId: string, files: Upload[]) {
    const pending = { messageId, text, files, reply: "", done: false };
    setTurns((all) => (all.some((t) => t.messageId === messageId) ? all.map((t) => (t.messageId === messageId ? pending : t)) : [...all, pending]));
    try {
      const { sessionId } = await client.send(id, { text, messageId, files: files.map(({ name, type, data }) => ({ name, type, data })) });
      setProfile((current) => current && { ...current, sessionId });
    } catch (e) {
      const note = `Not sent: ${(e as Error).message}`;
      setTurns((all) => all.map((t) => (t.messageId === messageId && !t.done ? { ...t, done: true, note, unsent: true } : t)));
    }
  }

  function submit(event: { preventDefault(): void }) {
    event.preventDefault();
    if ((!draft.trim() && !attached.length) || !profile) return;
    send(draft, newMessageId(), attached);
    setDraft("");
    setAttached([]);
    setNotice("");
  }

  // From the picker, a paste, or a drop. The list is copied first, since the browser empties it after the event.
  async function attach(files: File[]) {
    const read = await Promise.allSettled(files.map(readFile));
    const added = read.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
    const problems = read.flatMap((result) => (result.status === "rejected" ? [(result.reason as Error).message] : []));
    if (attached.length + added.length > maxFiles) problems.push(`A message takes at most ${maxFiles} files.`);
    setAttached((all) => [...all, ...added].slice(0, maxFiles));
    setNotice(problems.join(" "));
  }

  const offline = error || (!connected && unreachable);
  const empty = turns.length === 0;
  return (
    <>
      <Header title={profile?.name ?? "Chat"}>
        <a href={`/profiles/${id}/edit`} onClick={follow} className={buttonVariants({ variant: "ghost" })}>
          Edit
        </a>
      </Header>
      {offline && (
        <div className="px-4">
          <Problem>{offline} Retrying…</Problem>
        </div>
      )}
      <MessageScrollerProvider autoScroll>
        {/* The composer keeps its place in the tree, so it keeps focus when the first turn arrives. */}
        <div
          className={`flex min-h-0 flex-1 flex-col ${empty ? "justify-center gap-6 pb-[15dvh]" : ""}`}
          onDragOver={(e) => e.dataTransfer.types.includes("Files") && e.preventDefault()}
          onDrop={(e) => {
            if (!e.dataTransfer.files.length || !profile) return;
            e.preventDefault();
            attach([...e.dataTransfer.files]);
          }}
        >
          {empty ? (
            <h2 className="text-center text-2xl font-semibold">{profile ? `Talk to ${profile.name}` : "Loading…"}</h2>
          ) : (
            <MessageScroller className="flex-1">
              <MessageScrollerViewport>
                <MessageScrollerContent className="mx-auto w-full max-w-3xl gap-6 px-4 py-4">
                  {turns.map((turn) => (
                    <TurnView key={turn.messageId} turn={turn} retry={() => send(turn.text, turn.messageId, turn.files ?? [])} />
                  ))}
                </MessageScrollerContent>
              </MessageScrollerViewport>
              <MessageScrollerButton />
            </MessageScroller>
          )}
          <form onSubmit={submit} className="mx-auto w-full max-w-3xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {notice && <p className="px-4 pb-2 text-sm text-destructive">{notice}</p>}
            {/* Wraps so the files take the first row and the text and buttons the second; the buttons stay at the bottom as the text grows. */}
            <InputGroup className="h-auto flex-wrap items-end rounded-3xl bg-background px-1">
              {attached.length > 0 && (
                <Files className="order-first w-full px-2 pt-2" files={attached} remove={(i) => setAttached((all) => all.toSpliced(i, 1))} />
              )}
              <InputGroupAddon align="inline-start" className="pb-1.5">
                <input ref={picker} type="file" multiple hidden onChange={(e) => attach([...(e.target.files ?? [])]).then(() => (e.target.value = ""))} />
                <InputGroupButton size="icon-sm" className="rounded-full" disabled={!profile} aria-label="Attach files" onClick={() => picker.current?.click()}>
                  <PaperclipIcon />
                </InputGroupButton>
              </InputGroupAddon>
              <InputGroupTextarea
                ref={box}
                rows={1}
                aria-label="Message"
                className="max-h-48 min-h-0 py-3"
                placeholder={profile ? `Message ${profile.name}` : "Loading…"}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && submit(e)}
                onPaste={(e) => {
                  if (!e.clipboardData.files.length) return;
                  // Text pasted with a picture of itself, as from a spreadsheet, keeps the text as well.
                  if (!e.clipboardData.getData("text/plain")) e.preventDefault();
                  attach([...e.clipboardData.files]);
                }}
                disabled={!profile}
              />
              <InputGroupAddon align="inline-end" className="pb-1.5">
                <InputGroupButton type="submit" variant="default" size="icon-sm" className="rounded-full" disabled={!profile || (!draft.trim() && !attached.length)} aria-label="Send">
                  <ArrowUpIcon />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </form>
        </div>
      </MessageScrollerProvider>
    </>
  );
}

// One turn: the person's message as the scroll anchor, then the reply as markdown with its actions.
function TurnView({ turn, retry }: { turn: Turn; retry: () => void }) {
  return (
    <>
      {turn.text || turn.files?.length ? (
        <MessageScrollerItem messageId={`${turn.messageId}-user`} scrollAnchor>
          <Message align="end">
            <MessageContent>
              {turn.files?.length ? <Files className="flex-wrap justify-end" files={turn.files} /> : null}
              {turn.text && (
                <Bubble align="end" variant="muted">
                  <BubbleContent className="whitespace-pre-wrap">{turn.text}</BubbleContent>
                </Bubble>
              )}
            </MessageContent>
          </Message>
        </MessageScrollerItem>
      ) : null}
      <MessageScrollerItem messageId={`${turn.messageId}-reply`}>
        <Message>
          <MessageContent>
            {turn.reasoning && <Reasoning text={turn.reasoning} running={!turn.done && !turn.reply} />}
            {turn.reply ? <Streamdown>{turn.reply}</Streamdown> : !turn.done && !turn.reasoning && <p className="animate-pulse text-muted-foreground">Thinking…</p>}
            {turn.note && (
              <p className="text-sm text-destructive">
                {turn.note}{" "}
                {turn.unsent && (
                  <Button size="xs" variant="outline" onClick={retry}>
                    Retry
                  </Button>
                )}
              </p>
            )}
            {turn.done && turn.reply && (
              <MessageFooter>
                <CopyButton text={turn.reply} />
              </MessageFooter>
            )}
          </MessageContent>
        </Message>
      </MessageScrollerItem>
    </>
  );
}

// Files in the composer, as shadcn's Attachment chips with a remove button, or on a sent message, where images come
// first, at a readable size, and open larger in a dialog.
function Files({ files, remove, className = "" }: { files: Upload[]; remove?: (index: number) => void; className?: string }) {
  const shown = remove ? files : [...files.filter((file) => file.url), ...files.filter((file) => !file.url)];
  return (
    <AttachmentGroup className={className}>
      {shown.map((file, i) =>
        !remove && file.url ? (
          <Dialog key={i}>
            <DialogTrigger className="flex-none cursor-zoom-in" aria-label={`Open ${file.name}`}>
              <img src={file.url} alt={file.name} className="max-h-48 max-w-48 rounded-xl border object-cover" />
            </DialogTrigger>
            <DialogContent aria-describedby={undefined} className="w-fit p-2 pt-11 sm:max-w-[calc(100%-4rem)]">
              <DialogTitle className="absolute top-4 right-12 left-3 truncate text-sm">{file.name}</DialogTitle>
              <img src={file.url} alt={file.name} className="max-h-[calc(100dvh-8rem)] max-w-[calc(100vw-3rem)] rounded-lg" />
            </DialogContent>
          </Dialog>
        ) : (
          <Attachment key={i} size="sm">
            <AttachmentMedia variant={file.url ? "image" : "icon"}>{file.url ? <img src={file.url} alt="" /> : <FileTextIcon />}</AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>{file.name}</AttachmentTitle>
            </AttachmentContent>
            {remove && (
              <AttachmentActions>
                <AttachmentAction type="button" aria-label={`Remove ${file.name}`} onClick={() => remove(i)}>
                  <XIcon />
                </AttachmentAction>
              </AttachmentActions>
            )}
          </Attachment>
        ),
      )}
    </AttachmentGroup>
  );
}

// shadcn's Reasoning pattern: open while the model thinks, folded once the reply starts.
function Reasoning({ text, running }: { text: string; running: boolean }) {
  const [open, setOpen] = useState<boolean>();
  return (
    <Trace>
      <TraceCollapsible open={open ?? running} onOpenChange={setOpen}>
        <TraceCollapsibleTrigger>
          <TraceLine status={running ? "running" : undefined}>
            <TraceIcon>{running ? <LoaderCircleIcon className="animate-spin" /> : <CircleCheckIcon />}</TraceIcon>
            <TraceTitle>{running ? "Thinking" : "Thought"}</TraceTitle>
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent className="whitespace-pre-wrap">{text}</TraceCollapsibleContent>
      </TraceCollapsible>
    </Trace>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () =>
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Copy" onClick={copy}>
          {copied ? <CheckIcon /> : <CopyIcon />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>Copy</TooltipContent>
    </Tooltip>
  );
}
