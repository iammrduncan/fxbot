// What a carrier plugin offers phone (docs/_completed/phases/phone-v2.md, part 2): a SIP account, and nothing more. A carrier names
// phone under needs, with { "line": 3 }, and offers a Provider with fx.provide. phone signs in to the account with its
// own softphone (sip.ts) and rings the owner's phone from it, and everything else about a call is phone's, the same as a
// call in the app: the voice, the listening, the conversation, and its rules. A call on the owner's phone is a call in
// the app whose audio goes over their phone instead.
//
// Lines 1 and 2, where the carrier spoke and listened itself, ended with phone 0.2.0.

export type Outcome = "answered" | "voicemail" | "missed" | "busy" | "declined" | "failed";
/** A carrier's SIP account: the domain to sign in at, a user and password, and the number calls come from. */
export type SipAccount = { domain: string; username: string; password: string; from: string };
export type Provider = {
  /** Its name in phone's lists, such as "SignalWire". */
  label: string;
  /** Its own settings still to fill in, by name. Empty when it's ready. */
  missing(): string[];
  /** Its SIP account, or null while what it needs is missing. A failure throws, in words for the owner. */
  sip(): Promise<SipAccount | null>;
};

// Inside phone: what a call's line, the voice loop (voice.ts), tells the conversation (call.ts), and what it does.
export type LineEvents = {
  /** The owner finished something they said. phone holds it for the owner's pause setting, joining what follows sooner. */
  heard: (text: string) => void;
  /** The words of what the owner is saying so far, as they come. */
  hearing?: (text: string) => void;
  /** Those words were played to the end. */
  played: (text: string) => void;
  /** The call is over, and why: "hung up" when the owner or the bot hung up, or else what ended it. */
  ended: (how: string) => void;
  /** The owner's voice has sounded this long, in ms, with no words yet, from a listener that gives none as they come. */
  voice?: (ms: number) => void;
};
export type Place = {
  /** The owner's confirmed number, for a call on their phone. */
  to: string;
  /** Played the moment the owner answers. */
  greeting: string;
  /** A call that only speaks, such as the code that confirms a number: nothing listens, so nothing is billed for it. */
  quiet?: boolean;
  /** The bot's voice. */
  voice?: string;
};
export type Line = {
  /** Rings the owner, or opens the call in the app. Resolves once they answer, or don't. */
  place(call: Place): Promise<{ outcome: Outcome; error?: string }>;
  /** Speaks this after whatever is playing or waiting, in a voice of its own, as a room's bots do. */
  say(text: string, voice?: string, who?: string): void;
  /** Stops what's playing, and drops what's waiting. */
  stop(): void;
  /** Ends the call once what's waiting has played, or at once with `now`. */
  hangUp(now?: boolean): Promise<void>;
  /** Whether something is playing or waiting to. */
  readonly speaking: boolean;
  /** A listener that ends the owner's turns itself: the call holds nothing more. */
  readonly ends?: boolean;
};
