// What a provider plugin offers phone (docs/_completed/phases/phone.md, The contract). A provider names phone under
// needs, with { "line": 1 }, and offers a Provider with fx.provide. phone holds the call and its conversation; the
// provider holds the connection to its service, speaks the bot's words, and says what the owner said, as text both ways.

export type Outcome = "answered" | "voicemail" | "missed" | "busy" | "declined" | "failed";
/** What the line tells the call. */
export type LineEvents = {
  /** The owner finished something they said. */
  heard: (text: string) => void;
  /** The owner cut in while the bot spoke: what was playing stopped, and what was waiting was dropped. */
  interrupted: () => void;
  /** Those words were played to the end. */
  played: (text: string) => void;
  /** The call is over, and why: "hung up" when the owner or the bot hung up, or else what ended it. */
  ended: (how: string) => void;
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
  /** Speaks this after whatever is playing or waiting. */
  say(text: string): void;
  /** Stops what's playing, and drops what's waiting. */
  stop(): void;
  /** Ends the call once what's waiting has played, or at once with `now`. */
  hangUp(now?: boolean): Promise<void>;
  /** Whether something is playing or waiting to. */
  readonly speaking: boolean;
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
