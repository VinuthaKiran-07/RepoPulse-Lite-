# RepoPulse Lite

RepoPulse Lite is a production-grade Next.js application that ingests any public GitHub repository URL, fetches Git telemetry via the GitHub REST API, computes a deterministic 0-100 Health Score from a custom multi-dimensional heuristic engine, and generates an optional LLM-powered executive risk audit — all rendered on an interactive, dark-mode-aware analytics dashboard. The scoring engine is a pure TypeScript module with zero I/O, zero randomness, and zero timestamps: the same input always produces the same score, forever.

`Next.js 15` | `TypeScript` | `Vitest (216 tests)` | `Deployed on Vercel`

**Live URL:** https://repopulse-lite.vercel.app (deployed)

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Heuristic Scoring Engine](#heuristic-scoring-engine)
3. [LLM Executive Audit](#llm-executive-audit)
4. [Bonus Features](#bonus-features)
5. [Local Setup](#local-setup)
6. [Security & Defensive Engineering](#security--defensive-engineering)
7. [AI & Development Harness Audit Log](#ai--development-harness-audit-log)
8. [Testing](#testing)
9. [Deployment](#deployment)

---

## Architecture Overview

### Request Flow

```
┌─────────────┐     POST /api/analyze      ┌──────────────────┐
│   Browser    │ ─────────────────────────▶ │  Next.js API Route │
│  (Dashboard) │ ◀───────────────────────── │  (Route Handler)   │
└─────────────┘      JSON response          └────────┬─────────┘
                                                       │
                    ┌──────────────────────────────────┼─────────────────┐
                    ▼                                  ▼                 ▼
          ┌──────────────────┐                ┌─────────────────┐  ┌──────────────┐
          │  URL Validator    │                │  GitHub Client   │  │ Scoring Eng. │
          │ (strict, reject  │                │ (REST v3, token  │  │ (pure, det., │
          │  SSRF/injection) │                │  aware, retries) │  │  unit-tested)│
          └──────────────────┘                └─────────────────┘  └──────────────┘
                                                       │
                                                       ▼
                                             ┌──────────────────┐
                                             │  LLM Audit Route  │
                                             │ (OpenAI-compat:   │
                                             │  Groq/Gemini/NIM/ │
                                             │  OpenRouter)      │
                                             └──────────────────┘
```

1. Client POSTs `{ repoUrl }` to `/api/analyze`.
2. Route validates the URL strictly (https-only `github.com`, SSRF and injection rejection).
3. GitHub client fetches repo metadata, the last 100 commits, and per-commit detail (files changed, additions/deletions) — batching requests within rate limits.
4. Scoring engine (pure function, no I/O) computes metrics and the composite score.
5. Client renders the dashboard; the user may trigger `/api/audit` for the LLM executive report.

### Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, API Routes) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Charts | Recharts |
| LLM Client | OpenAI-compatible (`fetch`-based, zero SDK lock-in) |
| MCP | `@modelcontextprotocol/sdk` (stdio) |
| Testing | Vitest + Testing Library (jsdom) |
| Deployment | Vercel |

Single repository, single deployment. API routes act as the backend; no separate server process.

### Module Map

```
src/
├── app/
│   ├── page.tsx                  # Single-page dashboard (client)
│   ├── layout.tsx / globals.css  # Shell + Tailwind
│   └── api/
│       ├── analyze/route.ts      # POST — validate, fetch, score
│       ├── audit/route.ts        # POST — LLM executive audit proxy
│       └── health/route.ts       # GET  — { status: "ok" }
├── components/                   # Dashboard UI (ScoreGauge, CommitTimeline,
│                                 #   TierDonut, MetricBreakdown, AuthorLeaderboard,
│                                 #   AnomalyFeed, AuditSection, SettingsPanel, ...)
├── lib/
│   ├── scoring/                  # Pure deterministic engine (core IP)
│   │   ├── engine.ts             # Composite formula, weights, clamping, bands
│   │   ├── tier-classifier.ts    # Tier 1/2/3 commit classification
│   │   ├── hygiene.ts / churn.ts / cadence.ts / diversity.ts / anomaly.ts
│   │   └── *.test.ts             # Hand-computed fixture unit tests
│   ├── github/                   # client.ts (REST v3, batching, retries),
│   │                             #   url-validator.ts, errors.ts, types.ts
│   ├── llm/                      # client.ts (OpenAI-compat), prompt.ts,
│   │                             #   snapshot.ts, fallback-report.ts
│   ├── analysis.ts               # Orchestrates fetch -> score
│   ├── settings.ts               # localStorage-backed LLM settings
│   └── use-analyze / use-audit / use-llm-settings  # React hooks
mcp/
└── server.ts                     # MCP server exposing analyze-repo tool (stdio)
```

---

## Heuristic Scoring Engine

The engine in `src/lib/scoring/` is a pure TypeScript module: no network calls, no randomness, no timestamps. Analysis operates on the **most recent 100 commits** (or fewer on small repos); every metric normalizes against `n = commits.length` so scores stay comparable across repository sizes.

### Composite Formula

```
HealthScore = 0.25·Hygiene + 0.20·Churn + 0.20·Cadence + 0.20·Diversity − AnomalyPenalty
```

Each sub-metric is normalized to 0–100 before weighting. The final score is clamped and rounded to [0, 100]. Weights are defined as constants in `src/lib/scoring/engine.ts` (`SCORE_WEIGHTS`).

| Metric | Weight | Direction |
|---|---|---|
| Commit Hygiene | 0.25 | additive |
| Code Churn Balance | 0.20 | additive |
| Cadence & Velocity | 0.20 | additive |
| Author Diversity | 0.20 | additive |
| Anomaly Penalty | up to 20 pts | subtractive |

### Metric 1: Commit Hygiene — weight 0.25

Measures conventional-commit compliance and message informativeness.

```
per-commit h(c) = 0.6·conventional(c) + 0.4·quality(c)

conventional(c) = 1 if message matches
    ^(feat|fix|refactor|docs|chore|test|style|perf|build|ci|revert)(\(.+\))?!?: .+
  else 0

quality(c):
  subject length in [16, 72] chars            -> 1.0
  subject length in [8, 16) or (72, 120]      -> 0.5
  vague patterns (wip, fix, update, stuff, misc, minor, asdf,
  test123, single-token, "update code")       -> 0.0
  otherwise                                    -> 0.25

Hygiene = 100 · mean(h(c))
```

### Metric 2: Code Churn Balance — weight 0.20

Rewards additive-but-not-bloated change profiles; penalizes runaway bloat and risky deletion spikes.

```
Let A = total additions, D = total deletions over the window
ratio r = A / max(A + D, 1)              // fraction of lines added

f_bloat(r):                               // ideal band 0.55–0.80
  r in [0.55, 0.80]                       -> 1.0
  linear falloff to 0.4 at r = 0.15 and r = 0.95 outside the band

f_regen = 1 − min(D / max(A, 1), 1)       // deletion-heavy repos score low
avg_commit_size = (A + D) / n
f_atomic = 1 if avg_commit_size ≤ 200 else max(0, 1 − (avg_commit_size − 200) / 800)

Churn = 100 · (0.5·f_bloat + 0.25·f_regen + 0.25·f_atomic)
```

### Metric 3: Cadence & Velocity — weight 0.20

Frequency and *consistency* of momentum. Burst-then-silence repositories score lower than steady ones.

```
span_days = (latest_commit − oldest_commit) / 86400s    (min 1)
commits_per_day v = n / span_days
f_freq = 2 / (1 + e^(−2(v − 1.2)))                       // sigmoid, saturates ~3 cpd

gaps g_i = inter-commit intervals (hours)
cv = std(gaps) / mean(gaps)                              // coefficient of variation
f_regularity = clamp(1 − cv / 2, 0, 1)                    // consistent gaps -> 1

Cadence = 100 · (0.6·f_freq + 0.4·f_regularity)
```

### Metric 4: Author Diversity / Entropy — weight 0.20

Shannon entropy over the commit-share distribution, normalized against the theoretical maximum for the observed author count `k`:

```
p_i = author_i commits / n
H = −Σ p_i · log2(p_i)                       // raw entropy
H_norm = H / log2(max(k, 2))                  // in [0, 1]

Diversity = 100 · (0.7·H_norm + 0.3·clamp(k / 5, 0, 1))
             // bus-factor guard: >= 5 regular contributors earns the full k-term
```

Single-author repositories yield Diversity ≈ 0 (single point of failure); five evenly-active authors yield 100.

### Metric 5: Anomaly Penalty — subtractive, capped at 20 points

High-risk structural events deduct directly from the composite:

```
penalties (summed, capped at 20 points):
  +8   per commit with total churn > 1,000 lines   ("massive atomic rewrite")
  +4   per commit with deletions > 500             ("high-risk deletion")
  +2   per Tier-3 commit when Tier-3 share > 40% of the window
  +3   if k = 1 author AND n ≥ 20                 (chronic single-owner risk)

AnomalyPenalty = min(Σ penalties, 20)
AnomalyFlags   = list of { type, commit_sha, magnitude } — rendered in the UI
```

### Score Bands

| Range | Label | Color |
|---|---|---|
| 80–100 | Excellent | green |
| 60–79 | Moderate | yellow |
| 40–59 | At Risk | orange |
| 0–39 | Critical | red |

### Baseline Tier Classifier

Each commit is classified into a risk tier, surfaced in the UI as a tier distribution donut:

| Tier | Rule |
|---|---|
| **Tier 1 — Low/Routine** | < 50 lines changed OR `docs:`/`chore:` type |
| **Tier 2 — Moderate/Feature** | 50–250 lines changed AND < 5 modified files |
| **Tier 3 — High-Risk** | > 250 lines changed OR ≥ 5 modified files |

Every displayed metric links back to its exact formula above — the math is directly auditable.

---

## LLM Executive Audit

The **`POST /api/audit`** endpoint takes `{ repoUrl, score, metrics }` and returns a Markdown executive report (risk summary, hygiene audit, prioritized recommendations).

- **Server-side proxy:** the endpoint calls `POST {base}/chat/completions` with `{ model, messages, temperature: 0.2 }` via a `fetch`-based OpenAI-compatible client — zero SDK lock-in. When `.env` credentials are used, the key never touches client code.
- **Supported providers:** any OpenAI-compatible endpoint — Groq, Gemini (OpenAI-compat), NVIDIA NIM, OpenRouter, and others (e.g. tokenrouter).
- **Prompt design:** a system prompt establishes a "senior engineering auditor" persona; the user message embeds a *deterministic JSON snapshot* (score, sub-scores, tier distribution, top anomalies, author stats) — not raw logs — keeping tokens bounded and the prompt-injection surface minimal.
- **Settings panel override:** the UI Settings panel stores `baseUrl` / `model` / `apiKey` in `localStorage` (key `repopulse.llm.settings.v1`, sanitized on read/write), sends them per-request, and they are never persisted or logged server-side.
- **Graceful fallback:** when no key is configured, the UI generates a deterministic client-side template report built from the metrics, clearly labeled **"Heuristic-only mode"**. The app remains fully functional without LLM access.

---

## Bonus Features

1. **Spec-Driven Workflow:** `SPEC.md` was authored and versioned *before* any implementation commits — architecture, formulas, and weights were designed up front, then implemented against the spec.
2. **MCP Server:** `mcp/server.ts` exposes an `analyze-repo` tool via the `@modelcontextprotocol/sdk` over stdio, reusing the same `lib/scoring/` engine — proving engine portability beyond the web app.

   ```bash
   npm run mcp
   ```

---

## Local Setup

### Prerequisites

- Node.js 18.17+ (Node 20+ recommended)
- npm

### Steps

```bash
# 1. Clone
git clone <repo-url> repopulse-lite
cd repopulse-lite

# 2. Install dependencies
npm install

# 3. Configure environment (all values optional)
cp .env.example .env

# 4. Run the dev server
npm run dev
```

Open http://localhost:3000 in your browser.

### Environment Variables

| Variable | Purpose | Default |
|---|---|---|
| `GITHUB_TOKEN` | Optional; raises GitHub rate limit from 60 to 5,000 req/h | unset |
| `LLM_BASE_URL` | OpenAI-compatible endpoint | `https://api.groq.com/openai/v1` |
| `LLM_MODEL` | Model identifier | `llama-3.3-70b-versatile` |
| `LLM_API_KEY` | Provider key | unset |
| `LLM_REQUESTS_PER_MINUTE` | Throttle for providers with strict RPM ceilings | `8` |

All LLM values are also overridable at runtime via the Settings panel. The app runs fully without any configuration (unauthenticated GitHub + heuristic-only audit mode).

### npm Scripts

| Script | Command | Purpose |
|---|---|---|
| `dev` | `next dev` | Development server |
| `build` | `next build` | Production build |
| `start` | `next start` | Serve production build |
| `test` | `vitest run` | Run all 216 tests once |
| `test:watch` | `vitest` | Tests in watch mode |
| `typecheck` | `tsc --noEmit` | TypeScript type checking |
| `lint` | `eslint` | Lint |
| `mcp` | `tsx mcp/server.ts` | Run the MCP server (stdio) |

---

## Security & Defensive Engineering

### Strict URL Validation

`src/lib/github/url-validator.ts` accepts only `https://github.com/{owner}/{repo}` (optional trailing `.git`, `/`, or query). Owner/repo are regex-enforced (`[A-Za-z0-9_.-]`) with max-length and scheme allow-list (`https` only). Local/SSRF targets, injected paths, and malformed input are rejected with HTTP **400** + reason.

### Rate-Limit & Upstream Resilience

- Unauthenticated GitHub allows 60 req/h — the client batches per-commit detail requests (concurrency 8) and caches repo analysis in memory for 10 minutes.
- GitHub `403`/`429` map to a structured 429 response with `retryAfter` — never a crash; 5xx responses trigger exponential backoff (max 2 retries, 1s/2s).
- `404` maps to "repository not found or private". Upstream errors are wrapped — raw upstream bodies never leak to the client.

### Zero Committed Keys

All keys live in `.env` (gitignored; `.env.example` is committed with placeholders only) or in runtime user input (localStorage, sent per-request). No real keys appear anywhere in this repository.

---

## AI & Development Harness Audit Log (Summary)

Development used the **OpenCode CLI harness** with the **z-ai/glm-5.3-free** model. The human candidate (Vinut) designed the architecture, all heuristic formulas and weights, the metric normalization strategy, and the defensive-engineering rules, and authored `SPEC.md` before any code generation. AI assistance was used for boilerplate generation, test scaffolding, and refactoring under direct human review; every formula, weight, and security decision originated from the spec. The full tools/models/prompting log, including architectural roadblocks and debugging steps, is documented in [DEVELOPMENT_LOG.md](DEVELOPMENT_LOG.md).

---

## Testing

216 tests, all passing (`npm test`, Vitest):

| Suite | Coverage |
|---|---|
| Scoring unit tests (`src/lib/scoring/`) | Each metric formula with hand-computed fixtures, tier-classifier edge cases, composite clamping, empty/1-commit/single-author repos |
| API route tests (`src/app/api/`) | Invalid URLs (SSRF strings, malformed), mocked GitHub 404/429/500, audit fallback behavior |
| Client/hook tests (`src/lib/`) | Analyze/audit clients, settings sanitization, snapshot/prompt construction |
| Component tests (`src/components/`) | jsdom + Testing Library — forms, gauges, donuts, error banners, settings panel |

---

## Deployment

`vercel.json` is committed (framework preset, `bom1` region, security headers: `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`). The app is live at:

**https://repopulse-lite.vercel.app**
