# RepoPulse Lite — Development Log & AI Tooling Audit

**Candidate:** Vinutha Kiran
**Project:** RepoPulse Lite — deterministic GitHub repository health analyzer with an LLM executive audit
**Assessment:** 48-Hour Technical & Agentic Assessment — Geopage Consultants, Applied AI & Full-Stack Engineering Internship
**Window:** Aug 29–31, 2026 (hard deadline: Aug 31, 2026, 12:00 PM IST)
**Purpose:** Satisfies assignment Section 3.3 — AI Tooling Transparency & Detailed Development Audit Log

---

## 1. Tools & Harness

| Layer | Tool | Role in the build |
|---|---|---|
| IDE | VS Code on Windows | Hand-authored the spec; every AI-proposed diff was reviewed here before landing |
| AI harness | OpenCode CLI (interactive coding agent) | Primary harness driving scaffolding, implementation, test generation, and refactors under human direction |
| Terminal | PowerShell 5.1 | All git, build, typecheck, and test commands |
| Version control | Git via desktop CLI flow to GitHub | One conventional commit per logical change; pushed after each verified step |
| Verification gate | `next build` + TypeScript typecheck + Vitest | Mandatory green run before every commit, in every phase |

Operating loop: hand-authored direction (`SPEC.md` / `PLAN.md`) → OpenCode session in PowerShell → diff review in VS Code → corrections → build/typecheck/tests → conventional commit.

## 2. LLMs & Models Consulted

| Model | Channel | Use |
|---|---|---|
| z-ai/glm-5.3-free | tokenrouter (OpenAI-compatible endpoint), powering OpenCode CLI | Primary model: scaffolding, component code, test generation, refactoring suggestions, doc drafting |
| Claude / GLM chat | Web chat sessions | Formula sanity-check discussions (churn falloff bands, entropy normalization); no project code taken from these sessions |

The application's own `/api/audit` path is provider-agnostic (OpenAI-compatible `chat/completions`); the tokenrouter/glm-5.3 family named in `SPEC.md` §2.4 is one of the endpoints it was exercised against.

## 3. Human vs AI Contribution Breakdown

| Artifact | Human contribution | AI contribution (OpenCode + glm-5.3) |
|---|---|---|
| `SPEC.md` | 100% human — architecture, metric formulas, and weights designed before any code existed | None |
| Scoring engine math | Human-designed formulas (hygiene, churn, cadence, diversity, anomaly weights) | AI-assisted TypeScript implementation of the specified math |
| URL validator & SSRF rules | Human-defined acceptance/rejection rules (SPEC §6.1) | AI-generated regex and validator code |
| GitHub client & resilience | Human-set requirements: batching, cache, structured errors, no upstream leakage | AI-generated, human-reviewed |
| Dashboard components | Human UI contract (SPEC §5: gauge, charts, donut, leaderboard, states) | AI-generated React/Recharts components from that contract |
| Tests | Human hand-computed expected values | AI-generated test code and fixture shapes around those expectations |
| MCP server | Human decision to reuse the scoring engine for portability | AI-generated using `@modelcontextprotocol/sdk` documentation |
| README / DEVELOPMENT_LOG | Human-edited for accuracy and tone | AI-drafted from repo facts and git history |

**Aggregate split: ~30% human / ~70% AI-generated, all human-reviewed.**

Design, mathematics, and the security posture are 100% human; the AI share is concentrated in mechanical output (boilerplate, component code, test volume, formatting). Nothing was merged unread — 100% of commits were made by the human after review.

## 4. Development Timeline

Hashes, messages, and timestamps below are reproduced verbatim from the repository's git history. Each phase exit was gated on a green build, typecheck, and test run before the phase was marked complete.

### Phase 0 — Spec-First Scaffold (Aug 30, 22:56–23:13)

- `54a708d` **docs: author technical specification before any implementation** — SPEC.md committed before any code: all five metric formulas, weights, API contract, and defensive rules
- `9fe1470` **docs: add execution plan and assignment brief** — six-phase plan with commit cadence guardrails and risk register
- `ce9df6c` **chore: scaffold next.js app with typescript and tailwind**
- `b37d18d` **chore: add env example with provider placeholders** — placeholders only; real keys never entered version control

### Phase 1 — GitHub Ingestion & Defensive Backend (Aug 30, 23:26 – Aug 31, 00:20)

- `8113c23` **feat: add strict github url validation with ssrf rejection** — hostname allowlist, https-only scheme, regex-enforced `owner/repo`, 400 + reason on anything else
- `2c8d2cf` **feat: implement github client with token support and caching** — optional `GITHUB_TOKEN` (60 → 5,000 req/h), in-memory analysis cache
- `a85662c` **feat: add rate limit resilience with backoff and structured errors** — structured 429 with `retryAfter`, bounded retries on 5xx, no upstream body leakage
- `5a972b7` **feat: wire analyze endpoint returning raw commit telemetry** — scoring deferred to Phase 2 by design
- `3e47f2c` **fix: allow trailing hyphens in repository names to match github rules** — the initial regex was stricter than GitHub itself; this project's own repo name (`RepoPulse-Lite-`) is a legitimate trailing-hyphen case
- `2f8a329` **docs: mark phases 0 and 1 complete in execution plan**

### Phase 2 — Deterministic Scoring Engine (Aug 31, 06:36–07:42)

- `1fdb833` **chore: add vitest with test scripts and env example throttle note**
- `326e636` **feat: implement tier classifier for commit risk levels** — baseline Tier 1/2/3 model from the assignment
- `5046108` **feat: add multi-dimensional composite health score engine** — 0.25·Hygiene + 0.20·Churn + 0.20·Cadence + 0.20·Diversity − capped anomaly penalty
- `19fe8bd` **feat: wire scoring engine into analyze endpoint response**
- `4ed3abf` **test: add scoring engine unit tests with hand-computed fixtures** — expectations computed by hand first; AI wrote the test code around them
- `050cf23` **docs: mark phase 2 complete in execution plan**

### Phase 3 — Analytics Dashboard (Aug 31, 17:03–20:10)

- `6072f21` **feat: build analyze form and api client state machine**
- `ad93d84` **chore: add recharts for dashboard visualizations**
- `eccd914` **feat: add score gauge and metric breakdown charts**
- `185fdbc` **feat: add commit timeline, tier donut and author leaderboard**
- `4b92757` **feat: add anomaly feed, loading skeletons and error states** — distinct error surfaces for invalid URL, repo not found, rate-limited (with token hint), upstream 5xx, and network failure
- `b235b0b` **test: add dashboard client and component tests with jsdom environment**
- `18e9393` **docs: mark phase 3 complete in execution plan**

### Phase 4 — LLM Executive Audit (foundation Aug 31, 00:25; completed Sep 1, 01:26)

- `6eab4f8` **feat: add openai-compatible llm client with settings panel** — client foundation laid early, directly after Phase 1 closed
- `d19e884` **feat: generate executive risk report from metric snapshot** — a deterministic JSON snapshot (not raw logs) keeps tokens bounded and the prompt-injection surface minimal
- `4662942` **docs: mark phase 4 complete in execution plan**

### Phase 5 — MCP Server (Sep 1, 08:25–08:26)

- `ea5d291` **refactor: extract shared analysis orchestration for api and mcp reuse** — one code path for both surfaces
- `84e99c6` **feat: add mcp server exposing analyze-repo tool** — `analyze-repo` via `@modelcontextprotocol/sdk` over stdio, reusing `lib/scoring/`
- `5313244` **test: add shared orchestration and mcp server tests**
- `ae65486` **docs: mark phase 5 complete in execution plan**

### Phase 6 — Deploy & Documentation (Sep 1, 08:53 onward)

- `36ee3f3` **chore: configure vercel deployment**
- README (architecture, formulas, local setup) and this DEVELOPMENT_LOG.md are the final documentation deliverables; this file is subphase 6.3.

## 5. Prompting & Problem-Solving Log

Eight roadblocks that shaped the build, with the prompts and resolutions that unblocked them.

### 5.1 SSRF via `https://github.com@evil.com` — how to reject

Prompt: "The validator accepts `https://github.com@evil.com/o/r` because it sees `github.com` — how do we reject it?" Root cause: `github.com` sits in the URL's userinfo segment, so the actual host is `evil.com`. Resolution: parse the URL first, then enforce a strict hostname allowlist (`github.com` only), an `https`-only scheme allowlist, and regex-constrained `owner/repo` segments; anything else fails with HTTP 400 and a machine-readable reason (`8113c23`, SPEC §6.1).

### 5.2 GitHub's 60 requests/hour unauthenticated ceiling

Roadblock: fetching per-commit detail for 100 commits would exhaust the hourly budget on a single analysis. Design decision (human): batch detail fetches with bounded concurrency, cache full analyses in memory for 10 minutes, and keep `GITHUB_TOKEN` optional (60 → 5,000 req/h) so evaluators can supply their own token at runtime (`2c8d2cf`, `a85662c`, SPEC §6.2).

### 5.3 Making the engine deterministic

Requirement: same input must always yield the same score, forever. That means no `Date.now()`, no randomness, and no I/O inside `lib/scoring/`; time-relative math (span, inter-commit gaps) derives only from commit timestamps passed in as data, making every metric a pure function that fixed fixtures can pin down (`326e636`, `5046108`, SPEC §3).

### 5.4 Recharts refuses to render responsively in jsdom

Roadblock: dashboard tests crashed because Recharts' `ResponsiveContainer` waits on `ResizeObserver`, which jsdom does not implement. Resolution: mock `ResizeObserver` in the jsdom setup so tests assert component behavior — state transitions and prop-driven rendering — rather than browser layout (`b235b0b`).

### 5.5 Propagating 429 `retry-after` to the UI

Roadblock: a rate-limited GitHub call must never surface as a generic crash. Resolution: catch upstream 403/429, wrap as a structured 429 carrying `retryAfter`, and render an explicit "rate-limited — add a GITHUB_TOKEN" error state; exponential backoff (max 2 retries, 1s/2s) absorbs transient 5xx while upstream bodies stay wrapped and never leak to the client (`a85662c`, SPEC §6.2).

### 5.6 Runtime settings vs key hygiene

Rule set (human-defined): values in localStorage are never sent unless the user explicitly overrides them; a Settings-panel key travels per-request to `/api/audit`, is never logged, and is never persisted server-side; when `.env` is configured instead, the server-side proxy keeps the key off the client entirely (`6eab4f8`, SPEC §2.4 and §4).

### 5.7 One analysis pipeline for MCP and API

Roadblock: the MCP server needed exactly the analysis `/api/analyze` performs — duplicating the pipeline would guarantee drift. Resolution: extract shared orchestration so both surfaces call a single code path, then cover that path with dedicated tests so future edits cannot silently diverge (`ea5d291`, `5313244`).

### 5.8 LLM provider outage

Requirement: the app must stay fully useful with zero LLM access. Resolution: when no key is configured, `/api/audit` degrades to a deterministic heuristic-only report built from the metrics, clearly labeled "Heuristic-only mode" in the UI, keeping the core value proposition intact through any provider outage (`d19e884`, SPEC §4).

## 6. Reflections

### What AI accelerated

- Boilerplate: scaffold config, repetitive component wiring, and doc formatting — hours compressed into minutes.
- Test volume: fixture generation around hand-computed expectations produced far more cases than a solo 48-hour build could write by hand.
- Refactoring legwork: the shared-orchestration extraction (`ea5d291`) was proposed, applied, and re-verified within a single session.

### What the human owned

- The spec: architecture, all five metric formulas, weights, and defensive rules were designed before any code existed (`54a708d`).
- Security decisions: the SSRF allowlist policy, key-handling rules, and structured-error boundaries were human calls, not model suggestions.
- Every merge: no AI diff landed unread; AI-written math was checked against hand-computed values before its tests were trusted.

### Lessons on verifying AI output

- Gate every phase: typecheck + `vitest run` before every commit caught a regex that was stricter than GitHub's real naming rules and rejected legitimate trailing-hyphen repository names (`3e47f2c`).
- Plausible is not correct: hand-computed fixtures were the only reliable oracle for the scoring math; the model implemented formulas fastest and most faithfully when the spec text was pasted directly into the prompt.
- Direct the harness with the spec, not open-ended requests: small prompts referencing SPEC sections outperformed generic "build the dashboard" instructions in both accuracy and review time.

## 7. Integrity Statement

- **No code was merged without human review.** Every commit was read as a diff, built, typechecked, and tested before it landed.
- **Zero committed keys.** All real credentials stayed in `.env` (gitignored); `.env.example` ships placeholders only, and `git diff` was inspected for key material before every push.
- **Verifiably human core IP.** The scoring engine is deterministic and its unit-test expectations were hand-computed by the candidate; the math in `lib/scoring/` traces line-for-line to `SPEC.md` §3.
- **Faithful history.** All hashes, messages, and timestamps in this log are reproduced verbatim from the repository's git history.
