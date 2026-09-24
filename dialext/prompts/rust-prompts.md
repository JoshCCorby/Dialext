# Claude Code Prompts for Rust & Architecture

## Meta-Instruction for Claude Code
**AGENT INSTRUCTION:** Before blindly executing the prompts below, analyze the current state, size, and architecture of this codebase. Grade the relevance of each prompt block against the project's actual needs. You have full license to skip, cut, or deprioritize any prompts that are irrelevant, redundant, or would waste tokens/time given the current codebase context. Present a brief execution plan of *which* prompts you intend to run and why, then await confirmation.

---

## Phase 1: Compiler-Driven Development

### Prompt 1.1 — Scaffold a Compiler-Driven Project Skeleton
```text
We're starting a Rust project from scratch. Before writing any logic, I want to
set up a clean skeletal structure so we can develop it compiler-first.
Do the following:
1. Run `cargo init --name <PROJECT_NAME>` (or restructure the existing crate if
   one is already present).
2. Split the code into `src/lib.rs` (all business logic) and `src/main.rs`
   (thin CLI wrapper that only calls into the library). This matches the
   pattern used in Chapter 12 of The Rust Programming Language (the `minigrep`
   project).
3. In `src/lib.rs`, define the core types as STUBS ONLY:
   - Struct definitions with named fields (no method bodies yet, or bodies
     that are `todo!()`)
   - Function signatures with real parameter and return types, including
     `Result<T, E>` where failure is possible
   - `pub` visibility chosen deliberately: only what's needed by `main.rs`
4. Run `cargo check` yourself. Fix any errors until it passes with zero
   errors. Do not implement any function bodies yet.
5. Show me the final file tree and a one-line summary of each public item.
The goal: the interface compiles and is reviewable before a single line of
implementation exists. Do not proceed to implementations until I say so.
```

### Prompt 1.2 — The Compiler-Fix Loop
```text
I hit a compiler error. Here is the exact output from `cargo check`:
[paste error here]
Please:
1. Diagnose the ROOT CAUSE — not just the first line. Rust error messages
   often cascade; the real problem is usually at the top, but secondary errors
   can hide additional issues. Explain each distinct error in one sentence.
2. Propose the minimal fix that resolves the error WITHOUT changing the
   intended behavior of the program. If multiple valid fixes exist (e.g.
   dereference vs. reborrow, clone vs. reference), list them and tell me
   which is idiomatic and why.
3. Apply the fix.
4. Run `cargo check` again yourself and confirm it passes with no errors.
   Also run `cargo clippy` and fix any new warnings your change introduced.
5. If the fix required a design compromise (e.g. adding a lifetime, changing
   a return type, adding a `Clone` bound), flag it explicitly so I can decide
   whether the original design should change instead.
If the pasted error is ambiguous, run `cargo check` yourself to see the full
context including surrounding lines before touching anything.
```

### Prompt 1.3 — Vet Every Change with `cargo check` (Standing Instruction)
```text
Before you write any Rust code in this session, understand the ground rules:
- NEVER assume a method, trait, or function exists in std or a dependency.
  If you're not 100% certain of a signature, check first: run
  `cargo doc --open` won't work headlessly, so instead grep the dependency
  source in `~/.cargo/registry/src/` or run `cargo tree` to confirm the
  installed version, then read the actual source.
- After EVERY code edit you make, run `cargo check` yourself. If it fails,
  fix it before moving on. Do not batch multiple edits and check at the end —
  check after each one so we know exactly which change broke what.
- If `cargo check` passes but emits warnings (`unused_must_use`,
  `dead_code`, `unused_variables`), resolve them properly: either use the
  value, prefix with `_`, or add `#[allow(...)]` with a comment explaining
  why.
- Treat compiler errors as the source of truth. If your proposed code
  conflicts with what the compiler says, the compiler is right — re-derive
  your assumptions.
Acknowledge these rules, then wait for my first request.
```

### Prompt 1.4 — Refactor Panics into `Result`
```text
Audit this codebase for panic-prone code and refactor it to explicit error
handling:
1. Run `grep -rn "\.unwrap()\|\.expect(\|\!\[0\]\|panic\!" src/` and give me a
   full inventory of every panic site, classified as:
   a. Genuinely impossible (invariant guaranteed by construction) → keep,
      but replace with `.expect("why this can never fail")` with a real
      message
   b. Recoverable / user-input-dependent → convert to `Result`
   c. Programmer error (bug indicator) → keep as `panic!` / `assert!` or
      `unreachable!`, with a comment
2. For every category (b) site, apply the Chapter 12 `minigrep` pattern:
   - Create (or extend) a constructor like `Config::build(args: &[String])
     -> Result<Config, &'static str>` that validates ALL inputs up front
   - Have `main` return nothing but do: parse → on `Err`, print to stderr
     and `std::process::exit(1)`
   - Use `std::env::args().collect::<Vec<String>>()` passed explicitly (not
     read inside the library) so the logic stays testable
3. Define ONE error type for this crate (either a simple enum or, if we
   already depend on `thiserror`/`anyhow`, use that). Don't mix ad-hoc
   `&'static str` errors with richer error types.
4. Run `cargo check`, then `cargo test` if tests exist, and confirm the
   program still compiles and behaves identically for valid inputs.
5. Show me a diff summary grouped by category (a), (b), (c) so I can sanity-
   check your classification.
```

### Prompt 1.5 — CLI Harness for Runtime Verification
```text
I need to observe what our program actually does at runtime before trusting
it. Build me a verification harness:
1. Add temporary, clearly-marked debug logging: prefix every debug line with
   `[DEBUG]` so I can grep-strip them later. Log: parsed CLI args, file paths
   being read, counts of items processed, and the final return value of the
   core function.
2. Make sure argument handling is testable: create a small test fixture
   (e.g. `fixtures/sample.txt` with known content) and a command I can run
   repeatedly: `cargo run -- test fixtures/sample.txt`
3. Run that command yourself with at least 3 input variations:
   - valid args
   - missing file / wrong path (verify we get a clean `Err` to stderr, NOT a
     panic backtrace — run with `RUST_BACKTRACE=1` to prove no panic path)
   - wrong arg count (verify usage message)
4. Report back: the exact output of each run, and whether behavior matches
   what you'd expect. Flag any output that surprised you.
5. Do NOT remove the debug lines yet — I'll tell you when to strip them.
Keep the harness in `main.rs` only; `src/lib.rs` must stay clean of debug
prints.
```

### Prompt 1.6 — Ground Third-Party API Usage
```text
We're using crate `<CRATE_NAME>` version `<X.Y.Z>` (confirm the exact version
with `cargo tree` first — do not trust your memory of its API).
1. Find the crate's source under `~/.cargo/registry/src/` and read the actual
   function/method signatures for: `<METHOD_OR_FUNCTIONS_IN_QUESTION>`.
2. Check the required trait imports — many crate methods only work when their
   trait is in scope (e.g. `use rand::Rng;` needed before calling
   `gen_range`). List every `use` statement we need and which items they
   unlock.
3. Rewrite the code that touches this crate using the EXACT signatures from
   the installed source. If the installed version's API differs from what you
   initially assumed, tell me what changed between versions.
4. Verify with `cargo check` and a quick `cargo run -- <args>` exercising
   that code path.
5. Add a one-line comment above each use site noting the trait requirement,
   so future readers don't delete the `use` statement as "unused".
If we should upgrade/downgrade the crate version to match an API I want, say
so and explain the tradeoff — don't silently change `Cargo.toml`.
```

### Prompt 1.7 — Write Doc Comments That Actually Render
```text
Document the public API of `src/lib.rs` so it renders well in `cargo doc`:
1. Add `///` doc comments to every `pub` item following Rustdoc conventions:
   - Start with a one-sentence summary of what the item IS or DOES
   - Then a longer paragraph if behavior is non-obvious (edge cases,
     performance notes, panics — document ALL possible panics with a
     `# Panics` section)
   - Include `# Examples` sections with ```rust fenced code blocks containing
     REAL code that compiles. These run as doctests with `cargo test`.
2. For fallible functions, document every error condition under `# Errors`.
3. For functions taking/returning iterators or generics, note trait bounds
   inline in prose.
4. Run `cargo test --doc` to PROVE every example compiles and passes.
5. Run `cargo doc --no-deps` and tell me if any warnings appeared; fix them.
Internal (non-pub) items get `//` comments only — save the `///` for the
public surface. Keep the whole thing terse; docs that say in five sentences
what one would do get edited down.
```

### Prompt 1.8 — The Full Feedback Cycle (Standing Instruction)
```text
For the rest of this session, follow this loop for every feature we build:
  1. PLAN: Before coding, state in 2–3 sentences what we're building and
     which files will change.
  2. STUB: Write type definitions and function signatures first. Run
     `cargo check`. Only proceed once the interface is green.
  3. IMPLEMENT in small increments: one function or method at a time,
     running `cargo check` after each. If a check fails, fix before
     continuing — never stack multiple unverified edits.
  4. VERIFY API assumptions: any std/dependency call you're less than fully
     sure about — check the real source in the cargo registry before using
     it, not after it fails.
  5. RUN: Finish each feature with `cargo run -- <relevant args>` and show
     me the actual output. If the output differs from expectations, diagnose
     before moving on.
  6. REPORT: End each feature with: files changed, checks run and their
     results, any design compromises made, and any `todo!()`/`unimplemented!()`
     intentionally left behind.
Skip any step only if I explicitly tell you to. Start by confirming you
understand the loop, then ask what the first feature is.
```

### Prompt 1.9 — Post-Feature Hardening Pass
```text
The feature we just built works, but before we call it done, do a hardening
pass:
1. `cargo clippy -- -D warnings` — fix everything, not with `#[allow]`, but
   idiomatically. If a lint is genuinely wrong for our case, justify the
   `#[allow]` in a comment.
2. `cargo fmt --check` — then `cargo fmt`. Show me the diff if it's large.
3. Error-path testing: write unit tests for EVERY `Err` variant our error
   enum can produce, plus the boundary cases (empty input, oversized input,
   unicode where relevant).
4. Run the test suite with `cargo test` and confirm 100% pass. If any test
   is flaky or order-dependent, find out why instead of rerunning.
5. Final review: grep for leftover `dbg!`, `println!` debug lines, `TODO`,
   and `unwrap()` added after my last audit. Remove or justify each one.
Report: lint count before/after, test count before/after, and anything you
found that suggests a deeper design issue.
```

---

## Phase 2: Project Structure & Extraction

### Prompt 2.1 — Enforce the lib.rs / main.rs Separation
```text
Apply the Chapter 12 separation-of-concerns pattern from The Rust Programming
Language to this project.
Current state: [describe your project or just say "audit the current crate"]
Do the following:
1. AUDIT: Show me the current line count of src/main.rs and a one-sentence
   summary of every responsibility it currently holds (arg parsing, business
   logic, I/O, error handling, etc.). If src/lib.rs doesn't exist, note that.
2. EXTRACT: Move ALL business logic into src/lib.rs:
   - Domain structs and their impl blocks
   - A Config::build(args: &[String]) -> Result<Config, Box<dyn Error>>
     (or a project-specific error enum) that validates arguments up front
   - A single pub fn run(config: Config) -> Result<(), Box<dyn Error>>
     containing the core execution flow
   - Every item main.rs needs must be pub
3. SHRINK: Rewrite src/main.rs to this exact shape — nothing more:
   use std::env;
   use std::process;
   use <crate_name>::Config;
   fn main() {
       let args: Vec<String> = env::args().collect();
       let config = Config::build(&args).unwrap_or_else(|err| {
           eprintln!("Problem parsing arguments: {err}");
           process::exit(1);
       });
       if let Err(e) = <crate_name>::run(config) {
           eprintln!("Application error: {e}");
           process::exit(1);
       }
   }
   Note: <crate_name> comes from Cargo.toml's `name` field (hyphens become
   underscores). Verify it yourself.
4. VERIFY:
   - Run `cargo check` — zero errors, zero warnings
   - Run `cargo run -- <args that worked before>` and confirm identical
     behavior to the pre-refactor version
   - Confirm src/main.rs is under 25 lines. If it's not, something leaked
     back in — find it.
5. REPORT: file tree before/after, lines moved per file, anything you had
   to make pub, and any logic that resisted extraction (e.g. deeply coupled
   globals) with your recommended fix.
Do NOT change behavior during the extraction — this is a pure move refactor.
No new features, no renames, no signature changes unless strictly required
by the crate boundary.
```

### Prompt 2.2 — Extract a Monolith into Modules
```text
src/main.rs (or src/lib.rs) is growing into a monolith. Extract the
[domain, e.g. "database query"] logic into a dedicated module, following
the Chapter 7 module rules exactly.
Rules — follow them precisely, because Rust does not guess:
1. DECLARATION: Add `pub mod <name>;` to the crate root (src/lib.rs or
   src/main.rs). The compiler resolves this to EITHER src/<name>.rs OR
   src/<name>/mod.rs — pick the flat file form (src/<name>.rs) unless the
   module will contain submodules.
2. MOVE: Cut the relevant structs, impls, and functions from the monolith
   into the new file. NOTHING in the new file is visible to the outside
   unless marked pub — audit every item:
   - pub struct / pub enum for types used outside the module
   - pub fn for functions called externally
   - pub fields ONLY where external construction is needed; otherwise keep
     fields private and provide constructors/accessors
   - Keep helper functions private — that's a feature, not an oversight
3. USE STATEMENTS: In the files that consume this module:
   - For functions: import the parent module (`use crate::<name>;`) and
     call `<name>::function()` — this is the idiomatic form per Chapter 7
     because it shows the function isn't local
   - For structs/enums: import the type path directly
     (`use crate::<name>::<Type>;`)
   - Run `cargo fmt` and let it collapse/sort the use blocks
4. VERIFY: Run `cargo check` yourself. If you hit E0603 ("module is
   private" or "function is private"), that's a missing pub — fix the
   visibility at the right level rather than making everything pub as a
   shotgun fix. Then run `cargo run` / `cargo test` to confirm nothing
   broke.
5. REPORT: the new file tree, what stayed private (and why that's correct),
   and the full list of items you made pub.
Target: [domain to extract, e.g. "all the file-reading and Config parsing"]
```

### Prompt 2.3 — Standing Rule: File Tree Must Mirror Module Tree
```text
For the rest of this session, enforce these module hygiene rules on every
Rust file you create or edit:
1. EVERY .rs file under src/ must be reachable from the crate root via an
   explicit `mod` declaration. A file sitting on disk without a matching
   `mod` statement is dead code — find and wire it up, or delete it.
   After any restructure, verify with a quick script: list all src/**/*.rs
   files and confirm each maps to a mod declaration.
2. SUBMODULE PATHS: `mod foo;` inside src/bar.rs resolves to
   src/bar/foo.rs (or src/bar/foo/mod.rs). If you nest modules, create the
   matching directory. Never put a submodule file at the wrong level.
3. NO RE-EXPORT MUSH: `pub use` re-exports only at the crate root
   (src/lib.rs) to present a clean public API. Inside submodules, plain
   `use` for local needs.
4. PRIVACY BY DEFAULT: When adding a new item, start private. Only add pub
   when something outside the module actually consumes it — and when I ask
   "why is this pub?", have a one-line answer ready.
5. CHECK AFTER EVERY CHANGE: run `cargo check` after each module-level
   edit. E0603/E0425 errors mean the module tree and file tree are out of
   sync — that's always a declaration problem, never a syntax problem.
Acknowledge these rules and wait for the first task.
```

### Prompt 2.4 — Fix Visibility Errors (E0603) Properly
```text
`cargo check` is failing with visibility errors. Here's the output:
[paste error, or say "run it yourself and find them"]
Handle it like this:
1. DIAGNOSE each error precisely. E0603 has two distinct flavors:
   - "module `x` is private" → the `mod x;` declaration itself needs to be
     `pub mod x;` at EVERY level of the chain from crate root to the item
   - "`y` is private" / "function is never used" from another module → the
     individual item needs pub, not the whole module
2. FIX AT THE RIGHT LEVEL: trace the full path from crate root to the item
   and ensure every hop is public. Do NOT sprinkle pub on everything — a
   module that is pub but whose contents are all private is often the
   correct design.
3. Also check: are you accessing via the wrong path? `crate::a::b::c` vs
   `super::c` vs `self::c` — if a sibling module would be cleaner, suggest
   `use super::` or `use crate::...` reorganization instead of just adding
   pub.
4. VERIFY: `cargo check` clean, then `cargo test` clean, then run the
   binary once to be sure.
5. REPORT: for each error, one line: what was private → what you changed →
   why that level was the correct one to expose.
```

### Prompt 2.5 — Build the Test Harness
```text
Now that the core logic lives in src/lib.rs, build the test suite that the
binary-crate layout makes possible. Do all three layers:
1. UNIT TESTS — inside src/lib.rs, add:
   #[cfg(test)]
   mod tests {
       use super::*;
       // One test per behavior branch: valid input, each invalid-input
       // case (missing arg, bad value, empty), and each error variant of
       // our error type. For Config::build specifically: test with a
       // fabricated args slice like vec!["prog".to_string(),
       "flag".to_string()] — never call std::env::args() in a test.
   }
   If you extracted submodules (src/db.rs etc.), put unit tests inside
   THOSE files too, using `use super::*;` — this also proves your privacy
   boundaries are right.
2. INTEGRATION TESTS — create tests/integration_test.rs that exercises the
   PUBLIC API only, exactly as an external consumer would:
   - `use <crate_name>;` then call the pub items
   - Use a fixture file under tests/fixtures/ for I/O paths
   - Test the full run(config) pipeline end-to-end with real temp files,
     cleaning up after itself
3. VERIFY:
   - `cargo test` — all green, zero ignored
   - `cargo test -- --list | wc -l` to report the test count
   - Confirm the tests would have FAILED against the old monolithic
     main.rs layout (i.e., they test through the lib boundary, not by
     reaching into main)
4. REPORT: test count per layer, coverage of each error variant (list them
   and tick off), and any code you had to make pub purely to enable testing
   — flag those for review, since they might belong behind a constructor
   instead.
```

### Prompt 2.6 — Architectural Review Guardrail (Standing Instruction)
```text
From now on in this session, act as my architecture guardrail for this Rust
project. Rules:
1. MAIN.RS CEILING: src/main.rs must stay under 25 lines and contain ONLY:
   arg collection, Config::build, call to run(), error-to-exit-code mapping.
   If any edit would grow it beyond that, refactor the logic into src/lib.rs
   (or a submodule) BEFORE applying the edit.
2. ONE MODULE PER RESPONSIBILITY: when a file exceeds ~150 lines or mixes
   two concerns (e.g. parsing + I/O), propose a module extraction BEFORE
   continuing to add features to it. Never append to a monolith when a
   module boundary is available.
3. FILE-TREE SYNC: after creating any file, confirm the mod declaration
   exists; after any mod declaration, confirm the file exists. Run
   `cargo check` to prove it.
4. PUB JUSTIFICATION: every pub item gets a doc comment starting with a
   one-sentence summary. If you can't write the summary, the item probably
   shouldn't be pub.
5. PERIODIC AUDIT: every ~5 edits, stop and report: current file tree with
   line counts, anything that's crept toward monolith status, and any
   privacy violations you've spotted.
Confirm the rules, then ask what we're building.
```

---

## Phase 3: Grounding APIs, Docs, & Advanced Refactoring

### Prompt 3.1 — Ground a Suspicious API Call
```text
I suspect a recent API call you wrote is hallucinated or from the wrong
version of a crate. Let's verify it against ground truth instead of
trial-and-error compiling.
1. Confirm versions: run `cargo tree | grep <CRATE>` to get the exact
   installed version(s). Version drift is the #1 cause — your training data
   may include APIs from other major versions of this crate.
2. Get ground truth (in order of preference):
   a. `cargo doc --no-deps` builds fast; for dependency docs check if
      target/doc/<crate>/index.html already exists from a previous
      `cargo doc` run
   b. Fall back to reading the actual source:
      `ls ~/.cargo/registry/src/*/ | grep <crate>` then read the real
      .rs files. This is the ultimate source of truth.
3. Audit EVERY call site in our code touching this crate:
   - Method/function names — do they exist in this version?
   - Parameter types and order — e.g. does it take a range `1..=100` or
     two integers `(1, 101)`? This exact mistake (rand 0.5 vs 0.8 syntax)
   - Return type — raw value, or Option/Result we must handle?
   - Deprecation — is the method marked #[deprecated] in the installed
     source, with a named replacement?
4. Fix any mismatches using the EXACT signature from the installed source.
   Comment the non-obvious ones (e.g. "gen_range takes a Range, not two
   ints — rand 0.8").
5. Verify: `cargo check` clean, then exercise the code path with
   `cargo run -- <args>`.
6. Report: a table of call sites — what you assumed → what the installed
   source says → what you changed.
```

### Prompt 3.2 — Fix E0599 "no method named X found"
```text
We're getting E0599 — "no method named `<method>` found for struct `<type>`
in the current scope". This is almost always a missing trait import, not a
missing method.
Handle it properly:
1. Run `cargo check` yourself to get the FULL error — rustc helpfully lists
   the candidate traits in the help note ("items from traits can only be
   used if the trait is in scope; help: the following trait is provided by
   crate `<crate>` ... `use <crate>::<Trait>;`). Do not guess the trait
   name — take it from that help note or from the source.
2. Add the `use` statement at the top of the file that calls the method.
   Rules:
   - One trait per use line if they're from different crates
   - Match our existing import style (check the top of the file first)
   - Never use `use <crate>::*` wildcard imports just to fix this — import
     the specific trait
3. Then audit the OTHER direction: grep our whole codebase for uses of this
   crate and check every other method call against the trait impls in the
   installed source. If one call site needed the trait, a sibling call site
   probably needs it too — or needs a DIFFERENT trait.
4. Also verify the receiver is correct: E0599 can also mean calling a
   method on the wrong type (e.g. calling a &mut self method through a
   shared reference). Check mutability if the trait import doesn't fix it.
5. Verify: `cargo check` clean, `cargo clippy` clean.
6. Report: each fixed site with the trait it needed and why (one line).
```

### Prompt 3.3 — Doc Comments with Doctests
```text
Document the public API in src/lib.rs, and make the documentation itself a
test suite. Follow Chapter 14 conventions exactly:
1. Item docs (`///` before pub items):
   - One-sentence summary first, then detail
   - `# Examples` — a ```rust fenced block with REAL runnable code that
     calls the item through the public API (use `use <crate_name>::...`
     paths as an external consumer would)
   - `# Panics` — every input condition that can panic, explicitly
   - `# Errors` — every Err variant and what causes it, one bullet each
2. Crate-level docs (`//!` at the very top of src/lib.rs):
   - What the crate does, the main entrypoint (run/Config), a map of the
     submodules, and a quick-start example
3. THE CRITICAL PART — prove it all works:
   - Run `cargo test --doc`. Every example compiles AND runs as a test.
     If an example fails, the docs are lying — fix the example or the code,
     whichever is wrong.
   - For examples that intentionally panic or return Err, use the
     documented attributes: ```should_panic or ```no_run with a comment
     explaining why
   - For examples needing setup (temp files), use ```no_run only if truly
     necessary — prefer examples that construct values purely in memory
4. Run `cargo doc --no-deps` and fix every rustdoc warning (broken links,
   missing backticks on code identifiers, etc.).
5. Report: number of doc examples, how many run vs no_run/should_panic,
   and any pub item you could NOT write a honest example for — that's a
   design smell, flag it.
Rule: an example you can't test is an example you don't write. If an item
is too stateful to doctest cleanly, that's a signal to refactor it, not to
skip testing it.
```

### Prompt 3.4 — Audit Public API Surface via cargo doc
```text
Generate `cargo doc --no-deps` for this crate and audit the public API
surface as rendered. Do this:
1. Build the docs, then read target/doc/<crate_name>/index.html and the
   per-module pages (read the HTML source or the search index JSON if the
   rendered pages are hard to parse).
2. Everything that appears in the rendered docs is our public contract.
   For each pub item, classify:
   a. INTENTIONAL API — documented, has examples, meant for consumers →
      keep
   b. LEAKAGE — pub only because main.rs or a test needed it, not part of
      the intended API → hide it: make fields private with accessors, or
      use pub(crate) if only the binary/tests need it
   c. ORPHAN — appears in docs but undocumented or with a placeholder
      doc comment → write real docs or downgrade visibility
3. Check the module hierarchy rendering: are deeply nested paths
   (crate::a::b::C) that consumers actually use surfaced at the crate root?
   If not, add `pub use` re-exports in src/lib.rs to flatten them
   (Chapter 14 pattern), e.g.:
       pub use self::config::Config;
       pub use self::runner::run;
   Keep the re-export list small and curated — it's the front door.
4. Re-run `cargo test --doc` after any re-export changes to confirm the
   examples still resolve.
5. Report: total pub items, count per category (a/b/c), the final
   re-export list with one-line justifications, and items you recommend
   deprecating or removing.
```

### Prompt 3.5 — TDD Loop for a New Feature
```text
We're adding a feature to src/lib.rs using strict TDD, Chapter 12 style.
The feature: [describe]
Follow the loop exactly — do not write implementation before a failing test:
1. RED: Write the unit test(s) FIRST inside `#[cfg(test)] mod tests` in
   src/lib.rs (or in the relevant submodule file, using `use super::*;`):
   - Happy path
   - Each failure mode / edge case you can name (empty input, boundary
     values, unicode, etc.)
   - Name tests after the behavior: `rejects_empty_query`,
     `matches_case_sensitive_by_default`
   Run `cargo test`. Confirm the new tests FAIL to compile or fail at
   runtime. Show me the failure output — that's proof the test means
   something. A test that passes before the implementation exists is
   testing nothing.
2. GREEN: Write the MINIMAL implementation to make the tests pass. Nothing
   more. No speculative generality, no extra options, no "while I'm here"
   refactors.
3. REFACTOR: Only now improve the implementation (cleaner iteration,
   better names) — with the tests green at every step. Run `cargo clippy`
   and `cargo fmt` at the end.
4. Run the full suite: `cargo test` (unit + integration + doctests). All
   green before you report back.
5. Report: tests written (names + what each proves), implementation
   approach in 2-3 sentences, clippy/fmt status.
Constraint: src/main.rs must not change AT ALL during this loop — if the
feature seems to need a CLI flag, stop and tell me, because that's a Config
change to plan separately, not to sneak in.
```

### Prompt 3.6 — Error-Handling Audit with stderr/stdout Verification
```text
Audit this project's error handling end-to-end, Chapter 12 style, and prove
the UX is right with actual stream separation tests.
1. INVENTORY: grep for every panic-capable site:
   `.unwrap()`, `.expect(`, `panic!`, `assert` in non-test code,
   direct indexing `args[1]`-style. Classify each: keep-with-message /
   convert-to-Result / legitimately-impossible.
2. LAYER SPLIT: ensure errors are handled at the right layer:
   - Library (src/lib.rs): returns Result everywhere, NO process::exit,
     NO eprintln to end users — but MAY log via a logger if we have one
   - Binary (src/main.rs): the ONLY place allowed to eprintln + exit(1)
3. STREAM VERIFICATION — run these yourself and show me the output:
   a. `cargo run 2>/dev/null` with bad args → error messages must still be
      visible on stdout-terminal... actually NO: run
      `cargo run 2>err.txt 1>out.txt` with bad args, then show me:
      err.txt contains the usage/error message; out.txt does NOT.
      This proves errors go to stderr and normal output to stdout — the
      Unix contract, and the thing Chapter 12 explicitly tests.
   b. `cargo run -- <valid args> 1>out.txt 2>err.txt` → reverse: results
      in out.txt, err.txt empty or near-empty.
   c. `echo $?` after each run to verify exit codes: non-zero on any error
      path, zero on success.
4. ERROR MESSAGES: every user-facing error message must say WHAT went
   wrong and WHAT to do: "not enough arguments: usage: minigrep <query>
   <filepath>" — not "index out of bounds". Rewrite any that fail this.
5. Verify: `cargo test` still green, `cargo check` clean.
6. Report: panic-site classification table, stream test outputs verbatim,
   exit codes observed, rewritten messages.
```

### Prompt 3.7 — Full Blueprint: Monolith → minigrep Architecture
```text
My prototype in src/main.rs is a monolith with the four Chapter 12
anti-patterns. Refactor it completely, in this exact order:
PHASE 1 — Config struct:
  - Group all configuration variables into a `pub struct Config`
  - `pub fn build(args: &[String]) -> Result<Config, &'static str>`
  - Validate argument count; return descriptive static-str errors
  - Using .clone() on the args here is ACCEPTABLE for now (avoids lifetime
    annotations); note it as a Chapter 13 optimization point, don't do it
PHASE 2 — run() extraction:
  - Move ALL execution logic (file I/O, processing loops, output) into
    `pub fn run(config: Config) -> Result<(), Box<dyn Error>>` in
    src/lib.rs, using `?` for propagation
  - Box<dyn Error> is deliberate: "any error type", no custom wrappers yet
PHASE 3 — minimal main.rs:
  - src/main.rs shrinks to: collect args → Config::build (unwrap_or_else
    → eprintln + process::exit(1)) → run (if let Err → eprintln + exit(1))
  - Target: under 20 lines. Prove it.
PHASE 4 — TDD the core logic:
  - Identify the pure core function(s) inside run() (search/filter/parse)
  - Extract them as standalone pub fns taking &str inputs, returning
    owned/parsed outputs
  - Write #[cfg(test)] tests: happy path + failure modes, before or
    alongside the extraction
VERIFICATION GATES (stop and fix if any fail):
  - `cargo check` after every phase
  - `cargo run -- <args that worked pre-refactor>` produces IDENTICAL
    stdout to before — capture both and diff them
  - `cargo run` with bad args: friendly stderr message, exit code 1, no
    panic backtrace
  - `cargo test` green at the end
REPORT: lines in main.rs before/after, list of extracted functions with
their signatures, and the diff of program output before vs after (should
be empty).
```

---

## Phase 4: Automated Polish Tooling & CI

### Prompt 4.1 — Standing Rule: The Polish Pipeline After Every Edit
```text
For the rest of this session, run this 5-step polish pipeline after EVERY
code change you make, before you report back to me. No exceptions, no
batching:
  1. `cargo check`  — must be zero errors AND zero warnings
  2. `cargo fix --allow-dirty --allow-staged` — auto-apply unambiguous
     compiler fixes (unused vars → _prefix, unused imports, unused parens).
     After it runs, show me `git diff --stat` so I can see what it touched.
  3. `cargo clippy --all-targets -- -D warnings` — lints are ERRORS, not
     suggestions. Fix every one idiomatically (see rules below).
  4. `cargo fmt` — then `git diff --stat` again. Formatting-only changes
     should never be mixed into a feature diff I review.
  5. `cargo test` — the polish must not change behavior. If any test
     fails after steps 2–4, a "fix" changed semantics: REVERT it and
     diagnose properly.
Clippy fix rules:
- Fix the lint the IDIOMATIC way, not the suppression way. Never reach for
  #[allow(...)] unless you can explain in a comment why the lint is wrong
  for this specific case.
- Prefer: std constants over hand-rolled approximations (PI not 3.1415),
  iterator combinators over manual accumulation loops, ? over try!-style
  match blocks, borrows over clones.
- If a lint points at a real design issue (e.g. clippy::too_many_arguments
  or a needlessly_complex type), STOP and tell me before papering over it.
Acknowledge and wait for my first task.
```

### Prompt 4.2 — Post-Generation Cleanup (Warning-Free Output)
```text
I just pasted/generated a large chunk of code into this crate and it's
noisy — compiler warnings, dead code, leftover scaffolding. Clean it up:
1. Run `cargo check` and give me the full warning list, grouped:
   - unused_variables / unused_imports / unused_mut / dead_code
   - suspicious-but-legit (unused_must_use means a Result is being
     dropped — that's a BUG hiding as a warning, not noise; treat
     differently)
   - everything else
2. Run `cargo fix` for the mechanical fixes, then handle the rest
   manually with judgment:
   - Intentionally-unused binding → rename to _ or _name
   - Leftover scaffolding/imports → DELETE, don't silence
   - unused_must_use → this is dropped Result/Option; either handle it
     properly or explicitly discard with `let _ =` plus a comment saying
     WHY discarding is safe. Never blanket-allow this lint.
3. `git diff` review: walk me through every change cargo fix and you made,
   one line each, so I can confirm semantics were preserved. If any change
   touched logic rather than hygiene, flag it loudly.
4. Gate: `cargo check` with zero warnings, `cargo clippy` clean,
   `cargo test` green (unchanged behavior).
Deliverable: warning count before/after, plus the diff summary.
```

### Prompt 4.3 — Full Clippy Deep Pass
```text
Run `cargo clippy --all-targets` and give me a full audit, but don't fix
anything yet. For each distinct lint that fires:
1. LINT NAME + COUNT of occurrences
2. ONE-LINE plain-English explanation of what the lint detects and why
   Rust considers it a problem (perf / correctness / readability)
3. CLASSIFICATION:
   - MECHANICAL: pure style, zero risk to fix (e.g. needless_return,
     redundant_clone) → fix automatically
   - SEMANTIC: changes behavior or reveals a possible BUG (e.g.
     clippy::question_mark on a match that isn't just error propagation,
     clippy::iter_next_loop, float equality) → show me the code and your
     analysis BEFORE touching it
   - DESIGN: signals a deeper issue (too_many_arguments, type_complexity,
     cognitive_complexity) → propose 2 restructuring options with
     tradeoffs, let me choose
4. After I approve: apply fixes per classification, run the full pipeline
   (check → fix → clippy -D warnings → fmt → test), report results.
Also: check our dependencies for common footguns — if clippy flags nothing
but we're hand-rolling something std already provides (saturating math,
sorting patterns, string trimming), mention it as a bonus finding.
```

### Prompt 4.4 — Idiom Upgrade (Loops → Combinators)
```text
This code compiled from an early AI pass and works, but it's written in a
C-in-Rust style. Modernize it idiomatically (Chapter 13 iterator patterns +
Clippy standards):
Targets, in priority order:
1. Manual accumulation loops → iterator chains:
   `for x in xs { if pred(x) { out.push(f(x)); } }`
   becomes `xs.iter().filter(|x| pred(x)).map(f).collect()`
2. match-on-Result/Option blocks that just return early → `?` operator
3. `.iter().cloned().collect::<Vec<_>>()` chains that can be direct
   collects; unnecessary `.clone()` / `.to_owned()` (verify against
   borrow-check reality — don't introduce lifetime fights to avoid a clone;
   if removing a clone requires redesign, tell me)
4. `if x.is_some() { x.unwrap() }` patterns → `if let Some(v) = x`
5. String formatting loops → single format!/write! calls
6. Ranges `0..vec.len()` indexing → direct iteration
Rules:
- One category at a time, `cargo test` after each — behavior must be
  bit-identical.
- If a "modernization" would hurt readability (nested combinators three
  lines deep), keep the explicit loop and say so. Idiomatic ≠ clever.
- Run `cargo clippy` at the end and confirm we didn't trade lints for lints.
Report: each transformation as before/after snippet, with a verdict on
readability (better / worse / wash).
```

### Prompt 4.5 — Pre-Commit Hook Setup
```text
Set up a git pre-commit hook that runs the polish pipeline automatically
so neither I nor the AI can commit unpolished code. Requirements:
1. Create .git/hooks/pre-commit (and a tracked copy at
   scripts/pre-commit so the team can install it via
   `git config core.hooksPath scripts` or a symlink — pick one approach,
   document it in the hook header comments):
   - Run `cargo fmt --check` first — if it fails, print "run cargo fmt"
     and exit 1 (fast fail, since fmt is cheapest)
   - Run `cargo check` — exit 1 on any warning
   - Run `cargo clippy --all-targets -- -D warnings` — exit 1 on any lint
   - Run `cargo test` — exit 1 on failure
   - Make each stage skippable in emergencies with
     `SKIP_POLISH=1 git commit ...` — but the hook must echo a loud
     warning when skipped
2. Performance details:
   - Use `cargo check` not build; tests last since theyre slowest
   - Pipe output through and only show failures plus a one-line
     "all gates passed" on success — a silent hook is a good hook
   - Handle the case where cargo/rust isn't on PATH in GUI git clients:
     resolve the cargo path at hook-write time and hardcode a fallback
     comment
3. VERIFY it actually works — this is the part people always skip:
   - Introduce a deliberate fmt violation on a scratch branch, attempt a
     commit, confirm it's blocked
   - Same for a clippy lint (add `let x = 3.1415;` somewhere)
   - Same for a failing test
   - Then `SKIP_POLISH=1` and confirm the bypass works
   - Clean up the scratch branch
4. Report: the hook file contents, install instructions, and the results
   of each verification attempt (blocked/bypassed as expected?).
Do NOT use husky/pre-commit-framework external dependencies — plain POSIX
sh, works offline.
```

### Prompt 4.6 — CI Gate setup
```text
Extend the polish pipeline from local hooks to CI so the gates run on
every push, regardless of what machine the code was written on:
1. Create .github/workflows/ci.yml (or add to existing):
   - fmt: `cargo fmt --all -- --check`
   - clippy: `cargo clippy --all-targets --all-features -- -D warnings`
   - test: `cargo test --all-features` (with `RUST_BACKTRACE: 1` in env
     for debuggable failures)
   - MSRV check if we have a pinned rust-toolchain.toml — confirm what
     our declared MSRV is and that clippy lints don't require a newer
     compiler than it
   - Cache cargo registry + target dir between runs (the standard
     Swatinem/rust-cache action or manual keying on Cargo.lock hash)
2. Pin the toolchain: add/verify rust-toolchain.toml pins channel + the
   clippy and rustfmt components, so local and CI lint results can't
   drift due to toolchain version differences.
3. Matrix strategy only if we actually need it (multiple OS / MSRV) —
   don't add complexity we won't use. Default: single ubuntu-latest job.
4. Report: full workflow file, expected runtime per job, and what I need
   to enable in the GitHub repo settings (branch protection: require the
   CI check before merge).
```

### Prompt 4.7 — Semantic-Preservation Proof for Big Fixes
```text
I'm about to let the toolchain rewrite a lot of code at once (cargo fix +
a big clippy pass across the whole crate). Before touching anything,
establish a safety net so we can PROVE nothing broke:
1. Snapshot current behavior: run every binary entrypoint and example
   with a fixed set of inputs, capture full stdout+stderr+exit codes to
   files under /tmp/baseline/
2. Run `cargo test` and record the exact pass/fail/ignored counts
3. If we don't have enough integration coverage to trust, say so NOW and
   write the missing characterization tests FIRST (tests that lock in
   current observable behavior, even if that behavior isn't perfect)
4. Only then: `cargo fix` → clippy fixes → `cargo fmt`
5. Re-run the snapshot suite and `cargo test`. Requirement: byte-identical
   outputs and identical test counts. ANY diff = revert the offending fix
   and handle it manually.
6. Report: baseline vs after — test counts, snapshot diff summary (should
   be empty), and any fixes you reverted as too risky.
Rule for the session: after this, we keep characterization tests current
with every feature, so this safety net is always available.
```

---

## Phase 5: DDIA Architechture & Reliability (Chapter 1)

### Prompt 5.1 — Latency Instrumentation Layer
```text
Instrument our service with real tail-latency tracking, Chapter 1 style.
Averages hide the truth — we need percentiles.
1. AUDIT first: find every existing timing/latency measurement in the
   codebase. List each one and classify: average-based (replace) /
   percentile-based (keep) / nonexistent (create).
2. IMPLEMENT a middleware/interceptor layer:
   - Record response times per endpoint, per route, per status class
   - Use an HDR Histogram (or t-digest if we're memory-constrained) —
     NEVER store raw samples in an unbounded vec, never compute a rolling
     arithmetic mean as the headline metric
   - Expose p50 / p95 / p99 / p99.9 on demand: a /metrics endpoint,
     admin command, or whatever fits our serving stack
   - Aggregation rule baked into the design: percentiles are NEVER
     averaged across instances or windows. If we run multi-node, use
     histogram merging (HdrHistogram supports add()/union), not mean-of-
     p99s. Write this rule into a comment at the aggregation point so
     nobody "helpfully" averages later.
3. PROVE IT: write a test that feeds the histogram a known distribution
   (e.g. 1000 samples: 990 at 10ms, 10 at 2000ms) and asserts p50 ≈ 10ms
   while p99 ≥ 2000ms. If p50 and p99 come out close together, the
   measurement is wrong — this test is the canary.
4. Report: where metrics live, how to query them, and the verification
   test output.
```

### Prompt 5.2 — Fan-Out Tail-Latency Shield
```text
Our service fans out to [N] backend dependencies in parallel per request.
Chapter 1's tail-latency amplification math: if each backend has even 1%
slow requests, a fan-out of ~100 backends means ~63% of user requests wait
on a slow one. Build the defense:
1. MEASURE FIRST: before writing any defense, add per-backend-call timing
   and report current p50/p95/p99 per dependency, plus the END-TO-END
   p99 of the parent request. We need a baseline or we can't prove the
   fix worked.
2. IMPLEMENT the wrapper, in layers:
   a. AGGRESSIVE TIMEOUT: per-backend-call deadline, sized from the
      measured p99 + margin (show me your sizing math). Not one global
      timeout — per dependency class.
   b. CACHE FALLBACK: on timeout/error, serve last-known-good from a
      bounded in-memory cache (with TTL + size cap — unbounded fallback
      caches become the next outage). Log every fallback hit to telemetry
      as a first-class event, not a debug line.
   c. HEDGED REQUESTS (optional layer, enable per-dependency): issue a
      retry to a second replica after the p95 wait time, take whichever
      responds first. Dedup so a slow original response arriving late
      doesn't clobber the hedged one. This costs extra load — make it
      per-dependency configurable and OFF by default until we measure.
   d. PARENT REQUEST NEVER FAILS because one child failed. Degraded
      partial results beat a 500.
3. VERIFY with a fault-injection test harness: a mock backend where I can
   dial in (a) fixed delay, (b) p99-style 1-in-100 2-second delays,
   (c) full failure. Run the parent request 1000 times against each
   scenario BEFORE and AFTER the wrapper. Required outcome: parent p99
   stays near baseline in scenario (b) and (c); fallback-hit counter is
   nonzero.
4. Report: baseline vs after numbers (p50/p95/p99 tables), the sizing math
   for each timeout, and which dependencies you enabled hedging on and
   why.
```

### Prompt 5.3 — Circuit Breaker & Degradation Isolation
```text
Build a circuit breaker around our [client/wrapper] for [dependency X],
aimed at the Chapter 1 failure mode: a slow dependency saturates our
worker threads and turns one backend's problem into OUR outage
(cascading failure).
Requirements:
1. THE BREAKER, with real state semantics:
   - CLOSED: pass through; count consecutive failures AND latency
     violations (a call that SUCCEEDS but takes > threshold counts — slow
     is a failure mode too, this is what protects against saturation)
   - OPEN after 5 consecutive failures OR when rolling latency crosses
     500ms p99 over a 1-minute window — whichever first. Make both
     thresholds configurable.
   - HALF-OPEN: after a cooldown (configurable, suggest from measured
     recovery time), allow ONE probe call. Success → CLOSED. Failure →
     reopen, double the cooldown (exponential back-off, capped).
   - All state transitions emitted as telemetry events (breaker_state_change
     {dependency, from, to, reason}) — silent breakers are undiagnosable.
2. DEGRADED DEFAULTS: when OPEN, return a fallback (stale cache / partial
   data / static payload — pick per call site WITH me, don't guess).
   Include a marker in the response metadata so callers can distinguish
   "real" from "degraded" data.
3. VERIFY with a fault-injection suite:
   - Kill the dependency → breaker opens within the failure threshold
   - Slow dependency (2x latency, still succeeding) → breaker opens on
     the LATENCY rule (prove the slow-is-failure path works)
   - Recovery → half-open probe → closed, with cooldown doubling observed
   - During OPEN: parent requests get degraded responses, zero thread
     pile-up (show me the in-flight count staying flat while OPEN)
4. Report: state-transition log from the test run, the exact thresholds
   chosen with sizing rationale, and any call sites where you weren't
   sure what the degraded default should be (list them — I'll decide).
```

### Prompt 5.4 — Config Guardrails
```text
Chapter 1's data: operator error is the leading cause of outages;
hardware is only 10–25%. Build the config-layer defense so a bad operator
input can never reach live threads unvalidated:
1. STRICT SCHEMA: config parsing moves from ad-hoc env/flag reads to a
   validated schema:
   - Every field has: type, allowed range, default, and a one-line
     doc comment explaining the failure mode it controls
   - Unknown fields are REJECTED, not ignored (typos silently ignored =
     the worst class of operator error)
   - Invalid values produce errors that say: what's wrong, what was
     received, what the allowed range is, and what the default is
2. DRY-RUN MODE: any config change can be validated without applying:
   - `validate` path: parse + check + report, touch nothing
   - Config reload endpoint/command prints a diff of what WOULD change
   - Reload is atomic: build the new config fully first, swap on success,
     zero half-applied states
3. SAFE DEFAULTS ON ERROR: if live config becomes unreadable/corrupt at
   runtime, fall back to last-known-good + alarm loudly. NEVER fall back
   to an empty/default config silently — that's how production gets
   quietly misconfigured.
4. TEST the failure modes:
   - Missing required field → clear error
   - Out-of-range value → clear error naming the range
   - Typo'd field name → "unknown field" error (this is the test that
     matters most)
   - Corrupt live config → last-known-good fallback + alarm fired
   - Dry-run shows diff, changes nothing
5. Report: the schema, the error-message examples from the tests
   (verbatim), and the reload/rollback flow.
```

### Prompt 5.5 — Load-Generation & Benchmark Harness
```text
Build a benchmark harness for [service], but obey Chapter 1's first rule
of benchmarking: the load generator must send requests INDEPENDENT of
response arrivals. A client that waits for each response before sending
the next shrinks server queues and produces deceptively pretty numbers.
Requirements:
1. CLOSED-LOOP vs OPEN-LOOP, both available, clearly labeled:
   - OPEN-LOOP (the honest one for capacity testing): N requests/second
     fired on a schedule regardless of responses; track offered load vs
     completed load — divergence = saturation point found
   - CLOSED-LOOP (fine for latency-under-fixed-concurrency): fixed
     worker count, each sends next request on response
   - Default to open-loop for any "how fast is it" question; closed-loop
     only when mimicking a specific real client behavior
2. MEASUREMENT CORRECTNESS:
   - Record latency CLIENT-SIDE (start timer before send, stop after
     full body read) — server-side times flatter the system
   - HDR histogram of latencies; report p50/p95/p99/p99.9 AND the
     offered-vs-completed throughput curve
   - Warmup phase discarded from results (report how long warmup ran)
   - Steady-state duration long enough to catch GC/queue buildup
     (suggest ≥ 5 min for anything claiming p99)
3. SCENARIOS: parameterizable RPS ramp (find the knee), burst test
   (queueing behavior), and a slow-backend mode where one dependency is
   throttled (feeds Prompt 2/3 verification).
4. RUN IT against the current service and report: the saturation knee,
   p99 at 50% load vs 90% load (this gap is the queueing story), and
   whether the harness numbers match whatever production dashboards claim
   (flag any big mismatch — someone is measuring wrong, possibly us).
5. Deliverable: the harness, one full benchmark report run by you, and a
   one-page README on which mode to use for which question.
```

### Prompt 5.6 — Chaos / Fault-Injection Test Suite
```text
Chapter 1's prescription: you can't prevent all faults, so continuously
TEST the fault-handling paths in a safe environment. Build the chaos
suite for [service]:
1. FAULT CATALOG — enumerate the faults worth testing (map each to its
   defense):
   - Process kill (defense: supervisor/restart correctness)
   - Backend dependency: slow, then dead, then flaky (timeouts, circuit
     breaker — verifies Prompts 2 & 3)
   - Network: delayed, lossy, partitioned (retry/backoff behavior)
   - Disk full / slow disk (I/O error paths)
   - Config corruption mid-run (last-known-good — verifies Prompt 4)
2. RUNNERS: each fault as an automated, repeatable test:
   - Use fault injection at the client/mock layer (deterministic) rather
     than raw network manipulation where possible — flaky chaos tests get
     ignored, and ignored tests are worse than none
   - Each test asserts the SYSTEM-LEVEL property: no cascading failure,
     bounded degradation, recovery without manual steps
   - Tag each test with expected-behavior doc: what should happen, which
     component defends, what telemetry fires
3. SAFETY: the suite must be incapable of touching anything but the test
   environment — no production endpoints, no shared state. Assert this
   (env check at suite start that hard-fails outside a designated test
   profile).
4. RUN the full suite now and report: which faults we survive cleanly,
   which degrade gracefully, and which cause failure — the last category
   is the actual output of this exercise; everything found there goes on
   the fix list with priority.
5. Cadence recommendation: which subset runs per-commit (fast, mock-only)
   vs nightly (slower, environment-level), and wire the fast subset into
   CI if it isn't already.
```

### Prompt 5.7 — Architecture Review Through the RSM Lens (Standing Instruction)
```text
Act as my Chapter 1 reviewer for the rest of this session. For every
architectural decision, component, or dependency we add, run this
three-pillar check and state the answers explicitly:
RELIABILITY:
- What are this component's likely FAULTS (not failures — component-level
  deviations)? Hardware, software (systematic, correlated across nodes —
  the dangerous kind), human (operator error — the most common kind).
- For each fault: does the system as a whole keep working? Which layer
  defends? If the answer is "nothing defends that yet," say so plainly.
- Any new shared dependency added = new correlated-fault surface. Call it
  out; quantify blast radius (what breaks if it's down for 1 min? 1 hr?)
SCALABILITY:
- What's the LOAD PARAMETER for this component (RPS? write fan-out? cache
  hit ratio? active connections?) — name the ONE number that defines
  load here.
- What's the fan-out: does one user request multiply into N internal
  calls? What's N, and what's the tail-latency implication (1% slow child
  × N children)?
- Where's the queue? Every system has one; name it and its behavior at
  10x load.
MAINTAINABILITY:
- Operability: can an on-call human debug this at 3am with the telemetry
  it emits? If not, what telemetry is missing?
- Evolvability: what change is most likely in 6 months, and how boxed-in
  is this design against it?
Format: three short sections per decision, plain answers, no hedging. If
a pillar has a red flag, lead with it.
```

---

## Phase 6: DDIA Data Models & Storage (Chapters 2-3)

### Prompt 6.1 — Access-Pattern-Driven Schema Decision
```text
We're choosing the data model for [domain, e.g. "a multi-tenant project
management app"]. Do NOT default to one model — run Chapter 2's analysis
and let the access patterns decide.
1. INVENTORY our access patterns first. List every read and write we know
   about, and for each one classify:
   - SHAPE: one-to-many tree (self-contained document) vs many-to-one /
     many-to-many (interconnected, join territory)
   - LOCALITY: does the reader always want the WHOLE aggregate in one
     shot, or does it traverse relationships unpredictably?
   - WRITE RATE per entity vs READ RATE — high-write entities hate
     denormalization (every write multiplies)
2. Apply the Chapter 2 rules explicitly and state them:
   - If the core aggregate is a self-contained tree → document model
     wins on locality (single lookup, no shredding)
   - If we have genuine many-to-many (shared orgs, references,
     recommendations) → document model forces application-level joins =
     multiple round trips + application-side consistency burden. That's
     relational's home turf — say so even if you like document DBs
   - Schema-on-read only if payloads genuinely evolve heterogeneously.
     "Flexible schema" chosen out of laziness becomes a data-cleaning
     debt — schema-on-write exists to catch corruption at write time
3. HYBRID call: most real systems need both. If so, draw the boundary:
   which aggregates are documents, which relations are relational, and
   how they stay consistent (source of truth per entity — name it).
4. DELIVERABLES:
   - The decision, with the two or three access patterns that were
     decisive (quote them)
   - Schema stubs for the chosen model(s): DDL for relational, document
     shapes with validation schema for document — include the
     many-to-many junction tables / reference arrays explicitly
   - The explicit NON-goals: what this schema will NOT handle well, so
     nobody is surprised in 6 months
If you find yourself reaching for a document model AND emulating joins
in application code for 3+ relationships, stop and re-present the
relational option honestly.
```

### Prompt 6.2 — Document vs Join Read Benchmark
```text
Chapter 2 claims document models win on read locality for tree-shaped
aggregates, and relational wins on many-to-many traversals. Don't take
the book's word or mine — measure it for OUR data.
1. Build both schemas for our [aggregate, e.g. "customer profile with
   nested order/contact history"]:
   a. Document version: single JSON document per customer, embedded arrays
   b. Relational version: 4 normalized tables with foreign keys
2. Seed each with realistic data: [N] aggregates, with realistic nesting
   depth (an average profile AND a p95-fat one — locality claims often
   collapse on the fat tail).
3. Benchmark, using the harness rules from our benchmarking work
   (open-loop load generator, client-side HDR histograms, p50/p95/p99 —
   never averages):
   - QUERY A: fetch one complete aggregate by ID (the document model's
     best case)
   - QUERY B: traverse a many-to-many: "all customers who share an
     organization with customer X" (the relational model's best case)
   - Run each under concurrency [C]
4. Report a table: p50/p95/p99 per query per model. Also report the
   N+1 cost explicitly: how many round trips does the losing model need
   for QUERY B, and what's the total latency once you pay all of them
   (application-level join cost is the number people forget).
5. Verdict: which model wins which query, by how much, at our scale —
   with the caveat that your seed data is synthetic and which specific
   real access pattern would flip the result.
Deliverable: benchmark code we can re-run as schema evolves, the results
table, and the verdict.
```

### Prompt 6.3 — LSM-Tree Storage Wrapper
```text
We're building a high-throughput [event/metric] ingestion path and need
an embedded LSM-tree store configured correctly, not with defaults.
Generate a storage wrapper around [RocksDB / an embedded LSM engine]
with:
1. DURABILITY: WAL enabled with proper fsync policy — state explicitly
   what crash window we're accepting (every write synced vs group-commit
   every N ms), and put the number in a named constant with a comment
   explaining the trade-off.
2. WRITE PATH configured deliberately:
   - Memtable sizing: justify the size from our expected write rate and
     acceptable flush frequency (show the arithmetic: write rate × size
     = flush interval)
   - Compaction style: leveled vs tiered — pick based on our read/write
     ratio and explain in two sentences (tiered: better write amp, worse
     read amp; leveled: opposite)
   - Compaction rate limits: so background compaction can't starve the
     foreground write path at peak load — this is the compaction-stall
     defense, don't skip it
3. READ PATH:
   - Bloom filters ON for the last N levels (justify N)
   - Block cache sized meaningfully (not the default) with the sizing
     arithmetic shown
   - The missing-key lookup path documented: memtable → bloom → L0 →
     deeper levels, with expected cost per hop
4. VERIFY with a benchmark: sustained random writes at our target rate
   for [duration]. Required outputs:
   - Write p50/p95/p99/p99.9 over the run
   - Evidence of compaction stalls: watch for p99 spikes correlating
     with compaction jobs; report the worst spike and whether rate
     limits contained it
   - Point-lookup latency for existing AND missing keys (missing-key
     latency proves the bloom filters earn their keep)
5. Report: the full config with every non-default value justified,
   benchmark tables, and any stall events observed with their cause.
```

### Prompt 6.4 — Compaction Stall Hunt
```text
Our LSM-backed [service] is showing tail-latency spikes. Chapter 3's
usual suspect: background SSTable compaction consuming disk I/O exactly
when the foreground path needs it. Investigate properly:
1. BASELINE: capture current write p99/p99.9 and read p99/p99.9 over
   [duration] with compaction telemetry enabled (compaction job count,
   bytes compacted, I/O wait).
2. REPRODUCE: run a sustained write load and correlate latency spikes
   with compaction events — build the correlation table (spike timestamp
   vs compaction job start/finish). If spikes don't correlate with
   compaction, SAY SO and present the actual correlation you found
   (GC? fsync bursts? WAL rotation?). Don't force the theory.
3. MITIGATIONS, applied and re-measured one at a time (change one knob,
   re-run, record — no knob salads):
   a. Compaction rate limiting (iobytes/sec cap)
   b. More/fewer background compaction threads
   c. Larger memtable → fewer, larger flushes
   d. Tiered→leveled or vice versa (only if read-amp evidence supports)
   e. If disk-bound: is the WAL on separate spindles/queue from SST
        files? Document whether our deployment even allows that
4. Report: spike attribution (what fraction of p99.9 events were
   compaction-correlated), the per-knob effect table, the final config,
   and the residual tail behavior we did NOT fix (name it — every LSM
   has one).
Constraint: all measurements with the honest harness (open-loop,
client-side histograms). Server-side latencies flatter the system and
will hide exactly the stalls we're hunting.
```

### Prompt 6.5 — Columnar Offload Pipeline
```text
Our production PostgreSQL is degrading because analytical queries
([describe: dashboards, aggregations, reporting]) scan a [50M]-row
events table. Chapter 3's answer: OLTP and OLAP have opposite physical
layouts — stop serving both from one engine.
1. DESIGN the offload:
   - ETL/extract: streaming (logical replication / CDC) beats scheduled
     bulk extracts for freshness — recommend one and justify
   - FORMAT: columnar files (Parquet or native for [DuckDB/ClickHouse/
     BigQuery — pick based on our ops reality]), partitioned by
     [time dimension], with compression codec chosen and justified
   - LAYOUT: if this feeds a star schema later, name the fact table and
     dimension tables now — even if we only build the fact table today,
     the grain decision (one row per event) is permanent; get it right
2. THE CUTOVER contract: which queries MOVE to the analytical engine,
   which STAY on Postgres. Rule: anything scanning > [N] rows or
   aggregating without an index goes to OLAP. Anything touching a single
   key stays. Write this rule into a doc comment in the code and a runbook
   note.
3. VERIFY the win: run the top [3] offending analytical queries on both
   engines at current data volume (plus a 10x extrapolation if seeding
   is feasible). Report: query duration, rows scanned, and Postgres
   impact during the run (lock waits, replication lag if applicable).
   The bar: analytical query moves off Postgres AND gets faster.
4. FRESHNESS: state the data lag explicitly (replication delay +
     batching interval) and make it a monitored metric with an alert.
     Silent ETL lag becomes "why do the dashboards disagree with
     production" — the most classic failure of this architecture.
5. Report: pipeline diagram (as text), measured before/after table,
   the query-cutover list, and the lag budget + monitoring.
```

### Prompt 6.6 — Row vs Column Aggregation Benchmark
```text
Chapter 3's core claim: analytical queries on columnar storage read ~3%
   of the bytes a row store reads (3 of 100 columns). Verify it on our
   actual event data before we commit to an offload:
1. Build both representations of our events table:
   - Row: PostgreSQL (or SQLite if no PG available — note the caveat)
   - Columnar: Parquet files queried via [DuckDB / polars / pyarrow]
   Same data, same queries, same machine.
2. Queries (the realistic analytical set, not toys):
   - Aggregation over a time window: SUM/AVG grouped by dimension
   - Filtered count: WHERE on a low-cardinality column
   - A full-scan DISTINCT (worst case for both)
   Run each cold (page cache dropped) AND warm. Cold is the honest one
   for analytical workloads; warm matters for dashboards.
3. Measure: query duration, and where the tooling allows it, bytes read
   from storage. The bytes-read ratio IS the mechanism — if columnar
   isn't reading dramatically fewer bytes, something's misconfigured
   (row-group sizes, compression, projection not pushed down) and the
   benchmark is lying.
4. Report: per-query table (row vs columnar, cold vs warm), the
   bytes-read ratio per query, and the configuration details that made
   columnar win or fail (row group size, compression codec, predicate
   pushdown verified ON).
5. Deliverable: the benchmark script parameterized by row count so we
   can re-run it at 100M rows before final commitment.
```

### Prompt 6.7 — B-Tree vs LSM Selection Decision Record
```text
We're choosing an embedded storage engine for [workload description].
Run the Chapter 3 comparison as a decision record, not a vibe.
1. WORKLOAD PROFILE — quantify before choosing:
   - Read:write ratio (point reads? range scans?)
   - Write pattern: random keys vs sequential appends
   - Value sizes (LSM handles large values worse — amplification math)
   - Read tolerance: is a rare 500ms read spike acceptable, or do we
     need B-tree's predictable "every key in exactly one place"
     latency?
2. APPLY the trade-offs explicitly:
   - LSM wins: write-heavy, sequential-write advantage, space efficiency
     after compaction; loses: read amplification, compaction stalls,
     unpredictable tail
   - B-tree wins: predictable reads, range scans, transactional
     update-in-place; loses: write amplification (full-page overwrites),
     fragmentation
   - State where OUR workload sits on each axis with the numbers from
     step 1
3. If the answer is "it depends," propose: LSM for the write-heavy event
   path + B-tree (or an in-memory index) for the read-serving path, with
   the consistency story between them NAMED (which is source of truth,
   what's the lag).
4. OUTPUT as an actual decision record file: context, options, decision,
   consequences (what we gain, what pain we're signing up for — every
   engine choice buys one pain and sells another; write down the one we
   bought).
5. Include the falsification clause: "We chose X assuming read:write ≈
   1:10. If measured ratio goes below 1:3 for a quarter, revisit." —
   decisions without reversal conditions never get revisited.
```
`