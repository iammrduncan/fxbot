import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import postgres from "postgres";
import type { Sql } from "./store.ts";

// AES-256-GCM with a fresh 12-byte nonce on every write, and the provider id bound in as AAD, so a sealed value
// copied onto another provider's row fails to open. Postgres stores only nonce ‖ tag ‖ ciphertext and never sees
// the key: no pgcrypto, whose key would travel inside SQL and could reach Postgres's logs.
export function seal(key: Buffer, id: string, value: unknown): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv).setAAD(Buffer.from(id));
  const data = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]);
}

export function unseal(key: Buffer, id: string, sealed: Buffer): unknown {
  const decipher = createDecipheriv("aes-256-gcm", key, sealed.subarray(0, 12)).setAAD(Buffer.from(id));
  decipher.setAuthTag(sealed.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(sealed.subarray(28)), decipher.final()]).toString("utf8"));
}

// The key file's contents: 32 random bytes in base64.
export function readKey(text: string) {
  const key = Buffer.from(text.trim(), "base64");
  if (key.length !== 32) throw new Error("The secret key must be 32 random bytes in base64, such as `openssl rand -base64 32`.");
  return key;
}

// A failed response with `secrets` masked, for requests whose credentials fxbot adds itself. Some servers quote a bad
// key back in their error, and libfx shows and saves error details, but masks only the credentials it adds.
export async function withoutSecrets(response: Response, secrets: (string | undefined)[]) {
  if (response.ok) return response;
  let body = await response.text();
  for (const secret of secrets) if (secret) body = body.split(secret).join("*".repeat(8));
  return new Response(body, { status: response.status, statusText: response.statusText, headers: { "content-type": response.headers.get("content-type") ?? "text/plain" } });
}

const unopenable = "Cannot open this provider's secret. Sign in again, or check FXBOT_SECRET_KEY_FILE.";

// Opened secrets stay in memory, so libfx's credentials() calls cost no query. Every write goes through here.
export function createSecrets(sql: Sql, key: Buffer) {
  const cache = new Map<string, unknown>();
  return {
    async get<T>(id: string): Promise<T | undefined> {
      if (cache.has(id)) return cache.get(id) as T;
      const row = (await sql<{ sealed: Buffer }[]>`select sealed from secrets where provider_id = ${id}`)[0];
      if (!row) return undefined;
      let value: unknown;
      try {
        value = unseal(key, id, row.sealed);
      } catch {
        throw new Error(unopenable);
      }
      cache.set(id, value);
      return value as T;
    },
    async put(id: string, value: unknown, tx: Sql = sql) {
      await tx`insert into secrets (provider_id, sealed) values (${id}, ${seal(key, id, value)})
        on conflict (provider_id) do update set sealed = excluded.sealed, updated_at = now()`;
      cache.set(id, value);
    },
    // Rows go with their provider, by cascade.
    forget: (id: string) => cache.delete(id),
    has: async () => new Set((await sql<{ providerId: string }[]>`select provider_id from secrets`).map((row) => row.providerId)),
  };
}

// Seals every secret again under a new key, in one transaction. Run it with the server stopped.
export async function rotateSecrets({ databaseUrl, from, to }: { databaseUrl: string; from: Buffer; to: Buffer }) {
  const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  try {
    return await sql.begin(async (tx) => {
      const rows = await tx<{ provider_id: string; sealed: Buffer }[]>`select provider_id, sealed from secrets for update`;
      for (const { provider_id: id, sealed } of rows)
        await tx`update secrets set sealed = ${seal(to, id, unseal(from, id, sealed))}, updated_at = now() where provider_id = ${id}`;
      return rows.length;
    });
  } finally {
    await sql.end({ timeout: 5 });
  }
}
