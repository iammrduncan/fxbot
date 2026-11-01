import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Fields, Profile, Sent, Settings } from "./types.ts";

export const isId = (id: string) => /^[0-9a-f]{12}$/.test(id);

// Sync calls on purpose: a read-modify-write never interleaves with another request.
function read(path: string) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

// Written to a temporary file and renamed, so a crash never leaves half a file.
function write<T>(path: string, value: T): T {
  writeFileSync(`${path}.tmp`, JSON.stringify(value, null, 2) + "\n");
  renameSync(`${path}.tmp`, path);
  return value;
}

// fxbot's own files: profiles/<id>.json, settings.json, and uploads/<id>/ for each bot's messages with files,
// with one record per message and each image once, named by its SHA-256. libfx keeps sessions/ beside them.
export function createStore(dataDir: string) {
  const dir = join(dataDir, "profiles");
  mkdirSync(dir, { recursive: true });
  const file = (id: string) => join(dir, `${id}.json`);
  const uploads = (id: string) => join(dataDir, "uploads", id);
  const settingsFile = join(dataDir, "settings.json");
  const get = (id: string): Profile | null => read(file(id));
  const save = (profile: Profile) => write(file(profile.id), profile);
  return {
    get,
    save,
    list: (): Profile[] =>
      readdirSync(dir)
        .filter((name) => isId(name.replace(/\.json$/, "")))
        .map((name) => get(name.slice(0, 12))!)
        .sort((a, b) => a.name.localeCompare(b.name)),
    create: (fields: Fields) => save({ id: randomBytes(6).toString("hex"), ...fields, sessionId: null }),
    remove(id: string) {
      rmSync(file(id));
      rmSync(uploads(id), { recursive: true, force: true });
    },
    getSettings: (): Settings => ({ defaultModel: "", ...read(settingsFile) }),
    saveSettings: (settings: Settings) => write(settingsFile, settings),
    getSent: (id: string, messageId: string): Sent | null => read(join(uploads(id), `${messageId}.json`)),
    saveSent(id: string, messageId: string, sent: Sent) {
      mkdirSync(uploads(id), { recursive: true });
      write(join(uploads(id), `${messageId}.json`), sent);
    },
    saveImage(id: string, bytes: Buffer, ext: string) {
      const name = `${createHash("sha256").update(bytes).digest("hex")}.${ext}`;
      mkdirSync(uploads(id), { recursive: true });
      writeFileSync(join(uploads(id), name), bytes);
      return name;
    },
    readImage(id: string, name: string) {
      try {
        return readFileSync(join(uploads(id), name));
      } catch {
        return null;
      }
    },
  };
}
