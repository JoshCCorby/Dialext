# Plan: local connectors, Dialext identity and a service seam

Status (24 September 2026): **phases B, C and A are implemented and committed** (`bed4df2`,
`051bf80`, `d9a2c89`); live Granola acceptance completed with zero accessible meetings (see
`HANDOFF.md`). Milestone 7's template, research-tool, native-calendar and editor-query pass is
also complete. Two
departures from the text below: the local connector row is a new component
(`imports/local-connector.tsx`) used by the personal screen only, because the Anarlog screen is
unreachable behind its flag; and the client version sent to providers is the importer crate's
version. Decisions: the name is `Dialext`; hosted rows stay hidden without a Dialext server;
background sync every five minutes is kept.

## Joshua's decisions (23 September 2026)

- Open the importers that run on this Mac (the MCP and CLI connectors) as ordinary features,
  with no Anarlog sign-in.
- Other services must see **Dialext**, not Anarlog.
- Hosted connectors (Zoom, Teams, Notion, Fathom, Google Meet, Webex) and Google/Outlook
  calendar must make **no call to Anarlog's servers**. They are not deleted: they move behind a
  seam that a Dialext server can fill later, so friends who use Dialext get the same features.

## What the code does today

There are three kinds of connection (`apps/desktop/src/imports/providers.ts`):

| Kind | Providers | Where it runs |
| --- | --- | --- |
| `mcp-oauth` | Granola, Circleback, Fireflies, Krisp, Read AI, Fellow, Tactiq, Jiminny, Pocket | On this Mac. `plugins/importer/src/connected_mcp.rs` registers a client with the provider's own MCP server, signs in through the browser with a `127.0.0.1` callback, and syncs directly. |
| `cli` | Plaud | On this Mac. `connected_cli.rs` drives Plaud's own CLI. |
| `nango-oauth` | Zoom, Microsoft Teams, Notion, Fathom, Google Meet, Webex | Through Anarlog's server: `env.VITE_API_URL` and the web app at `env.VITE_APP_URL`, with Anarlog account headers. |

Connection tokens are stored in the macOS Keychain through `store2` secrets. The Keychain
service name comes from the app identifier (`app.dialext.prototype`), so that is already
Dialext's.

Anarlog's screen (`ConnectedMeetingImportScreen` in `imports/screen.tsx`) required an Anarlog
sign-in before **any** Connect button worked, including the local MCP/CLI ones. That was
Anarlog's product rule, not a technical need. Milestone 7's `LocalMeetingImportScreen` then
kept only **Choose files** for every provider, which also hid the local connectors.

What other services see today:

- **Consent screen:** `connected_mcp.rs:178` registers the client as `"Anarlog"`, so Granola and
  the others show "Anarlog wants access".
- **Browser page after sign-in:** `connected_mcp.rs:461,466` say "brought into Anarlog" and
  "Return to Anarlog".
- **MCP handshake:** sync calls `().serve(transport)`, so rmcp sends its default client info,
  `rmcp 3.2.0`. That is generic, not Anarlog, but it does not say Dialext.

Hosted call sites that reach Anarlog's servers:

- **Imports** (`imports/connected-import.ts`): `connectNangoImport`, `disconnectNangoImport`
  and `openIntegrationUrl` (`shared/integration.ts`, which builds `VITE_APP_URL/app/integration`);
  `waitForNangoConnection` and `syncNangoMeetings`, which call `createClient({ baseUrl:
  env.VITE_API_URL })`; and `useConnections`/`listConnections`.
- **Calendar:**
  - The sidebar (`calendar/components/shared.tsx`, `sidebar.tsx`) uses `useConnections` and
    `openIntegrationUrl` for Google and Outlook.
  - The native `plugins/calendar/src/lib.rs` reads `VITE_API_URL` at compile time: `env!` in
    release builds, `option_env!` with a localhost default in debug builds.
  - `crates/calendar` asks that API for connection ids, calendars and events whenever an
    account token exists.
- **Build configuration:** Anarlog's `desktop_cd.yaml` bakes in `https://api.anarlog.so`. The
  Dialext launcher sets neither variable, so the prototype currently points at `localhost`.

The server behind those calls is in this MIT workspace: `apps/api` with `crates/api-nango`,
`api-calendar`, `api-meeting-import`, `api-notion` and `api-zoom`. A Dialext server can run
that code with Joshua's own Supabase project, Nango instance and OAuth apps. Nothing needs
rewriting from scratch.

## Phase A: open the local connectors (MCP and CLI)

**A1. One connector row, shared by both screens.**
- Extract the per-provider row for `isLocalConnectedImport` providers from
  `ConnectedMeetingImportScreen` into a component with no auth dependency: Connect, Cancel,
  status, Sync now, Disconnect, last result and warnings.
- Render it in `LocalMeetingImportScreen` for MCP/CLI providers. Keep **Choose files** beside
  it, as today.
- The Anarlog screen keeps using the same row, so the two do not drift.

**A2. Keep the existing local plumbing unchanged.**
- The row uses `connectConnectedImport`, `cancelConnectedImport`,
  `connectedImportSyncQueryOptions`, `disconnectConnectedImport` and the Keychain credential
  helpers exactly as they are.
- `useAuth`, `useConnections` and Nango helpers are not imported by the local screen.

**A3. Background sync.** The inherited behaviour syncs each connected source every five
minutes while the app is open. That talks only to the provider Joshua connected. Keep it, and
confirm it with Joshua (open decision 3).

**A4. Where imports land.**
- Imported meetings become ordinary notes through `importConnectedMeetings`, deduplicated by
  known meeting ids. They are not Dialext recordings and never touch Dialext accounts or
  evidence.
- Add a regression proving a repeat sync creates no duplicates and edits no existing note.

**A5. Onboarding.** Onboarding is off by default, but its import step must show the same
local connectors and still skip itself when nothing is detected.

**A6. Tests (desktop).**
- Local screen: Connect → complete → Sync now → Disconnect for an MCP provider and for Plaud,
  with `useAuth`/`useConnections` never called.
- No "Sign in" label anywhere.
- Hosted-only providers are absent (see Phase C).
- Existing Rust importer tests stay green.

## Phase B: other services see Dialext

**B1. One identity constant.** Add a single constant in the importer crate (name `Dialext`,
version from the app) and use it everywhere below.

**B2. Consent screen.** `register_client` uses it, so the provider shows "Dialext".

**B3. Browser page after sign-in.** The success and retry pages say "brought into Dialext" and
"Return to Dialext and try connecting again".

**B4. MCP handshake.** Replace `().serve(transport)` with an explicit `ClientInfo` carrying the
Dialext name and version, so `initialize` no longer sends `rmcp 3.2.0`.

**B5. Visible Anarlog links on these surfaces.**
- The Imports page **Documentation** button opens `docs.anarlog.so/imports`. Hide it in the
  personal shell until Dialext has its own documentation.
- Calendar `docsPath` values for Google and Outlook point at Anarlog's documentation. They
  become unreachable once those rows are hidden (Phase C).

**B6. Tests.**
- A Rust unit test asserts the registration name and client info are Dialext.
- A string test asserts the callback pages contain no "Anarlog".

**Existing connections.** A provider remembers the name it was given when the client
registered. The prototype has never connected one, so nothing needs migrating. A future
installation that connected under Anarlog would show the new name only after reconnecting.

## Phase C: hosted connectors and calendar, with no Anarlog calls

**C1. The seam: one service configuration.**
- Add a Dialext service setting, for example `DIALEXT_SERVICE_URL` (API) and
  `DIALEXT_SERVICE_APP_URL` (connect pages), **unset by default**.
- Expose it through one frontend accessor that returns either `null` or
  `{ apiUrl, appUrl, getHeaders }`, and through one native accessor that returns
  `Option<String>`.
- Nothing else reads `VITE_API_URL`/`VITE_APP_URL` for these features.

**C2. Route every hosted call site through the seam.**
- Imports: `connectNangoImport`, `disconnectNangoImport`, `waitForNangoConnection`,
  `syncNangoMeetings`, `openIntegrationUrl` and `useConnections`.
- Calendar: the sidebar's `useConnections` and `openIntegrationUrl`.
- With no service configured:
  - these functions are not called;
  - the rows are hidden, as they are today (open decision 2);
  - no request leaves the Mac.

**C3. Native calendar.**
- `plugins/calendar` takes `Option<String>` from the seam instead of `env!("VITE_API_URL")`.
  This also removes the compile-time requirement that makes a release build demand an API URL.
- `crates/calendar` never builds an API client when the base URL is `None`. Apple Calendar is
  unaffected.

**C4. Keep the code, drop the destination.**
- The Nango import and calendar code stays in the tree as "service-backed" connectors. The
  API contract is unchanged: the existing OpenAPI of `apps/api`.
- Only the destination and the auth headers come from the seam.
- `ANARLOG_ACCOUNT_SERVICES_ENABLED` keeps guarding Anarlog-only account UI (sign-in, billing,
  sharing), not these connectors.

**C5. Guard against regressions.**
- Desktop tests: with no service configured, `createClient`, `listConnections`,
  `openIntegrationUrl` and every `*ImportMeetings` call are never made, and the hosted rows
  are absent.
- A native test: `list_connection_ids(None, …)` makes no request.
- A repository check (a test or the licence-boundary style script) fails if
  `api.anarlog.so`, `app.anarlog.so` or `VITE_API_URL` are referenced outside the Anarlog-only
  modules and CI files.

## The later Dialext server (not built now)

This is the "identical setup" for Joshua and friends:

1. Deploy `apps/api` (with `api-nango`, `api-calendar`, `api-meeting-import`, `api-notion`,
   `api-zoom`) under Joshua's own hosting.
2. Give it its own Supabase project for sign-in and its own Nango instance.
3. Register OAuth apps named **Dialext** with Google, Microsoft, Zoom, Notion, Fathom and Webex.
4. Friends get an account on that server. Setting the Dialext service URL in the app turns the
   hosted connector and calendar rows back on, pointed at Dialext's server.
5. What the seam must still gain then: a Dialext sign-in provider behind the existing auth
   seam, and a settings row showing which server the app uses. Neither is part of this plan.

## Other Anarlog calls found, outside this plan

These are recorded so they are not lost. Each needs its own decision.

- **Updater:** the endpoint `desktop.anarlog.so` in `tauri.conf.*.json`. It applies to release
  builds only; the debug prototype does not use it. It belongs to packaging.
- **Template gallery:** the personal shell now returns bundled templates before the retained
  account-backed fetch can run.
- **Chat `web_search` tool:** the personal tool registry and guidance omit it; the account-backed
  implementation remains available.
- **Documentation links:** `docs.anarlog.so` in `apps/desktop/src-tauri/src/agents-content.md`
  and settings pages. This belongs to milestone 8 branding.

## Order, checks and acceptance

1. Phase B first: small, and it must land before any real connection is made, so the first
   consent screen already says Dialext.
2. Phase C next: it removes every Anarlog call before Phase A adds network features beside it.
3. Phase A last.

Each phase:
- is one commit;
- runs its focused tests, the desktop typecheck, changed-file lint and format, and the
  importer and calendar crate tests with Clippy `-D warnings`;
- runs the Lingui extract/compile when copy changes.

The full desktop suite passed at milestone 7 closure (488 files, 4,563 tests); see `HANDOFF.md`.

Real-window acceptance, with `node dialext/dev.mjs`:
- **Imports:** local connectors show Connect with no sign-in. Hosted rows are absent. The
  Documentation button is gone.
- **Calendar:** only Apple Calendar is shown, and it still works.
- **Network:** while the Imports and Calendar pages are open, no request goes to `localhost:3001`
  or any `anarlog.so` host. Watch the app log and, where practical, the network log.
- **Live connection:** connect one real provider (Granola is installed on this Mac), see
  "Dialext" on its consent screen, sync, repeat the sync with no duplicates, then disconnect.
  **This step is a live third-party call and needs Joshua's explicit approval in that
  session.** It is not a paid provider call.

## Open decisions for Joshua

1. **Name shown to other services:** `Dialext` (recommended) or `Dialext Prototype` while it
   is a debug build.
2. **Hosted rows with no Dialext server:** hidden (recommended; matches milestone 6's quiet
   interface), or shown disabled with "Needs a Dialext server".
3. **Background sync:** keep the inherited sync every five minutes while the app is open,
   or sync only when Joshua presses Sync now.
4. **Live acceptance:** approve connecting his own Granola account for Phase A's real-window
   check.
