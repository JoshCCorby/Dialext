# Claude Code Agent Protocol & Strict TypeScript Execution Guide

> **AGENT DIRECTIVE & EXECUTIVE LICENSE:**
> You are operating within an **existing, large codebase**. You are hereby granted **Executive Authority** to evaluate, grade, prune, or skip any instructions or prompts in this document that are non-applicable, redundant, or counter-productive.
>
> **Your Mandatory Execution Steps Before Running Any Prompts:**
> 1. **Codebase Assessment:** Scan existing configuration files (`tsconfig.json`, `package.json`, target directories).
> 2. **Audit & Grade Prompts:** Evaluate each task/prompt against the current state of the repository:
>    - `[PASS / RUN]`: Relevant and necessary for codebase health.
>    - `[SKIP / TOKEN-SAVER]`: Already satisfied, redundant, or unnecessary (e.g., re-initializing an existing setup).
>    - `[ADAPT]`: Requires modification to fit the current project structure.
> 3. **Conserve Tokens & Time:** Do not run full-repository builds if localized, directory-specific checks (`npx tsc --noEmit --project ...`) are sufficient. Cut useless work immediately.

---

## Phase 0: Initial Codebase Audit Protocol

Before running any refactoring or type-enforcement tasks, execute this audit step:

```bash
# Check compiler output and identify failure hotspots without emitting files
npx tsc --noEmit
```

*Agent Instructions:*
- Summarize top compiler error codes (e.g., TS7006, TS2345, TS2739).
- Identify high-risk modules (`src/api`, `src/services`, `src/utils`, etc.).
- Output a short Execution Plan listing which sections of this document will be executed or skipped.

---

## Phase 1: Compiler-Driven Feedback Loop & Guardrails

### 1. Existing Config Audit (Adapted from Project Setup)
*Agent License: Do NOT re-initialize `package.json` or `tsconfig.json` from scratch. Instead, audit the existing config.*

**Prompt / Action:**
```text
Audit the root tsconfig.json. Ensure strict options are enabled:
"strict": true, "noImplicitAny": true, "strictNullChecks": true, "strictBindCallApply": true, "noImplicitThis": true, "noImplicitReturns": true.
If any are set to false, report the downstream impact before modifying, then enable them incrementally.
```

### 2. Type-Driven Scaffolding
**Prompt / Action:**
```text
When creating new service modules, do not write implementation logic first. Create the corresponding interface shapes, type aliases, and function signatures in a localized types file (or module boundary). Ensure all optional fields use ? to force null-checking later. Wait for verification or cleanly validate types with `npx tsc --noEmit` before proceeding to implementation.
```

### 3. The Autonomous Refactor Loop
**Prompt / Action:**
```text
Run `npx tsc --noEmit` on the target directory/codebase. Read the error output.
Refactor functions throwing TS7006 (implicit any) or null-pointer warnings by adding explicit type annotations or generic parameters.
RULES: Under no circumstances use `any`, `@ts-ignore`, `@ts-nocheck`, or type assertions (`as any`) to bypass the compiler.
```

### 4. Self-Correcting Implementation Loop
**Prompt / Action:**
```text
Implement logic adhering strictly to project interfaces. After writing code, run `npx tsc --noEmit`.
If compiler errors occur (especially TS2345 assignability errors or missing return paths), read the exact error message, fix the type mismatch, and re-run.
Do not report completion until `tsc` exits cleanly with zero errors on affected files.
```

---

## Phase 2: Strict Domain Modeling & Type Safety

### 1. Banning `any` & Enforcing Refinement
**Prompt / Action:**
```text
Scan target directory (e.g., API consumers/handlers) for `any` applied to incoming payloads or responses.
Replace them with `unknown`. Write explicit user-defined type guards (e.g., `isSuccessResponse(res: unknown): res is SuccessResponse`) to narrow payloads safely.
Do not use `as TargetType` assertions. Run `npx tsc --noEmit` to verify.
```

### 2. Making Invalid States Unrepresentable
**Prompt / Action:**
```text
Analyze loose state interfaces in the codebase that allow invalid concurrent states (e.g., containing both `data?` and `error?`).
Refactor them into mutually exclusive discriminated unions with a shared literal string tag (`type` or `status`).
Update consuming components/functions and run `npx tsc --noEmit` to automatically fix downstream errors.
```

### 3. The Exhaustiveness Guarantee
**Prompt / Action:**
```text
When writing or refactoring reducer/handler switch statements operating on discriminated unions, enforce total exhaustiveness:
In the `default` branch, assign the unhandled event to a `never` type variable:
`const _exhaustiveCheck: never = event; return _exhaustiveCheck;`
Ensure the compiler throws totality errors if union cases are unhandled.
```

### 4. Deep Immutability
**Prompt / Action:**
```text
Review configuration objects and static dictionaries. Append `as const` to static object literals to prevent type widening.
For dynamic dictionaries, use index signatures enforcing `readonly` values.
Run `npx tsc --noEmit` and resolve any illegal mutation errors downstream.
```

---

## Phase 3: Functional Precision & Generics

### 1. Type-Driven Call Signatures
**Prompt / Action:**
```text
Define full call signatures for utility pipelines before implementation:
`type PipelineStep<Input, Output> = { (data: Input): Output };`
Verify signature validity with `npx tsc --noEmit` before filling in implementation details.
```

### 2. Bounded Polymorphism for Transformations
**Prompt / Action:**
```text
When writing entity mutation utilities, use upper bounds (`T extends { id: string }`) rather than base interfaces:
`function updateEntity<T extends { id: string; updatedAt: Date }>(entity: T, changes: Partial<T>): T`
Ensure specific subtype properties are preserved on return values. Validate with compiler checks.
```

### 3. Variadic Wrappers with Tuple Bounds
**Prompt / Action:**
```text
For higher-order functions or wrappers, avoid `(...args: any[]) => any`.
Use bounded variadic tuple types:
`function runTask<Args extends unknown[], Result>(task: (...args: Args) => Result, ...args: Args): Result`
Verify that calling the wrapper with invalid arguments triggers compile-time arity/type errors.
```

### 4. Refactoring Loose Utilities
**Prompt / Action:**
```text
Audit utility functions accepting generic `Record<string, unknown>` or `object` types that degrade return specificity.
Refactor them into generic functions using `<T>` parameters to preserve caller shapes. Validate caller type inference via `tsc`.
```

---

## Phase 4: Encapsulation & Architectural Contracts

### 1. Strict Contract Definition (`interface` vs `type`)
**Prompt / Action:**
```text
Use `interface` for domain object shapes and service abstractions to ensure clean inheritance and extendability.
Reserve `type` strictly for unions, intersections, tuple representations, and mapped utilities.
Avoid unnecessary type intersections (`&`) where clean interface extension (`extends`) applies.
```

### 2. Enforcing Encapsulation
**Prompt / Action:**
```text
Refactor domain model classes to mark internal state properties as `private` or `protected`.
Prevent structural impersonation (passing raw object literals where class instances are required) by ensuring private state or explicit nominal branding exists.
```

### 3. Decoupled Service Layers via `implements`
**Prompt / Action:**
```text
Define abstract service contracts (`interface Repository<T>`) separately from implementation classes (`class ConcreteRepository implements Repository<User>`).
Encapsulate internal collections using private scopes. Verify contract compliance using `npx tsc --noEmit`.
```

### 4. Companion Object Pattern
**Prompt / Action:**
```text
Pair domain types and utilities using Companion Objects:
Export an `interface User` and a matching `const User = { create(...): User, isEqual(...): boolean }` object in the same module scope.
Ensure clean dual export without identifier collisions.
```

---

## Phase 5: Dynamic Data Validation & Utility Pipelines

### 1. User-Defined Type Guards
**Prompt / Action:**
```text
Replace unsafe dynamic type assertions (`as MyType`) in data-parsing code with boolean type predicates (`res is TargetType`).
Use `typeof` and `'property' in object` runtime checks inside the guard body.
```

### 2. Mapped Types and Modifier Manipulation
**Prompt / Action:**
```text
Construct utility transformations using mapped types:
`type NullableProperties<T> = { [K in keyof T]: T[K] | null };`
`type Mutable<T> = { -readonly [K in keyof T]: T[K] };`
Verify mapped type behavior against target domain models with compiler checks.
```

### 3. Derived DTO Pipelines
**Prompt / Action:**
```text
Derive DTOs directly from core base entities using TypeScript's built-in utility types (`Omit`, `Pick`, `Partial`, `Readonly`) to prevent structural drift:
- `type CreateUserDTO = Omit<UserEntity, 'id' | 'createdAt'>;`
- `type UpdateUserDTO = Partial<CreateUserDTO>;`
```

### 4. Exhaustive Dictionaries with `Record<K, V>`
**Prompt / Action:**
```text
Map event handlers or strategies using explicit `Record<Keys, Values>` dictionaries:
`type HandlerMap = Record<AppEvent, (payload: EventPayload) => Promise<void>>;`
Ensure omitting any union key triggers a TS2739 compile-time failure.
```

---

## Phase 6: Type-Safe Error Handling & Monads

### 1. Refactoring Thrown Exceptions to Domain Error Unions
**Prompt / Action:**
```text
Audit domain services for `throw new Error(...)`.
Refactor domain operations to return typed error classes in union return signatures:
`Promise<UserData | UserNotFoundError | InvalidCredentialsError>`
Update call sites to force type narrowing (e.g., `instanceof`) before accessing data.
```

### 2. Enforcing `Result<T, E>` Patterns
**Prompt / Action:**
```text
For IO, network, or DB calls, wrap output in a `Result<T, E>` monad (`Ok<T>` | `Err<E>`) with a `readonly _tag: 'Ok' | 'Err'` discriminator.
Ensure callers cannot access `.value` without evaluating `_tag === 'Ok'`.
```

### 3. Boundary Mapping Without Global Catch Blocks
**Prompt / Action:**
```text
At HTTP/API boundaries, map returned domain error unions directly to structured responses (e.g., 400 Bad Request) using `switch` or `instanceof` checks. Avoid generic unhandled try/catch blocks that erase context.
```

### 4. Banning Unhandled `throw` in Core Services
**Prompt / Action:**
```text
Scan `src/services/` for `throw`. Replace recoverable application failures with returned error unions or `Result` types. Validate full codebase compatibility via `npx tsc --noEmit`.
```