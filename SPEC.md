# RepoPulse Lite — Technical Specification

**Version:** 1.0
**Author:** Vinut (Candidate — Applied AI & Full-Stack Engineering Internship)
**Status:** Authored and committed BEFORE any code generation (Spec-Driven Workflow)
**Deadline:** August 31, 2026, 12:00 PM IST

---

## 1. Problem Statement

Engineering leads lack automated, actionable visibility into repository momentum, commit quality, code churn, and architectural health. RepoPulse Lite ingests any **public GitHub repository URL**, fetches Git telemetry via the GitHub REST API, computes a **deterministic 0–100 Health Score**, and generates an **LLM-powered executive risk audit** — all rendered on an interactive analytics dashboard.

## 2. System Architecture

### 2.1 Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, API Routes, Server Actions) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Charts | Recharts |
| LLM Client | OpenAI-compatible (`fetch`-based, zero SDK lock-in) |
| Deployment | Vercel |
| Testing | Vitest |

Single repository, single deployment. API routes act as the backend; no separate server process.

### 2.2 Request Flow

```
┌─────────────┐     POST /api/analyze      ┌──────────────────┐
│   Browser    │ ─────────────────────────▶ │  Next.js API Route │
│  (Dashboard) │ ◀───────────────────────── │  (Route Handler)   │
└─────────────┘      JSON response          └────────┬─────────┘
                                                       │
                        ┌──────────────────────────────┼─────────────────┐
                        ▼                              ▼                 ▼
              ┌──────────────────┐          ┌─────────────────┐  ┌──────────────┐
              │  URL Validator    │          │  GitHub Client   │  │ Scoring Eng. │
              │ (strict, reject  │          │ (REST v3, token  │  │ (pure, det., │
              │  SSRF/injection) │          │  aware, retries) │  │  unit-tested)│
              └──────────────────┘          └─────────────────┘  └──────────────┘
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
2. Route validates the URL strictly (Section 6.1).
3. GitHub client fetches: repo metadata, last **100 commits** (list), and **per-commit detail** (files changed, additions/deletions) — deduplicating API calls and batching within rate limits.
4. Scoring engine (pure function, no I/O) computes metrics + composite score.
5. Client renders dashboard; user may trigger `/api/audit` for the LLM executive report.

### 2.3 API Endpoints

| Endpoint | Method | Input | Output |
|---|---|---|---|
| `/api/analyze` | POST | `{ "repoUrl": string }` | `{ repo, commits[], metrics, score, tiers, anomalies[] }` |
| `/api/audit` | POST | `{ repoUrl, score, metrics }` | `{ report: string }` (markdown) |
| `/api/health` | GET | — | `{ status: "ok" }` |

### 2.4 Configuration (zero committed keys)

| Variable | Purpose | Default |
|---|---|---|
| `GITHUB_TOKEN` | Optional; raises rate limit 60→5,000 req/h | unset |
| `LLM_BASE_URL` | OpenAI-compatible endpoint | `https://api.groq.com/openai/v1` |
| `LLM_MODEL` | Model identifier | `llama-3.3-70b-versatile` |
| `LLM_API_KEY` | Provider key | unset |

All three LLM values are **also overridable at runtime via a Settings panel** in the UI (stored in localStorage, sent per-request, never persisted server-side). Works with any OpenAI-compatible provider (Groq, Gemini OpenAI-compat, NVIDIA NIM, OpenRouter, tokenrouter/glm-5.3).

## 3. Deterministic Heuristic Engine (Core IP)

Pure TypeScript module: `lib/scoring/`. No network calls, no randomness, no timestamps — same input ⇒ same score, forever. Fully unit-tested.

### 3.1 Input Window

Analysis operates on the **most recent 100 commits** (or fewer on small repos). Metrics normalize against `n = commits.length` to keep scores comparable across repo sizes.

### 3.2 Baseline Tier Classifier (required starter model)

Each commit is classified into a risk tier — surfaced in the UI as tier distribution:

| Tier | Rule |
|---|---|
| **Tier 1 — Low/Routine** | < 50 lines changed OR `docs:`/`chore:` type |
| **Tier 2 — Moderate/Feature** | 50–250 lines changed AND < 5 modified files |
| **Tier 3 — High-Risk** | > 250 lines changed OR ≥ 5 modified files |

### 3.3 Composite Health Score — 0–100

```
HealthScore = 0.25·Hygiene + 0.20·Churn + 0.20·Cadence + 0.20·Diversity − AnomalyPenalty
```

Each sub-metric is normalized to 0–100 before weighting. Final score clamped to [0, 100].

#### Metric 1: Commit Hygiene (weight 0.25)

Measures conventional-commit compliance and message informativeness.

```
per-commit h(c) = 0.6·conventional(c) + 0.4·quality(c)

conventional(c) = 1 if message matches
    ^(feat|fix|refactor|docs|chore|test|style|perf|build|ci|revert)(\(.+\))?!?: .+
  else 0

quality(c):
  subject length ∈ [16, 72] chars  → 1.0
  subject length ∈ [8, 16) ∪ (72, 120] → 0.5
  vague patterns (wip, fix, update, stuff, misc, minor, asdf, test123,
  single-token messages, "update code") → 0.0
  otherwise → 0.25

Hygiene = 100 · mean(h(c))
```

#### Metric 2: Code Churn Balance (weight 0.20)

Rewards additive-but-not-bloated change profiles; penalizes runaway bloat and risky deletion spikes.

```
Let A = total additions, D = total deletions over window
ratio r = A / max(A + D, 1)          // fraction of lines added

f_bloat(r):   // ideal band 0.55–0.80 (build > demolish, no bloat)
  r ∈ [0.55, 0.80]          → 1.0
  linear falloff to 0.4 at r = 0.15 and r = 0.95 outside band

f_regen = 1 − min(D / max(A,1), 1)   // deletion-heavy repos score low
avg_commit_size = (A + D) / n
f_atomic = 1 if avg_commit_size ≤ 200 else max(0, 1 − (avg_commit_size − 200)/800)

Churn = 100 · (0.5·f_bloat + 0.25·f_regen + 0.25·f_atomic)
```

#### Metric 3: Cadence & Velocity (weight 0.20)

Frequency and *consistency* of momentum. Burst-then-silence repos score lower than steady ones.

```
span_days = (latest_commit − oldest_commit) / 86400s   (min 1)
commits_per_day v = n / span_days
f_freq = sigmoid around 1.5 cpd:  2 / (1 + e^(−2(v − 1.2)))   // saturates ~3 cpd

gaps g_i = inter-commit intervals (hours)
cv = std(gaps) / mean(gaps)                              // coefficient of variation
f_regularity = clamp(1 − cv / 2, 0, 1)                   // consistent gaps → 1

Cadence = 100 · clamp(0.6·f_freq + 0.4·f_regularity, 0, 1)   // capped to [0,100]
```

#### Metric 4: Author Diversity / Entropy (weight 0.20)

Shannon entropy over commit-share distribution, normalized against the theoretical maximum for observed author count `k`:

```
p_i = author_i commits / n
H = −Σ p_i · log2(p_i)                       // raw entropy
H_norm = H / log2(max(k, 2))                 // ∈ [0, 1]

Diversity = 100 · (0.7·H_norm + 0.3·clamp(k / 5, 0, 1))
            // bus-factor guard: ≥5 regular contributors earns full k-term
```

Single-author repos ⇒ Diversity ≈ 0 (single point of failure). Five evenly-active authors ⇒ 100.

#### Metric 5: Anomaly Penalty (weight 0.15 of total, subtractive)

High-risk structural events deduct directly from the composite:

```
penalties (summed, capped at 20 points):
  +8   per commit with total churn > 1,000 lines ("massive atomic rewrite")
  +4   per commit with deletions > 500 ("high-risk deletion")
  +2   per Tier-3 commit when Tier-3 share > 40% of window
  +3   if k = 1 author AND n ≥ 20 (chronic single-owner risk)

AnomalyPenalty = min(Σ penalties, 20)
AnomalyFlags = list of { type, commit_sha, magnitude } — rendered in UI
```

### 3.4 Score Bands (UI presentation)

| Band | Range | Label |
|---|---|---|
| 🟢 | 80–100 | Excellent |
| 🟡 | 60–79 | Moderate |
| 🟠 | 40–59 | At Risk |
| 🔴 | 0–39 | Critical |

### 3.5 Metric Legend (dashboard)

Every displayed metric links to its exact formula (Section 3.3) — evaluators can audit the math directly.

## 4. LLM Executive Audit

- **Endpoint:** `/api/audit` — server-side proxy so the key never touches client code when `.env` is used; when the user supplies runtime credentials in the Settings panel, they are sent per-request and never logged.
- **Contract:** OpenAI-compatible `POST {base}/chat/completions` with `{ model, messages, temperature: 0.2 }`.
- **Prompt design:** System prompt establishes "senior engineering auditor" persona; user message embeds a **deterministic JSON snapshot** (score, sub-scores, tier distribution, top anomalies, author stats) — NOT raw logs — keeping tokens bounded and prompt-injection surface minimal.
- **Output:** Markdown executive report — risk summary, hygiene audit, prioritized recommendations.
- **Fallback:** No key configured ⇒ UI shows a deterministic client-side template report built from the metrics, clearly labeled "Heuristic-only mode". App remains fully functional without LLM access.

## 5. Dashboard & UI Contract

- **Layout:** Single-page responsive (mobile → desktop), dark-mode-aware.
- **Components:** score gauge (0–100 with band color), 5 sub-metric radial/bar charts, commit timeline (Recharts Area/Bar), tier distribution donut, author leaderboard, anomaly flag feed.
- **States:** skeleton loaders during fetch; explicit error states for: invalid URL, repo not found, rate-limited (with "add GITHUB_TOKEN" hint), upstream 5xx, network failure.
- **State management:** React `useState`/`useReducer` + fetch; no global store needed at this scope.

## 6. Defensive Engineering Rules

### 6.1 Strict URL Validation

Accept only: `https://github.com/{owner}/{repo}` (optional trailing `.git`, `/`, query). Regex-enforced owner/repo (`[A-Za-z0-9_.-]`), max length, scheme allow-list (`https` only). Rejects local/SSRF targets, injected paths, and malformed input with HTTP **400** + reason.

### 6.2 Rate-Limit & Upstream Resilience

- Unauthenticated GitHub: 60 req/h ⇒ client batches per-commit detail requests (up to 100 commits, sequential with `Await-all` concurrency 8) and caches repo analysis in-memory for 10 minutes.
- `403`/`429` from GitHub ⇒ structured 429 response to client with `retryAfter`, never a crash; exponential backoff (max 2 retries, 1s/2s) on 5xx.
- `404` ⇒ "repository not found or private". Upstream errors are wrapped — raw upstream bodies never leak to the client.

### 6.3 Security

- All keys via `.env` (gitignored, `.env.example` committed with placeholders only) or runtime user input (localStorage, per-request header). **Zero committed keys — verified by CI grep before every push.**

## 7. Bonus Deliverables

1. **Spec-Driven Workflow:** this `SPEC.md` committed before any implementation commits.
2. **MCP Server:** `mcp/server.ts` exposing `analyze-repo` tool via `@modelcontextprotocol/sdk` over stdio — reuses the same scoring engine (`lib/scoring/`), proving engine portability.

## 8. Testing

- `lib/scoring/` unit tests: tier classifier edge cases, each metric formula (hand-computed fixtures), composite clamping, empty/1-commit/single-author repos.
- API integration smoke: invalid URLs (SSRF strings, malformed), mocked GitHub 404/429/500 responses.

## 9. Deliverables Checklist

- [ ] Public GitHub repo — 8–15+ atomic conventional commits
- [ ] Live Vercel deployment URL
- [ ] `README.md`: architecture, heuristic formulas & weights, AI/development audit log, local setup
- [ ] `DEVELOPMENT_LOG.md`: tools, models, human-vs-AI split, prompt log
- [ ] Submission email → `pavan@geopageconsultants.in` before Aug 31, 12:00 PM IST
