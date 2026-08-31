import { describe, expect, it } from "vitest";
import { AUDIT_TEMPERATURE, buildAuditMessages } from "@/lib/llm/prompt";
import { buildAuditSnapshot } from "@/lib/llm/snapshot";
import { fixtureAnalyzeResponse } from "@/lib/test-fixtures";

describe("buildAuditMessages", () => {
  const snapshot = buildAuditSnapshot(fixtureAnalyzeResponse());

  it("returns a system and user message in order", () => {
    const messages = buildAuditMessages(snapshot);
    expect(messages).toHaveLength(2);
    expect(messages.map((message) => message.role)).toEqual(["system", "user"]);
  });

  it("uses the documented system prompt", () => {
    const messages = buildAuditMessages(snapshot);
    expect(messages[0].content).toContain("senior engineering auditor");
    expect(messages[0].content).toContain("## Prioritized Recommendations");
  });

  it("exposes the audit temperature", () => {
    expect(AUDIT_TEMPERATURE).toBe(0.2);
  });

  it("embeds the repo name and score in the user message", () => {
    const userContent = buildAuditMessages(snapshot)[1].content;
    expect(userContent).toContain("octocat/hello-world");
    expect(userContent).toContain(`"score":72`);
  });

  it("is deterministic for the same snapshot", () => {
    const first = buildAuditMessages(snapshot);
    const second = buildAuditMessages(snapshot);
    expect(second).toEqual(first);
    expect(second[1].content).toBe(first[1].content);
  });

  it("serializes snapshot keys in the fixed order", () => {
    const userContent = buildAuditMessages(snapshot)[1].content;
    const keys = ["repoFullName", "commitCount", "windowDays"];
    const positions = keys.map((key) => userContent.indexOf(`"${key}"`));
    expect(positions[0]).toBeGreaterThan(-1);
    expect(positions[1]).toBeGreaterThan(positions[0]);
    expect(positions[2]).toBeGreaterThan(positions[1]);
  });
});
