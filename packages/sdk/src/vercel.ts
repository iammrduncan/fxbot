import { withoutSecrets } from "./secrets.ts";

// Sign in with a Vercel account by device code (RFC 8628), for AI Gateway billed to one of the account's teams.
// The endpoints come from https://vercel.com/.well-known/openid-configuration.
type Fetch = typeof fetch;
export type VercelCredentials = { accessToken: string; refreshToken?: string; expiresAt?: number };
export type VercelDevice = { verificationUrl: string; userCode: string; deviceCode: string; intervalMs: number; expiresAt: number };

const deviceUrl = "https://api.vercel.com/login/oauth/device-authorization";
const tokenUrl = "https://api.vercel.com/login/oauth/token";
const form = (fields: Record<string, string>) => ({
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
  body: new URLSearchParams(fields).toString(),
});
const credentials = (body: any, old?: VercelCredentials): VercelCredentials => ({
  accessToken: body.access_token,
  refreshToken: body.refresh_token ?? old?.refreshToken,
  ...(Number.isFinite(body.expires_in) ? { expiresAt: Date.now() + body.expires_in * 1000 } : {}),
});

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => (clearTimeout(timer), reject(signal.reason)), { once: true });
  });

export async function startDeviceSignIn(clientId: string, fetch: Fetch): Promise<VercelDevice> {
  const response = await fetch(deviceUrl, form({ client_id: clientId, scope: "openid offline_access" }));
  if (!response.ok) throw new Error(`Vercel did not issue a device code (HTTP ${response.status}).`);
  const body = await response.json();
  // Shown to the user as a link, so it must be Vercel's own page.
  const url = new URL(body.verification_uri_complete ?? body.verification_uri);
  if (url.protocol !== "https:" || !(url.hostname === "vercel.com" || url.hostname.endsWith(".vercel.com")))
    throw new Error("Vercel answered with a sign-in address that is not on vercel.com.");
  return {
    verificationUrl: url.href,
    userCode: body.user_code,
    deviceCode: body.device_code,
    intervalMs: (Number(body.interval) || 5) * 1000,
    expiresAt: Date.now() + (Number(body.expires_in) || 900) * 1000,
  };
}

// Polls at Vercel's interval, 5 seconds slower after each `slow_down`, until the user enters the code.
export async function completeDeviceSignIn(device: VercelDevice, clientId: string, fetch: Fetch, signal?: AbortSignal): Promise<VercelCredentials> {
  let interval = device.intervalMs;
  for (;;) {
    await wait(interval, signal);
    if (Date.now() > device.expiresAt) throw new Error("The code expired before it was entered. Start again.");
    const grant = { grant_type: "urn:ietf:params:oauth:grant-type:device_code", device_code: device.deviceCode, client_id: clientId };
    const response = await fetch(tokenUrl, { ...form(grant), signal });
    const body = await response.json().catch(() => ({}));
    if (response.ok) return credentials(body);
    if (body.error === "authorization_pending") continue;
    if (body.error === "slow_down") interval += 5000;
    else if (body.error === "expired_token") throw new Error("The code expired before it was entered. Start again.");
    else if (body.error === "access_denied") throw new Error("The sign-in was declined at Vercel.");
    else throw new Error(`Vercel could not finish the sign-in (HTTP ${response.status}).`);
  }
}

export async function refresh(old: VercelCredentials, clientId: string, fetch: Fetch): Promise<VercelCredentials> {
  if (!old.refreshToken) throw new Error("This Vercel sign-in cannot be renewed. Sign in again.");
  const response = await fetch(tokenUrl, form({ grant_type: "refresh_token", refresh_token: old.refreshToken, client_id: clientId }));
  if (!response.ok) throw new Error(`Vercel did not renew the sign-in (HTTP ${response.status}). Sign in again.`);
  return credentials(await response.json(), old);
}

export async function teams(accessToken: string, fetch: Fetch) {
  const response = await fetch("https://api.vercel.com/v2/teams", { headers: { authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw Object.assign(new Error(`Vercel did not list the account's teams (HTTP ${response.status}).`), { status: 502 });
  return ((await response.json()).teams ?? []).map((team: any) => ({ id: team.id as string, name: (team.name ?? team.slug) as string }));
}

// libfx sends its placeholder key, and this puts the account's token and team in its place, masking the tokens if an
// error body quotes them.
export function vercelFetch(access: () => Promise<{ credentials: VercelCredentials; teamId: string | null }>, fetch: Fetch): Fetch {
  return async (input, init = {}) => {
    const { credentials, teamId } = await access();
    if (!teamId) throw new Error("Pick a Vercel team for this provider in Settings.");
    const headers = new Headers(init.headers);
    headers.set("authorization", `Bearer ${credentials.accessToken}`);
    headers.set("x-vercel-ai-gateway-team", teamId);
    return withoutSecrets(await fetch(input, { ...init, headers }), [credentials.accessToken, credentials.refreshToken]);
  };
}
