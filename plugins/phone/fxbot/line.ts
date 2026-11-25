// What a provider plugin offers phone (docs/_completed/phases/phone.md, The contract). A provider names phone under
// needs, with { "line": 2 }, or the older { "line": 1 }, and offers a Provider with fx.provide. phone holds the call and its conversation; the
// provider holds the connection to its service, speaks the bot's words, and says what the owner said, as text both ways.

export type Outcome = "answered" | "voicemail" | "missed" | "busy" | "declined" | "failed";
/** What the line tells the call. */
export type LineEvents = {
  /** The owner finished something they said, after the recognizer's own short wait, about a second. phone holds it for
   * the owner's pause setting, joining what follows sooner. */
  heard: (text: string) => void;
  /** Line 2: the words of what the owner is saying so far, as they come. phone decides from them, and from heard, what
   * cuts the bot off, and stops the line itself. */
  hearing?: (text: string) => void;
  /** Line 1 only: the provider cut the bot off when the owner spoke over it, so what was playing stopped, and what was
   * waiting was dropped. A line 2 provider never cuts the bot off on its own. */
  interrupted: () => void;
  /** Those words were played to the end. */
  played: (text: string) => void;
  /** The call is over, and why: "hung up" when the owner or the bot hung up, or else what ended it. */
  ended: (how: string) => void;
  /** Phone's own voice loop: the owner's voice has sounded this long, in ms, with no words yet, from a listener that
   * gives none as they come. */
  voice?: (ms: number) => void;
};
export type Place = {
  /** The owner's confirmed number. */
  to: string;
  /** Played the moment the owner answers. */
  greeting: string;
  /** For a call the bot makes: a machine gets this line at the beep instead, and the call ends. */
  voicemail?: string;
  /** Words the recognizer should expect, such as the bot's name. */
  hints?: string[];
  /** A call that only speaks, such as the code that confirms a number: nothing listens, so nothing is billed for it. */
  quiet?: boolean;
  /** The bot's voice, one of the provider's voices(), or none for the provider's own. */
  voice?: string;
};
export type Line = {
  /** Rings the owner. Resolves once they answer, or don't. */
  place(call: Place): Promise<{ outcome: Outcome; error?: string }>;
  /** Speaks this after whatever is playing or waiting, in a voice of its own on phone's voice loop, as a room's bots do. */
  say(text: string, voice?: string, who?: string): void;
  /** Stops what's playing, and drops what's waiting. */
  stop(): void;
  /** Ends the call once what's waiting has played, or at once with `now`. */
  hangUp(now?: boolean): Promise<void>;
  /** Whether something is playing or waiting to. */
  readonly speaking: boolean;
  /** Phone's voice loop with a listener that ends the owner's turns itself: the call holds nothing more. */
  readonly ends?: boolean;
};
/** A voice a bot may pick, shown under its group. */
export type Voice = { value: string; label: string; group?: string };
export type Provider = {
  /** Its name in phone's lists, such as "SignalWire". */
  label: string;
  /** Its own settings still to fill in, by name. Empty when it's ready. */
  missing(): string[];
  /** The voices a bot may pick, or none. */
  voices(): Voice[];
  /** A line for one call. Ending a call a restart left up is the provider's own. */
  line(events: LineEvents): Line;
};
