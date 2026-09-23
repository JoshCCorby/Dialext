# Prompt backlog triage

Graded 23 September 2026 against the tree at `776f456`. On 23 September Joshua approved
suggested steps 1–3 below, to run ahead of M5 acceptance and the rest of M7; the other rows
are not approved. Done rows carry their commit hash in the reason.

Dialext as graded: a local-first Tauri 2 desktop app on one SQLite database. Its own Rust
lives in `crates/session-ingest` (`dialext*.rs`), `crates/db-app` (migrations,
`dialext_ops.rs`) and `plugins/db` (native commands); its TypeScript in
`apps/desktop/src/dialext` and nearby desktop modules. There is no server, network fan-out,
Kafka, gRPC, etcd, read replica or partitioning. Checks follow `AGENTS.md`:
`pnpm -F @anlg/desktop typecheck`, `cargo check --locked -p <crate>`, Clippy with
`-D warnings`, dprint — never bare `npx tsc` or a new CI workflow.

**Keep** = run largely as written, scoped to the target. **Adapt** = the idea fits but the
prompt must be rewritten for this codebase. **Skip** = does not apply, already satisfied, or
conflicts with project rules.

Summary: 4 keep, 15 adapt, 60 skip.

## rust-prompts.md

| Prompt | Grade | Reason | Target |
| --- | --- | --- | --- |
| 1.1 Compiler-driven skeleton | Skip | Scaffolds a fresh crate; Dialext extends existing workspace crates. | — |
| 1.2 Compiler-fix loop | Skip | Generic working habit, not a task; nothing to run. | — |
| 1.3 `cargo check` standing rule | Skip | Already required by `AGENTS.md` (`--locked`, per crate, workflow features). | — |
| 1.4 Panics into `Result` | Keep | Only ~3 non-test `unwrap`/`expect` sites in Dialext code; classify each and convert the recoverable ones to the crate's existing error type. | `session-ingest` (`dialext.rs`, `dialext_provider.rs`) |
| 1.5 CLI harness with debug prints | Skip | No Dialext CLI; runtime verification is the real desktop workflow via `node dialext/dev.mjs`. | — |
| 1.6 Ground third-party API usage | Skip | No suspect call site identified; use 3.1 on demand when one appears. | — |
| 1.7 Doc comments that render | Skip | Crates are internal, not published; `AGENTS.md` limits comments to non-obvious "why". | — |
| 1.8 Full feedback cycle (standing) | Skip | Duplicates `AGENTS.md` verification rules. | — |
| 1.9 Post-feature hardening | Adapt | Useful at a milestone boundary: Clippy `-D warnings` and an `Err`-variant test sweep, but through the workflow commands, not bare `cargo fmt`. | `session-ingest`, `db-app`, `plugins/db` |
| 2.1 lib.rs / main.rs split | Skip | Library crates already; the Tauri `main.rs` is inherited and outside Dialext scope. | — |
| 2.2 Extract monolith into modules | Adapt | `dialext_provider.rs` (~1,300 lines) and `dialext_speakers.rs`/`dialext_edits.rs` (~1,000) are candidates; split only if it eases the next milestone. | `session-ingest` |
| 2.3 File tree mirrors module tree | Skip | Standard Rust; nothing to fix. | — |
| 2.4 Fix E0603 visibility errors | Skip | Reactive; no current errors. | — |
| 2.5 Build the test harness | Skip | Dialext already has native ingest, edit, proposal and provider tests. | — |
| 2.6 Architectural guardrail (standing) | Skip | 25-line `main.rs` and 150-line module ceilings don't fit a Tauri workspace. | — |
| 3.1 Ground a suspicious API call | Skip | On-demand only; no target now. | — |
| 3.2 Fix E0599 | Skip | Reactive; no current errors. | — |
| 3.3 Doc comments with doctests | Skip | Internal crates; see 1.7. | — |
| 3.4 Public API surface via `cargo doc` | Adapt | Check that `session-ingest` exposes only what `plugins/db` calls; tighten `pub` to `pub(crate)`. No doc build needed. | `session-ingest` |
| 3.5 TDD loop for a new feature | Skip | Working method, not a task; milestones already ship with focused regressions. | — |
| 3.6 Error handling with stderr/stdout | Adapt | Only the provider subprocess boundary has streams: verify bounded stdout JSON vs stderr diagnostics and that user-facing errors say what failed. | `session-ingest` (`dialext_provider.rs`) |
| 3.7 Monolith → minigrep blueprint | Skip | CLI-shaped refactor; no monolith binary. | — |
| 4.1 Polish pipeline after every edit | Skip | Duplicates `AGENTS.md` pre-commit verification. | — |
| 4.2 Warning-free cleanup | Adapt | Run `cargo check`/Clippy on Dialext crates and fix warnings Dialext introduced; report inherited ones, don't blanket `cargo fix` shared code. | `session-ingest`, `db-app`, `plugins/db` |
| 4.3 Full Clippy deep pass | Skip | Clippy `-D warnings` is already a gate; a pedantic pass over inherited code is churn. | — |
| 4.4 Loops → combinators | Skip | Style churn with no user-visible value. | — |
| 4.5 Pre-commit hook | Skip | Not requested; dprint/oxlint/Clippy commands already defined, and hooks would slow Joshua's local commits. | — |
| 4.6 CI gate setup | Skip | CI workflows exist and are inherited Anarlog infrastructure; `rust-toolchain.toml` already pins 1.94.0 with clippy/rustfmt. | — |
| 4.7 Semantic-preservation proof | Adapt | Only as the safety net before 2.2 or another large refactor: lock behaviour with characterisation tests first. | `session-ingest` |
| 5.1 Latency percentiles layer | Skip | No request-serving path or endpoints. | — |
| 5.2 Fan-out tail-latency shield | Skip | No fan-out to backends. | — |
| 5.3 Circuit breaker | Skip | One local fixture subprocess; revisit timeouts/degradation only when a live provider is approved. | — |
| 5.4 Config guardrails | Adapt | The idea (reject unknown fields, clear range errors) fits the prepared import bundle and provider protocol; check `deny_unknown_fields` and error wording there — no reload/dry-run machinery. | `session-ingest` (`dialext.rs`, `dialext_provider.rs`) |
| 5.5 Load-generation harness | Skip | Single-user desktop app; no service to load. | — |
| 5.6 Chaos / fault-injection suite | Adapt | Scale down to the faults a desktop app has: provider crash/timeout, malformed provider output, disk-full or missing vault artefact mid-adoption. Deterministic, test-only. | `session-ingest`, `db-app` |
| 5.7 RSM architecture review (standing) | Skip | Scalability questions don't apply; `ARCHITECTURE.md` covers the contracts. | — |
| 6.1 Access-pattern schema decision | Skip | Schema is fixed by M1's contract and append-only migrations. | — |
| 6.2 Document vs join benchmark | Skip | No performance problem reported. | — |
| 6.3 LSM-tree storage wrapper | Skip | SQLite (B-tree) is the store; no LSM. | — |
| 6.4 Compaction stall hunt | Skip | No LSM compaction. | — |
| 6.5 Columnar offload pipeline | Skip | No analytics workload. | — |
| 6.6 Row vs column benchmark | Skip | As 6.5. | — |
| 6.7 B-tree vs LSM decision record | Skip | Decided: SQLite, inherited from Anarlog. | — |

## ddia-architecture-prompts.md

| Prompt | Grade | Reason | Target |
| --- | --- | --- | --- |
| 1.1 Protobuf evolvability + buf lint | Skip | No `.proto` files or gRPC. | — |
| 1.2 Read-modify-write unknown-field trap | Adapt | Real risk: Nightly and stable share one database, and JSON stored in SQLite (provider tasks, bundle metadata, ProseMirror documents) round-trips through serde structs. Audit whether an older build drops newer fields on write; add a round-trip test where it does. | `session-ingest`, `db-app` |
| 1.3 Evolvable gRPC services | Skip | No microservices. | — |
| 1.4 Avro for message brokers | Skip | No broker. | — |
| 2.1 Read-after-write with replicas | Skip | No replicas. | — |
| 2.2 Hot-key salting | Skip | No partitioning. | — |
| 2.3 Fencing tokens with etcd | Skip | No distributed locks; `content_version` pinning in one `BEGIN IMMEDIATE` transaction already fences stale edits. | — |
| 2.4 Quorum / partition simulation | Skip | Single node. | — |
| 3.1 Dual writes → CDC/Kafka | Adapt | No Kafka, but the question fits: check SQLite writes vs the Tantivy search index and vault artefacts for divergence after a crash. Report first; fix only proven gaps. | `apps/desktop/src-tauri` (`search_index.rs`), `session-ingest` |
| 3.2 Self-healing CQRS projector | Skip | Kafka-based; search index rebuild is inherited Anarlog behaviour. | — |
| 3.3 Event-sourcing command engine | Skip | Already satisfied in Dialext's form: append-only `dialext_account_edits` with validated, version-pinned commands. | — |

## typescript-prompts.md

| Prompt | Grade | Reason | Target |
| --- | --- | --- | --- |
| 0 Initial audit (`npx tsc`) | Adapt | Use `pnpm -F @anlg/desktop typecheck` after building `@anlg/ui`; last recorded as passing, so this is a baseline, not a hotspot hunt. | `@anlg/desktop` |
| 1.1 tsconfig strictness audit | Adapt | `apps/desktop/tsconfig.json` already has `strict: true`; report-only check of `noImplicitReturns`/`noUncheckedIndexedAccess` impact. Changing the shared config needs Joshua's decision. | `@anlg/desktop` |
| 1.2 Type-driven scaffolding | Skip | Working method; conflicts with "avoid creating types unless shared". | — |
| 1.3 Autonomous refactor loop | Skip | No current type errors to drive it. | — |
| 1.4 Self-correcting loop | Skip | Already required: typecheck must pass. | — |
| 2.1 Ban `any`, add type guards | Keep | No `any` in `src/dialext` now; apply to the untrusted inputs — import bundle JSON and provider results on the TS side — and confirm they are narrowed from `unknown`. Done in `f11ca6a` with 5.1. | `@anlg/desktop` (`src/dialext`) |
| 2.2 Invalid states unrepresentable | Keep | Import/provider/generation UI state is the likely place for `data?`/`error?` shapes; convert to discriminated unions where found. | `@anlg/desktop` (`src/dialext`) |
| 2.3 Exhaustiveness guarantee | Keep | Cheap and valuable for reading-language, provider-task and account-status switches. | `@anlg/desktop` (`src/dialext`) |
| 2.4 Deep immutability (`as const`) | Adapt | Only for static Dialext dictionaries (language codes, labels); no blanket pass. | `@anlg/desktop` (`src/dialext`) |
| 3.1 Pipeline call signatures | Skip | No utility pipelines needing it. | — |
| 3.2 Bounded polymorphism | Skip | No entity-mutation utilities; mutations go through native commands. | — |
| 3.3 Variadic tuple wrappers | Skip | No such wrappers identified. | — |
| 3.4 Refactor loose utilities | Skip | Nothing flagged; speculative. | — |
| 4.1 `interface` vs `type` | Skip | Style rule that conflicts with the codebase's inline-type convention. | — |
| 4.2 Class encapsulation | Skip | Functional React/Zustand; no domain classes. | — |
| 4.3 Repository `implements` | Skip | Data access is Rust-side; TS consumes transport contracts. | — |
| 4.4 Companion objects | Skip | Style preference with no concrete payoff. | — |
| 5.1 Type guards over `as` | Adapt | Merge into 2.1: replace `as` casts on parsed JSON in `src/dialext`. Done in `f11ca6a`. | `@anlg/desktop` (`src/dialext`) |
| 5.2 Mapped types | Skip | Toolbox, not a task. | — |
| 5.3 Derived DTOs | Skip | DTOs come from generated bindings (`plugins/db/js/bindings.gen.ts`); don't hand-derive. | — |
| 5.4 Exhaustive `Record<K,V>` maps | Adapt | Use for Dialext label/status maps keyed by unions so a new status fails to compile. | `@anlg/desktop` (`src/dialext`) |
| 6.1 Thrown errors → error unions | Skip | `AGENTS.md` routes async errors through TanStack `useMutation`/`useQuery`, which expect throws. | — |
| 6.2 `Result<T, E>` monad | Skip | Same conflict; would fight the query/mutation layer. Rust already returns typed errors. | — |
| 6.3 HTTP boundary mapping | Skip | No HTTP boundary; errors cross Tauri commands. | — |
| 6.4 Ban `throw` in services | Skip | See 6.1; 17 `throw` sites in `src/dialext` feed mutations by design. | — |

## Suggested order if approved

1. TS 2.1 + 5.1, 2.2, 2.3, 5.4 — one slice in `src/dialext`, verified by desktop typecheck,
   tests and lint.
2. Rust 1.4, 5.4, 3.6 — small `session-ingest` hardening slice.
3. DDIA 1.2 — the only row that could protect real data across Nightly/stable.
4. Report-only: TS 0, 1.1; DDIA 3.1; Rust 3.4, 4.2.
5. Only with a reason from the next milestone: Rust 2.2 (behind 4.7), 5.6, 1.9.
