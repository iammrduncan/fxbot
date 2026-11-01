# MCP servers

Add any remote MCP server to fxbot, by its URL or from [add-ons](addons.md). fxbot connects from the server, signs in with OAuth when the server asks, and gives the server's tools to the bots that use it. A server can also serve [skills](skills.md). Local MCP servers, which run code on this machine, come in [plugins](plugins.md), and plugins can bundle remote servers too.

The hard part is signing in. fxbot runs on a tailnet or on localhost, with no public address, and the project should not have to register its own OAuth client with every MCP provider. This page answers that: [section 2](#2-key-takeaways) in short, [OAuth sign-in](#oauth-sign-in) in full.

Status: planned, not built. Research and plan only. It needs the add-ons tables and should land with or after [permissions](permissions.md).

## 1. Research

These are read from specs, source, docs, and read-only requests, as of November 2026. Paths are relative to each repository.

**The MCP spec** (current revision 2026-07-28, [versioning](https://modelcontextprotocol.io/specification/versioning))
- **[Client registration](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/client-registration).** Clients that support all options SHOULD try them in this order:
  1. A pre-registered client: one the client ships, or one the user "registered … themselves" and enters in a UI.
  2. A Client ID Metadata Document (CIMD), when the authorization server advertises `client_id_metadata_document_supported`.
  3. Dynamic Client Registration (DCR, RFC 7591) "as a fallback".
  4. Asking the user to enter client information.
- **CIMD.** It is SHOULD. The `client_id` is an HTTPS URL with a path, pointing at a JSON document with `client_id`, `client_name`, and `redirect_uris`. The authorization server fetches it and MUST validate redirect URIs against it.
- **DCR.** It "is deprecated" and kept "for backwards compatibility".
  - Clients MUST send an `application_type`. Use `"native"` for "locally-hosted web applications accessed via `localhost`", and `"web"` for "remote browser-based applications served from a non-local host".
  - Credentials from DCR or pre-registration are bound to the authorization server's `issuer`, and MUST be registered again when it changes.
- **Flow.** Discovery uses RFC 9728 protected resource metadata (the `resource_metadata` in a 401's `WWW-Authenticate`), then RFC 8414 or OIDC discovery. The `resource` parameter (RFC 8707) and PKCE S256 are required. Redirect URIs are localhost or HTTPS.
- **No device flow.** The authorization pages have none.
- **[Lifecycle](https://modelcontextprotocol.io/specification/2026-07-28/basic/lifecycle).** Servers "MUST implement `server/discover`", and requests carry their own `_meta` in place of an `initialize` session. Clients that support both eras probe with `server/discover`, and fall back to `initialize` for servers on 2025-11-25 and earlier.
- **Skills.** The `io.modelcontextprotocol/skills` extension lets a server serve skills through `skills/list`, `skills/get`, and `resources/read` ([skills](skills.md#1-research)).
- **[Security best practices](https://modelcontextprotocol.io/specification/2026-07-28/basic/security_best_practices).**
  - Discovery makes the client fetch URLs that a server names (`resource_metadata`, authorization servers), so a client on a server must guard against SSRF.
  - Script injected into a web client can run commands through a proxy that starts local servers. That matters for [plugins](plugins.md).

**What servers support** (each server's metadata, fetched read-only; nothing registered)
- **Both mechanisms.** Of 31 endpoints that need auth, 24 support DCR, and 14 of those also advertise CIMD: Notion, Linear, Sentry, Cloudflare, Vercel, Canva, monday, Neon, Hugging Face, PostHog, Context7, Exa, Airtable, and Todoist.
  - Checked again here: `mcp.linear.app` and `mcp.notion.com` list both `registration_endpoint` and `client_id_metadata_document_supported: true`, with PKCE S256.
- **Neither.** GitHub ("Dynamic Client Registration is NOT supported", [host integration](https://github.com/github/github-mcp-server/blob/main/docs/host-integration.md)), Slack, Asana v2, HubSpot, Box, and Google BigQuery and Maps. These take a token, or an OAuth app the user registers.
  - GitHub's endpoint does answer 401 with `resource_metadata`, checked here.
- **Restrictions.**
  - Figma admits only clients in its catalog, and Vercel only "reviewed and approved" clients.
  - Atlassian accepts redirect origins from an allowlist that defaults to localhost, and serves no RFC 9728 metadata.
- **Static tokens.** GitHub takes a personal access token, Stripe an agent key, Linear "API keys directly in the `Authorization: Bearer`" header, and Supabase a personal token. Registry entries mark secret headers with `isSecret` ([add-ons](addons.md)).

**libfx 0.0.16** (`libfx/mcp`, installed)
- `createMcpAdapter(client, { prefix, serverName, resources, prompts })` resolves to `{ tools, instructions, close }`, built from "a host-owned MCP client". Transport, authentication, elicitation, and cleanup stay with the host.
- Every adapted tool has `idempotent: false` ("set it to `true` on a tool known to be safe to run twice").
- It calls `client.callTool(params, undefined, { signal })`: the v1 SDK's shape.
- An agent's tools are fixed when `createFxAgent` runs. `agent.session()` varies only `context`, `model`, and `instructions`.

**The MCP TypeScript SDK**
- **v1 (`@modelcontextprotocol/sdk` 1.32).** It has client OAuth through `OAuthClientProvider`, with `clientMetadataUrl` for CIMD and `saveTokens`. But it depends on express, hono, cors, and more.
- **v2 (`@modelcontextprotocol/client`).** It is client-only: zod, jose, pkce-challenge, eventsource, and cross-spawn. 2.4.0, from 2026-10-23, ships the skills extension.
  - Its `callTool(params, options)` needs a 3-line shim for libfx's call.
  - opencode uses its `auth()` and `OAuthClientProvider`.

**References**
- **fx CLI.**
  - Order: pre-registered, then CIMD ("None until fx hosts one"), then DCR, which registers `native` with `http://127.0.0.1:<free port>/callback` (`src/mcp/auth/client.zig`).
  - `fx mcp login --no-browser` takes a pasted address. Tokens go to the Keychain or `~/.fx/mcp-credentials/`.
  - Its only fixed client id is its own Slack app's.
- **Claude Code** ([MCP docs](https://code.claude.com/docs/en/mcp)).
  - Chooses CIMD or DCR on its own, with a random localhost port or `--callback-port`.
  - Takes `--client-id` and `--client-secret`, and falls back to a pasted address (`--no-browser`).
  - It publishes one CIMD document for every install, fetched here: `https://claude.ai/oauth/claude-code-client-metadata`, with `redirect_uris` `http://localhost/callback` and `http://127.0.0.1/callback`, and `token_endpoint_auth_method: none`.
- **opencode.**
  - Order: a configured `client_id`, then CIMD, then DCR. It listens on a random 127.0.0.1 port unless `callback_port` is set, and reuses an earlier DCR client (`packages/core/src/mcp/oauth.ts`).
  - Its one document, `https://opencode.ai/oauth/opencode/client.json`, adds `http://127.0.0.1/mcp/oauth/callback`.
- **eve** (`docs/connections/index.mdx`).
  - Remote connections only. Vercel Connect stores tokens off the machine.
  - `defineInteractiveAuthorization` leaves storage to the host.
  - Each connection has `tools.allow`, `tools.block`, and `approval` policies.
- **openbot and OpenDots.** openbot takes only https MCP URLs and checks every call against grants. In OpenDots, tools without `readOnlyHint` default to "Ask first".
- **Borrowing a client.** Using another app's published client id is the impersonation that the CIMD security notes warn about.

## 2. Key takeaways

1. **fxbot never registers itself with a provider ahead of time.** No mechanism needs it:
   - With DCR, each install registers itself with each authorization server, and the server issues the id.
   - With CIMD, the client id is one public document the project hosts once.
   - Where neither exists, the user registers their own OAuth app, as the spec's pre-registration allows.
2. **Where the browser is decides the redirect.** The browser is usually a phone on the tailnet: not on the server's loopback, but able to reach `https://<machine>.<tailnet>.ts.net`.
   - A redirect to that origin lands on fxbot with nothing to paste. Only a per-install registration can name it, which means DCR or the user's own app; a shared CIMD document cannot.
   - Loopback redirects work with one shared CIMD document, but a phone has to paste the address of the page that failed to load.
3. **Order of attempts:**
   1. The user's own client, when they entered one.
   2. DCR with the tailnet callback, when `FXBOT_PUBLIC_URL` is set. It covers most servers today, and works without a paste on a phone.
   3. CIMD with loopback redirects: captured directly when the browser runs on the server, pasted otherwise.
   4. DCR `native` with loopback.
   5. A static token.
   - This puts DCR ahead of the spec's SHOULD order, because CIMD cannot name a per-install callback. CIMD carries on when DCR goes away (the SDK's notes give 2027-07-28 as the earliest).
4. **Sign-in runs on the server** as an attempt the page polls, as in provider logins. The verifier and tokens never reach the page, and tokens are sealed.
5. **libfx only adapts a client.** fxbot owns the transport, sign-in, reconnects, and shutdown, through `@modelcontextprotocol/client`, whose `auth()` does discovery, PKCE, DCR, and CIMD.
6. **Tools are fixed per agent** (libfx). Adding, removing, or trusting a server rebuilds the provider agents. Whether a bot uses a server is decided inside each tool's `execute()` ([add-ons: bots](addons.md#bots-and-add-ons)).
7. **MCP tools are untrusted** and not safe to run twice. Until [permissions](permissions.md) ships, a server starts with its read-only tools only.
8. **Adding a URL makes the server fetch it.** fxbot takes HTTPS only, and refuses private and tailnet addresses unless the user allows one.

## 3. Implementation

### Adding a server

- From [add-ons](addons.md): a registry entry's `remotes` (`streamable-http` or `sse`, a URL, `headers` marked `isSecret`). Or "Add by URL".
- The SDK checks the URL, HTTPS and not private (see Security). Then it probes the server without credentials, with `server/discover`, or `initialize` for older servers. The add-on page shows what the probe finds, including whether the server serves skills:
  - **It answers:** no auth.
  - **401 with `resource_metadata`:** OAuth.
  - **Secret headers in the registry entry:** the page asks for their values in password fields, and they are sealed.
  - **Otherwise:** the user can add a header by hand, such as `Authorization: Bearer <token>`.
- The record is an add-on of kind `mcp` ([add-ons: Postgres](addons.md#postgres)) holding:
  - `url` and `transport`
  - header names only
  - `auth` (`none`, `headers`, or `oauth`)
  - `trust` (`read-only` or `all`)
  - `source` (a registry name and version, or "url")
  - `status`

### OAuth sign-in

`packages/sdk/src/mcp.ts` implements the SDK's `OAuthClientProvider` against fxbot's store. Instead of opening a browser, it hands the authorization URL to the page.

1. `POST /api/addons/:id/sign-in`. The SDK reads the protected resource metadata, then the authorization server's, and picks a client in this order:
   1. **The user's own client,** if one was entered for this add-on: a client id, and a secret if the server issued one.
   2. **DCR with the tailnet callback,** when the server has a `registration_endpoint` and `FXBOT_PUBLIC_URL` is set: `application_type: "web"`, `redirect_uris: ["<FXBOT_PUBLIC_URL>/api/oauth/callback"]`, `client_name: "fxbot"`, `token_endpoint_auth_method: "none"`.
   3. **CIMD,** when the server advertises it: `client_id` is the project's document (see below), and the redirect is loopback.
   4. **DCR `native`** with `http://127.0.0.1:<port>/callback`.
   5. **None of these:** the page asks for the user's own client id, and shows the callback URL to register.
   - Registered clients are sealed and keyed by `issuer` and redirect URI, and registered again when either changes.
2. The SDK builds the authorization URL with PKCE S256, a `state`, the `resource` (RFC 8707), and scopes from the metadata.
   - The verifier stays in the server's memory with the attempt.
   - The page gets `{ id, url, mode: "redirect" | "paste", expiresAt }`. Attempts expire after 10 minutes, and a new one cancels the old.
3. **Redirect mode.** The page opens `url` in a new tab. After consent, the authorization server sends the browser to `<FXBOT_PUBLIC_URL>/api/oauth/callback?code&state&iss`.
   - The server matches `state`, checks `iss` (RFC 9207), and exchanges the code with the verifier and `resource`.
   - It seals the tokens and answers with a short "Connected. You can close this tab."
4. **Paste mode** (loopback redirects):
   - **Browser on the server:** the API server answers the loopback `/callback` itself. The CIMD document's loopback URIs have no port, and RFC 8252 says a server must allow any.
   - **Browser on a phone:** the page asks for the address of the page that failed to load, and the server reads `code` and `state` from it, as libfx's ChatGPT sign-in does.
5. The page polls `GET /api/oauth/attempts/:id` until the status is `done` or `failed`. Failures carry the server's reason.
6. **Refresh.** Tokens are refreshed before expiry and once after a 401, under a lock per add-on, as in provider logins. When a refresh fails, the add-on shows "Sign in again".

**The CIMD document.** One static file on the project's public site (GitHub Pages; the owner publishes it):

```json
{
  "client_id": "https://<project pages>/oauth/client.json",
  "client_name": "fxbot",
  "client_uri": "https://<project pages>/",
  "redirect_uris": ["http://127.0.0.1/callback", "http://localhost/callback", "http://127.0.0.1:8787/callback"],
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none"
}
```

The fixed-port URI is for servers that match ports exactly. Until the document exists, fxbot skips CIMD and uses the other paths.

### Tools for bots

- Each enabled server gets one client: Streamable HTTP, or SSE for `sse` remotes. It goes through a shim that gives libfx the `callTool(params, undefined, { signal })` call, then into `createMcpAdapter(client, { prefix: "<slug>_", serverName })`.
- Each adapted tool's `execute()` is wrapped, in this order:
  1. Is this server on for the bot in `context.bot`? If not: "This tool is off for this bot."
  2. With trust `read-only`, a tool without `readOnlyHint: true` answers "Allow all of this server's tools in Add-ons first."
  3. The [permissions](permissions.md) check, when that phase ships.
- `idempotent` stays `false`, except for tools with `readOnlyHint: true` and `idempotentHint: true`.
- The adapter's `instructions` go into the instructions of bots that use the server.
- **Skills.** When the server declares the skills extension, its skills join the add-on, labelled with the server, and bots read them through it ([skills](skills.md#adding-skills)).
- **Changes.** Adding, removing, enabling, or trusting a server rebuilds every provider agent with the new tool list, since libfx fixes tools when an agent is made. Rebuilding closes each agent first, which waits for its running turns.
- **Connections.** A dropped connection is retried with backoff. Its tools then fail with "<server> is unreachable", and the add-on shows the error.

### API, SDK, and client

| Route | SDK call |
| --- | --- |
| `POST /api/addons/preview` with `{ url \| registry }` | `addons.preview(ref)`: probes the server for the add-on page |
| `PUT /api/addons/:id/secrets` | `addons.setSecrets(id, { headers?, clientId?, clientSecret? })`: write-only |
| `POST /api/addons/:id/sign-in` | `oauth.start(id)` |
| `GET /api/oauth/attempts/:id` | `oauth.get(id)` |
| `POST /api/oauth/attempts/:id/paste` | `oauth.paste(id, address)` |
| `GET /api/oauth/callback` | `oauth.callback(query)`: the redirect target, answered with a small HTML page |

Adding, listing, enabling, trusting, and removing are the [add-ons](addons.md#api-sdk-and-client) routes. The callback is the one route that a browser reaches from another site, so it does nothing without a matching, unexpired `state`.

### Where the code goes

- **`packages/sdk`**
  - `mcp.ts`: clients, the provider adapter for OAuth, attempts, and tool wrapping.
  - The add-on records it needs (see [add-ons](addons.md)).
  - `index.ts` passes MCP tools into provider agents.
- **`packages/server`:** the routes above, plus `FXBOT_PUBLIC_URL` (a non-secret origin, read from the environment, never from a `Host` header).
- **`packages/ui`:** the add form, the secret fields, the sign-in dialog (open a tab, or paste), and per-server trust and status.
- **Dependency:** `@modelcontextprotocol/client` 2.4.0 or later, for the skills extension, pinned exactly.

### Security

- **Credentials.** Tokens, registered clients, and secret headers are sealed (`secrets.ts`) and never returned. The SDK sends a token only to the MCP server it was issued for.
- **Sign-in checks.** PKCE, `state`, `iss`, and `resource` are checked on every sign-in, and the callback rejects unknown or used states.
- **SSRF.** fxbot takes HTTPS only. It refuses loopback, private, link-local, `100.64.0.0/10`, and `*.ts.net` addresses unless the add-on says "allow local address", which the user sets after a warning. The address is checked again after DNS resolution, and the same check covers every URL that discovery and sign-in fetch.
- **Untrusted tools.** Tool results can carry prompt injection. Tools start read-only, and the [permissions](permissions.md) phase adds ask, auto, and yolo.
- **The tailnet name.** `FXBOT_PUBLIC_URL`'s MagicDNS name is already public in Certificate Transparency logs, so naming it in a registration reveals nothing new. Renaming the machine means registering again.
- **No borrowed clients.** fxbot never uses fx's, Claude Code's, or opencode's client ids.

### Size

About 450 lines:

| Part | Lines |
| --- | --- |
| `mcp.ts` | about 220 |
| Server routes | about 40 |
| Client | about 25 |
| UI | about 170 |

Plus one dependency. The core is already well past its stop line, so this phase needs that budget decided first.

## 4. Checklist

Checks use the mock Chat Completions server, a mock MCP server (Streamable HTTP, built on `@modelcontextprotocol/server` in the scratchpad), and a mock authorization server. The mock serves RFC 9728 and RFC 8414 metadata, DCR, a CIMD fetch, and PKCE. No real accounts.

**M1. Connect**
- [ ] A server with no auth: added by URL, tools listed with the prefix, and a bot calls one.
- [ ] A server with a secret header: the value is sealed, sent on every request, and never returned. A registry entry's `isSecret` headers become password fields.
- [ ] An `http:` URL, or a loopback, private, or `*.ts.net` address, is refused unless allowed. A hostname that resolves to a private address is refused too.

**M2. OAuth**
- [ ] DCR with the tailnet callback: registration sends `application_type: "web"` and the callback URI. The browser lands on `/api/oauth/callback`, and the tokens are sealed.
- [ ] CIMD: the mock fetches the document, and the loopback redirect is captured directly. With the browser elsewhere, the pasted address finishes the sign-in.
- [ ] A user's own client id and secret are used first when present.
- [ ] Bad `state`, a missing PKCE method, a wrong `iss`, or an expired attempt all fail cleanly.
- [ ] A refresh before expiry and after a 401. Two refreshes at once spend one refresh token. A changed `issuer` registers again.

**M3. Tools for bots**
- [ ] Turning a server off for a bot makes its tools refuse. Another bot still uses them.
- [ ] With trust `read-only`, only `readOnlyHint` tools run. With `all`, every tool runs.
- [ ] Adding or removing a server rebuilds the agents, and a running turn finishes first.
- [ ] A dropped connection retries with backoff, and its tools fail with the reason.

**M4. UI and docs**
- [ ] Playwright: add by URL, sign in through the mock in a second tab, see the tools, call one from a chat, and paste-mode on a phone viewport.
- [ ] README (`FXBOT_PUBLIC_URL`), the SDK README, and `npm run typecheck`, `npm run build`, `git diff --check`.

**The human runs these:** publish the CIMD document. Then sign in to Linear or Notion (DCR and CIMD), GitHub with a personal token, and one Atlassian site, where an admin may need to allow the callback origin.

## 5. Open questions

Each has a default.

1. **Callback origin.** Is `FXBOT_PUBLIC_URL` set by hand, or read from `tailscale status`? *Default:* by hand in `.env`. Without it, sign-in uses CIMD or DCR with loopback, and a phone pastes.
2. **The CIMD document.** Where does the public document live? *Default:* the project's GitHub Pages site, whose domain also gives fxbot's plugin namespace ([plugins](plugins.md#5-open-questions)). The owner publishes it.
3. **Trust before permissions.** *Default:* read-only tools only, until the user allows all of a server's tools.
4. **Per-bot default.** *Default:* a new server is on for every bot. See [add-ons](addons.md#bots-and-add-ons) for why every bot still sees its tool list.
5. **Private addresses.** *Default:* refused, with an "allow local address" switch per add-on.
6. **Elicitation, sampling, resources, and prompts.** *Default:* none in this phase, apart from the skill files that the skills extension serves through `resources/read`. libfx can turn resources and prompts into instructions later.
