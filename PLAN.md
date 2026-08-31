# RepoPulse Lite — Execution Plan

**Deadline:** August 31, 2026, 12:00 PM IST
**Strategy:** 6 phases → ~14 atomic conventional commits, each phase independently verifiable.

---

## Phase 0 — Spec-First Scaffold (Bonus +10)

**Goal:** Establish the spec-driven baseline before any feature code.

- [x] Author `SPEC.md` (architecture, heuristic formulas & weights)
- [x] `chore: scaffold next.js app with typescript and tailwind`
- [x] `chore: add env example with provider placeholders`
- [x] Add `.gitignore` (node_modules, .env, .next), base layout

**Exit:** `npx next build` passes; SPEC.md committed first.

## Phase 1 — GitHub Ingestion & Defensive Backend (20 pts)

**Goal:** Hardened data layer — nothing crashes, nothing leaks.

- [x] `feat: add strict github url validation with ssrf rejection`
- [x] `feat: implement github client with token support and caching`
- [x] `feat: add rate limit resilience with backoff and structured errors`
- [x] Wire `POST /api/analyze` returning raw telemetry (no scoring yet)

**Exit:** Valid URL → 200 with commit telemetry; invalid/private/rate-limited → structured 4xx without upstream body leakage.

## Phase 2 — Deterministic Scoring Engine (25 pts)

**Goal:** The core IP — pure, unit-tested, mathematically documented.

- [x] `feat: implement tier classifier for commit risk levels`
- [x] `feat: add multi-dimensional composite health score engine`
- [x] `test: add scoring engine unit tests with hand-computed fixtures`

**Exit:** `npx vitest run` green; same input always yields identical score.

## Phase 3 — Analytics Dashboard (25 pts)

**Goal:** Polished, responsive, skeleton-loaded analytics UI.

- [ ] `feat: build analyze form and api client state machine`
- [ ] `feat: add score gauge and metric breakdown charts`
- [ ] `feat: add commit timeline, tier donut and author leaderboard`
- [ ] `feat: add anomaly feed, loading skeletons and error states`

**Exit:** Full flow works end-to-end on mobile + desktop widths.

## Phase 4 — LLM Executive Audit

**Goal:** OpenAI-compatible audit report with graceful degradation.

- [ ] `feat: add openai-compatible llm client with settings panel`
- [ ] `feat: generate executive risk report from metric snapshot`

**Exit:** With key → LLM report; without key → labeled heuristic-only fallback.

## Phase 5 — MCP Server Bonus (+10)

**Goal:** Expose the engine as a reusable agent tool.

- [ ] `feat: add mcp server exposing analyze-repo tool`

**Exit:** `npx tsx mcp/server.ts` responds to `tools/list` + `tools/call`.

## Phase 6 — Deploy, Docs & Submit

**Goal:** Production live + submission complete.

- [ ] `chore: configure vercel deployment`
- [ ] `docs: add readme with architecture and heuristic documentation`
- [ ] `docs: add development log with ai tooling audit`
- [ ] Deploy to Vercel, verify live URL
- [ ] Email 4 deliverables → pavan@geopageconsultants.in

---

## Commit Cadence Guardrails

- Conventional types only: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, `test:`
- One logical change per commit — never a monolithic dump (auto-disqualification)
- Push after every commit; spread work across the remaining window
- Before each push: verify no key material in `git diff`

## Risk Register

| Risk | Mitigation |
|---|---|
| GitHub 60 req/h ceiling | In-memory cache + batched detail fetch + token support |
| LLM provider outage | Heuristic-only fallback keeps app functional |
| Deadline slip | Phases 0–3 are submission-critical; 4–5 can compress |
| Rate-limited during demo | Settings panel allows evaluator's own token |
