# Engineering prompt backlog

Optional audit and hardening prompts. They are generic — written for a
distributed backend or a fresh Rust crate — so most will not fit Dialext as-is.
They are **not** milestones; [../HANDOFF.md](../HANDOFF.md) still sets the
current work and wins on any conflict.

| File | Contents |
| --- | --- |
| [rust-prompts.md](rust-prompts.md) | Phases 1–6: compiler-driven development, crate structure, API grounding, Clippy/CI polish, DDIA reliability and storage |
| [ddia-architecture-prompts.md](ddia-architecture-prompts.md) | Protobuf/Avro evolvability, replication, event-driven pipelines |

## How to run them

Give an agent this prompt:

> Read `AGENTS.md`, `dialext/HANDOFF.md`, `dialext/ARCHITECTURE.md` and
> `dialext/prompts/README.md`. Then triage `dialext/prompts/<file>.md`: grade
> every prompt against Dialext as it actually is (a local-first Tauri desktop
> app with SQLite, no Kafka, gRPC, etcd or read replicas). Write the result to
> `dialext/prompts/TRIAGE.md` as a table — prompt id, keep/adapt/skip, one-line
> reason, target crate or package. Do not change code yet; wait for my approval.

After approval:

> Work through the approved rows in `dialext/prompts/TRIAGE.md` one at a time.
> For each: implement it, run the focused checks from `AGENTS.md`, commit
> locally, and mark the row done with the commit hash. Stop and ask when a
> prompt conflicts with the handover or the product vision.
