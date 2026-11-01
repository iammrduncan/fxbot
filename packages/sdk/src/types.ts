// What the agent side and the client share. No imports, so a browser bundle can take them.

export type Fields = { name: string; instructions: string; model: string };
// `preview` is the start of the latest reply, for a list of bots.
export type Profile = Fields & { id: string; sessionId: string | null; preview?: string };
// A bot with no model of its own uses `defaultModel`.
export type Settings = { defaultModel: string };

// A file sent with a message: `data` is base64 on the way in, and `url` is set for an image fxbot keeps.
export type Upload = { name: string; type: string; url?: string; data?: string };
// What a message sends. The same `messageId` again reaches the same turn and runs nothing new.
export type Message = { text: string; messageId: string; files?: Upload[] };
// libfx's stream leaves out a prompt that is not plain text, so fxbot keeps what such a message sent.
export type Sent = { input: string; files: Upload[] };

// One line of a bot's NDJSON stream, as far as fxbot reads it. libfx writes more types and fields.
export type StreamLine = {
  type: string;
  messageId?: string;
  input?: string;
  files?: Upload[];
  delta?: string;
  stopReason?: string;
  error?: { message: string };
  cursor?: number;
  epoch?: number;
};
