#!/usr/bin/env node
/**
 * Live E2E verification suite for RepoPulse Lite.
 *
 * Runs against the production deployment (override with E2E_BASE_URL).
 * Exercises the full user journey plus defensive/edge behavior:
 *   1. Homepage serves the app shell
 *   2. /api/health
 *   3. URL validation rejects every malformed/SSRF-ish input with 400
 *   4. Happy path: real repo analysis returns full payload shape
 *   5. Determinism: same input => identical score + metrics (cache expiry)
 *   6. 404 handling for a nonexistent repo
 *   7. Audit endpoint contract: schema validation + LLM/fallback modes
 *   8. Audit graceful fallback with a bogus provider key
 *   9. Rate-limit contract (when triggered)
 *
 * Usage: node scripts/e2e-live.mjs
 */

const BASE_URL = (process.env.E2E_BASE_URL ?? "https://repopulse-lite-woad.vercel.app").replace(/\/+$/, "");

let passed = 0;
let failed = 0;
const failures = [];

function record(name, ok, detail = "") {
  if (ok) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    failures.push(`${name}${detail ? ` :: ${detail}` : ""}`);
    console.log(`  FAIL  ${name}${detail ? ` :: ${detail}` : ""}`);
  }
}

async function fetchRes(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, options);
  let body = null;
  const text = await response.text();
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { response, body };
}

function postJson(path, payload) {
  return fetchRes(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof payload === "string" ? payload : JSON.stringify(payload),
  });
}

function isErrorResponse(body, code) {
  return (
    typeof body === "object" &&
    body !== null &&
    typeof body.error === "object" &&
    body.error !== null &&
    body.error.code === code &&
    typeof body.error.message === "string" &&
    body.error.message.length > 0
  );
}

async function section(title) {
  console.log(`\n== ${title} ==`);
}

async function main() {
  console.log(`E2E target: ${BASE_URL}`);

  await section("1. Homepage and shell");
  {
    const { response, body } = await fetchRes("/");
    record(
      "homepage returns 200",
      response.status === 200,
      `status=${response.status}`
    );
    const html = typeof body === "string" ? body : "";
    record(
      "homepage renders RepoPulse title",
      html.includes("RepoPulse Lite"),
      "title text missing"
    );
    record(
      "homepage contains the analyze form input",
      html.includes('id="repo-url"'),
      "repo-url input missing"
    );
  }

  await section("2. Health endpoint");
  {
    const { response, body } = await fetchRes("/api/health");
    record(
      "/api/health returns 200 ok",
      response.status === 200 && body?.status === "ok",
      `status=${response.status} body=${JSON.stringify(body)}`
    );
  }

  await section("3. URL validation (defensive)");
  const invalidInputs = [
    ["empty string", { repoUrl: "" }],
    ["not a url", { repoUrl: "not-a-url" }],
    ["http scheme", { repoUrl: "http://github.com/owner/repo" }],
    ["localhost ssrf", { repoUrl: "http://localhost:3000/owner/repo" }],
    ["wrong host", { repoUrl: "https://evil.com/owner/repo" }],
    ["host confusion via userinfo", { repoUrl: "https://github.com@evil.com/owner/repo" }],
    ["owner only", { repoUrl: "https://github.com/owner" }],
    ["trailing owner slash", { repoUrl: "https://github.com/owner/" }],
    ["extra path segments", { repoUrl: "https://github.com/owner/repo/extra" }],
    ["port in url", { repoUrl: "https://github.com:443/owner/repo" }],
    ["percent encoding", { repoUrl: "https://github.com/ow%20ner/repo" }],
    ["fragment", { repoUrl: "https://github.com/owner/repo#x" }],
    ["query only", { repoUrl: "https://github.com/?q=1" }],
    ["invalid owner chars", { repoUrl: "https://github.com/ow..ner/repo" }],
    ["owner starts with dash", { repoUrl: "https://github.com/-owner/repo" }],
  ];
  for (const [label, payload] of invalidInputs) {
    const { response, body } = await postJson("/api/analyze", payload);
    record(
      `400 for ${label}`,
      response.status === 400 && isErrorResponse(body, "INVALID_URL"),
      `status=${response.status} body=${JSON.stringify(body).slice(0, 120)}`
    );
  }
  {
    const { response } = await postJson("/api/analyze", "not json at all");
    record(
      "400 for non-JSON body",
      response.status === 400,
      `status=${response.status}`
    );
  }
  {
    const { response } = await postJson("/api/analyze", { nope: 1 });
    record(
      "400 for missing repoUrl field",
      response.status === 400,
      `status=${response.status}`
    );
  }
  {
    const { response, body } = await fetchRes("/api/analyze");
    record(
      "405 for GET /api/analyze",
      response.status === 405 && isErrorResponse(body, "METHOD_NOT_ALLOWED"),
      `status=${response.status}`
    );
  }

  await section("4. Happy path: real analysis");
  let analysis = null;
  {
    const { response, body } = await postJson("/api/analyze", {
      repoUrl: "https://github.com/VinuthaKiran-07/RepoPulse-Lite-",
    });
    record("analyze returns 200", response.status === 200, `status=${response.status} body=${JSON.stringify(body).slice(0, 160)}`);
    if (response.status === 200) {
      analysis = body;
      record("repo.fullName present", typeof body.repo?.fullName === "string" && body.repo.fullName.includes("/"));
      record("score is 0-100 integer", Number.isInteger(body.score) && body.score >= 0 && body.score <= 100, `score=${body.score}`);
      record(
        "band matches score band",
        (body.score >= 80 && body.band?.band === "excellent") ||
          (body.score >= 60 && body.score < 80 && body.band?.band === "moderate") ||
          (body.score >= 40 && body.score < 60 && body.band?.band === "at_risk") ||
          (body.score < 40 && body.band?.band === "critical"),
        `score=${body.score} band=${body.band?.band}`
      );
      record("commits is a non-empty array", Array.isArray(body.commits) && body.commits.length > 0, `n=${body.commits?.length}`);
      record("commits capped at 100", body.commits.length <= 100, `n=${body.commits.length}`);
      record(
        "tiers sum equals commit count",
        body.tiers?.tier1 + body.tiers?.tier2 + body.tiers?.tier3 === body.commits.length,
        `tiers=${JSON.stringify(body.tiers)} n=${body.commits.length}`
      );
      record("authors array present", Array.isArray(body.authors) && body.authors.length > 0);
      record(
        "all four metric scores within 0-100",
        [body.metrics?.hygiene?.score, body.metrics?.churn?.score, body.metrics?.cadence?.score, body.metrics?.diversity?.score]
          .every((s) => typeof s === "number" && s >= 0 && s <= 100),
        `metrics=${JSON.stringify({
          h: body.metrics?.hygiene?.score,
          c: body.metrics?.churn?.score,
          cd: body.metrics?.cadence?.score,
          d: body.metrics?.diversity?.score,
        })}`
      );
      record(
        "anomaly penalty within 0-20",
        typeof body.metrics?.anomaly?.penalty === "number" &&
          body.metrics.anomaly.penalty >= 0 &&
          body.metrics.anomaly.penalty <= 20,
        `penalty=${body.metrics?.anomaly?.penalty}`
      );
      record("rateLimit snapshot present", body.rateLimit === null || typeof body.rateLimit === "object");
      record("fetchedAt parses as a date", !Number.isNaN(Date.parse(body.fetchedAt ?? "")));

      const weighted =
        0.25 * body.metrics.hygiene.score +
        0.2 * body.metrics.churn.score +
        0.2 * body.metrics.cadence.score +
        0.2 * body.metrics.diversity.score -
        body.metrics.anomaly.penalty;
      const recomputed = Math.round(Math.min(Math.max(weighted, 0), 100));
      record(
        "composite equals recomputed weighted formula",
        body.score === recomputed,
        `expected=${recomputed} got=${body.score}`
      );
    }
  }

  await section("5. Determinism");
  {
    if (analysis === null) {
      record("determinism check (skipped: no analysis)", false, "prior step failed");
    } else {
      const { response, body } = await postJson("/api/analyze", {
        repoUrl: "https://github.com/VinuthaKiran-07/RepoPulse-Lite-.git",
      });
      const sameScore = response.status === 200 && body.score === analysis.score;
      record(
        ".git suffix normalizes and is accepted",
        response.status === 200,
        `status=${response.status} body=${JSON.stringify(body).slice(0, 120)}`
      );
      record(
        "identical score on repeat analysis (.git normalized)",
        sameScore,
        `first=${analysis.score} second=${body?.score}`
      );
      if (response.status === 200) {
        record(
          "identical sub-metrics on repeat",
          body.metrics?.hygiene?.score === analysis.metrics.hygiene.score &&
            body.metrics?.churn?.score === analysis.metrics.churn.score &&
            body.metrics?.cadence?.score === analysis.metrics.cadence.score &&
            body.metrics?.diversity?.score === analysis.metrics.diversity.score
        );
      }
    }
  }

  await section("6. Repo not found");
  {
    const { response, body } = await postJson("/api/analyze", {
      repoUrl: "https://github.com/VinuthaKiran-07/definitely-not-a-real-repo-xyz",
    });
    record(
      "404 with REPO_NOT_FOUND for missing repo",
      response.status === 404 && isErrorResponse(body, "REPO_NOT_FOUND"),
      `status=${response.status} body=${JSON.stringify(body).slice(0, 120)}`
    );
  }

  await section("7. Audit endpoint contract");
  {
    if (analysis === null) {
      record("audit contract (skipped: no analysis)", false, "prior step failed");
    } else {
      const { response, body } = await postJson("/api/audit", {
        repoUrl: "https://github.com/VinuthaKiran-07/RepoPulse-Lite-",
        analysis,
      });
      record("audit returns 200", response.status === 200, `status=${response.status} body=${JSON.stringify(body).slice(0, 120)}`);
      if (response.status === 200) {
        record(
          "mode is llm or fallback",
          body.mode === "llm" || body.mode === "fallback",
          `mode=${body.mode}`
        );
        record(
          "report is non-empty markdown",
          typeof body.report === "string" && body.report.length > 100,
          `len=${body.report?.length}`
        );
        record(
          "fallback carries reason, llm carries model",
          body.mode === "llm" ? typeof body.model === "string" : typeof body.reason === "string"
        );
        record(
          "fallback report is labeled heuristic-only",
          body.mode !== "fallback" || /heuristic/i.test(body.report),
          "fallback report not labeled"
        );
      }

      const badSnapshot = await postJson("/api/audit", {
        repoUrl: "https://github.com/VinuthaKiran-07/RepoPulse-Lite-",
        analysis: { repo: { fullName: "x/y" } },
      });
      record(
        "400 for malformed snapshot",
        badSnapshot.response.status === 400 &&
          isErrorResponse(badSnapshot.body, "INVALID_SNAPSHOT"),
        `status=${badSnapshot.response.status}`
      );

      const badUrl = await postJson("/api/audit", {
        repoUrl: "https://evil.com/owner/repo",
        analysis,
      });
      record(
        "400 for invalid repoUrl in audit",
        badUrl.response.status === 400 && isErrorResponse(badUrl.body, "INVALID_URL"),
        `status=${badUrl.response.status}`
      );
    }
  }

  await section("8. Audit graceful fallback with bogus runtime provider");
  {
    if (analysis === null) {
      record("bogus provider (skipped: no analysis)", false, "prior step failed");
    } else {
      const { response, body } = await postJson("/api/audit", {
        repoUrl: "https://github.com/VinuthaKiran-07/RepoPulse-Lite-",
        analysis,
        llm: {
          baseUrl: "https://api.invalid-repopulse-e2e.test/v1",
          model: "nonexistent-model",
          apiKey: "bogus-key-e2e",
        },
      });
      record(
        "bogus provider still returns 200 with fallback",
        response.status === 200 && body?.mode === "fallback" && typeof body?.report === "string",
        `status=${response.status} mode=${body?.mode}`
      );
      record(
        "bogus provider reason is a safe message",
        typeof body?.reason === "string" && body.reason.length > 0,
        `reason=${body?.reason}`
      );
      record(
        "bogus key never echoed back",
        typeof body === "object" && !JSON.stringify(body).includes("bogus-key-e2e")
      );
    }
  }

  await section("9. Rate limit contract (best effort)");
  {
    const { response, body } = await postJson("/api/analyze", {
      repoUrl: "https://github.com/VinuthaKiran-07/RepoPulse-Lite-",
    });
    if (response.status === 429) {
      record(
        "429 carries RATE_LIMITED + retryAfterSeconds + Retry-After header",
        isErrorResponse(body, "RATE_LIMITED") &&
          typeof body.error.retryAfterSeconds === "number" &&
          body.error.retryAfterSeconds > 0 &&
          response.headers.get("retry-after") !== null,
        `body=${JSON.stringify(body).slice(0, 120)}`
      );
    } else {
      console.log("  SKIP  rate limit not currently triggered (expected in fresh window)");
    }
  }

  console.log(`\nE2E RESULT: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("\nFailures:");
    for (const f of failures) {
      console.log(`  - ${f}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("E2E harness crashed:", err);
  process.exit(1);
});
