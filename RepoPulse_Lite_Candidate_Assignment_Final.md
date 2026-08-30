# RepoPulse Lite --- 48-Hour Technical & Agentic Assessment

**Organization:** Geopage Consultants \| Engineering Recruitment\
**Unstop Listing:** unstop.com/o/6EDXqQL\
**Role:** Applied AI & Full-Stack Engineering Internship\
**Mode:** 6 Months \| 100% On-Site (Basaveshwaranagar, Bengaluru)\
**Deadline:** August 31, 2026 at 12:00 PM (Noon) IST\
**Score:** 100 Base + 20 Bonus

## Assessment Focus

-   Full-Stack App (React / FastAPI / Node)
-   Custom Heuristic Scoring Engine
-   Open LLM API & Agentic Tooling Audit
-   Conventional Git Commits & Live Cloud Deploy

> **Mandatory Internship Terms:** 6 months duration and 100%
> in-person/on-site at Basaveshwaranagar, Bengaluru. No hybrid or remote
> option. Official certificate and PPO consideration are issued only
> upon full 6-month completion.

------------------------------------------------------------------------

## 1. Executive Summary & Problem Statement

Engineering leads need automated, actionable visibility into repository
momentum, commit quality, code churn, and architectural health without
manually reading hundreds of Git logs.

Your objective is to design, build, and deploy **RepoPulse Lite** --- a
production-grade web application that:

-   **Public GitHub Ingestion:** Accepts any public GitHub repository
    URL.
-   **Git Telemetry Fetching:** Programmatically retrieves recent
    repository and commit telemetry via the GitHub REST API.
-   **Deterministic Heuristic Engine:** Executes a custom-designed
    deterministic scoring algorithm to quantify repository health.
-   **LLM Executive Audit:** Interfaces with an Open/OpenAI-compatible
    LLM to produce an executive risk report and hygiene audit.
-   **Interactive Analytics Dashboard:** Renders health indicators,
    score gauges, and breakdown charts in a responsive UI.

------------------------------------------------------------------------

## 2. Architecture & Technical Guidelines

-   **Full-Stack Framework:** React or Next.js (App Router / API Routes
    / Server Actions). Alternatively, a Python backend using FastAPI or
    Flask with a React frontend is acceptable.
-   **LLM Providers:** Native support for Groq Cloud, Google Gemini,
    NVIDIA NIM, or OpenRouter. Support custom Base URL, Model Name, and
    API Key in the UI or `.env`.
-   **GitHub API Rate Limits:** Support an optional `GITHUB_TOKEN` in
    the UI or `.env` to avoid unauthenticated rate limits of 60 requests
    per hour.

------------------------------------------------------------------------

## 3. Core Technical Pillars & Rules

### 3.1 Deterministic Heuristic Engine & Scoring Logic

#### A. Baseline Reference Model (Starter Tiering)

At a minimum, the engine can classify recent commits into three basic
tiers:

-   **Tier 1 --- Low / Routine:** Less than 50 lines changed, or
    documentation/chore commits such as `docs:` and `chore:`.
-   **Tier 2 --- Moderate / Feature Work:** 50--250 lines changed across
    fewer than 5 modified files.
-   **Tier 3 --- High / Complex / High-Risk:** More than 250 lines
    changed or more than 5 modified files.

#### B. Advanced Multi-Dimensional Scoring (Expected & Evaluated)

The three-tier model is only a baseline starter. Candidates are expected
to optimize, refine, and innovate beyond it.

High-scoring submissions should formulate a comprehensive **0--100
Health Score** using:

1.  **Code Churn Ratios:** Additions vs. deletions, including
    refactoring vs. runaway bloat.
2.  **Commit Hygiene:** Conventional commits vs. vague messages such as
    `wip` or `fix`.
3.  **Commit Cadence & Velocity:** Frequency and developer momentum.
4.  **Author Entropy:** Single point of failure vs. healthy team
    distribution.
5.  **Anomaly Flags:** Massive atomic rewrites or high-risk deletions.

### 3.2 Git Hygiene, Conventional Commits & Anti-Plagiarism

-   **Semantic Conventional Commits:** Commits must follow standards
    such as `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, and
    `test:`.
-   **Incremental History Across 48 Hours:** Submissions should reflect
    continuous incremental progress, with **8 to 15+ atomic commits
    expected**.
-   **Automatic Disqualification:** A single monolithic commit or an
    initial code dump without commit progression may be rejected
    immediately.

### 3.3 AI Tooling Transparency & Detailed Development Audit Log

The assessment values engineers who use AI tools for leverage and
productivity. However, blind, copy-pasted, fully AI-generated codebases
without candidate understanding are strictly penalized.

In `README.md` or `DEVELOPMENT_LOG.md`, document:

1.  **IDE & Harness Tools:** Exact tools used, such as Cursor, VS Code,
    Antigravity, OpenCode, Claude Code, or Terminal CLI.
2.  **LLMs & Chatbots:** Specific models consulted.
3.  **Human vs. AI Breakdown:** Clear distinction between
    architectures/heuristics designed by you and boilerplate generated
    by AI.
4.  **Prompting & Problem-Solving Log:** Key prompts, architectural
    roadblocks, and debugging steps.

------------------------------------------------------------------------

## 4. Evaluation & Grading Matrix

  ------------------------------------------------------------------------
  Pillar / Category                           Weight Assessment & Scoring
                                                     Criteria
  --------------------- ---------------------------- ---------------------
  UI & Analytics                              25 pts Responsive layout,
  Dashboard                                          score gauges/charts,
                                                     loading skeletons,
                                                     state management, and
                                                     clear visual
                                                     hierarchy

  Custom Heuristic                            25 pts Originality,
  Engine                                             mathematical
                                                     soundness,
                                                     multi-dimensional
                                                     metrics, and
                                                     composite 0--100
                                                     score

  Backend & Defensive                         20 pts Strict URL
  Logic                                              validation,
                                                     rate-limit
                                                     resilience, safe
                                                     upstream error
                                                     handling, and zero
                                                     committed keys

  Git Hygiene & Cadence                       15 pts Semantic Conventional
                                                     Commits and clean
                                                     atomic commit cadence
                                                     over 48 hours

  AI Tooling & Audit                          15 pts Detailed
  Log                                                documentation of
                                                     tools, harnesses,
                                                     models, human-vs-AI
                                                     contribution split,
                                                     and prompt
                                                     reflections

  **Bonus: Spec-Driven                   **+10 pts** `SPEC.md` authored
  Workflow**                                         and versioned before
                                                     code generation

  **Bonus: MCP Server /                  **+10 pts** Functional Model
  Agent Tool**                                       Context Protocol
                                                     server or custom
                                                     agent tool
                                                     integration
  ------------------------------------------------------------------------

------------------------------------------------------------------------

## 5. Mandatory Deliverables & Submission Protocol

### Mandatory Submission Instructions

Email the following **4 deliverables** directly to
`pavan@geopageconsultants.in` (or reply directly to the invitation email
thread) before the deadline:

1.  **Public GitHub Repository Link**\
    Full codebase with clean, incremental Conventional Commit history of
    8--15+ commits.

2.  **Live Hosted / Production Deployment URL**\
    A fully active and working application deployed on Vercel, Netlify,
    Render, or Railway.

3.  **Brief Introduction About Yourself**\
    One or two concise paragraphs covering your background, technical
    interests, core strengths, and passion for applied AI and
    engineering.

4.  **Complete Repository Documentation (`README.md`)**\
    Include:

    -   Architecture overview
    -   Custom heuristic formulas and weights
    -   AI & Development Harness Audit Log
    -   Local setup guide

### Email Details

-   **Subject Format:**
    `[RepoPulse Lite Submission] <Your Full Name> — Unstop Internship`
-   **Hard Deadline:** As mentioned in the email
-   **Strict Notice:** Assignments submitted after the deadline will not
    be considered for further evaluation.

------------------------------------------------------------------------

## Contact

**Geopage Consultants --- Engineering Recruitment Practice Group**\
Basaveshwaranagar, Bangalore, Karnataka, India\
**Email:** pavan@geopageconsultants.in\
**Opportunity:** RepoPulse Lite --- Unstop Opportunity
