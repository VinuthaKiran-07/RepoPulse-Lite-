// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import AuditSection from "@/components/AuditSection";
import type { AuditSectionProps } from "@/components/AuditSection";

function baseProps(overrides: Partial<AuditSectionProps> = {}): AuditSectionProps {
  return {
    status: "idle",
    report: null,
    mode: null,
    model: null,
    reason: null,
    errorCode: null,
    errorMessage: null,
    hasLlmKey: true,
    onGenerate: vi.fn(),
    ...overrides,
  };
}

function sectionProps(props: AuditSectionProps): AuditSectionProps {
  return props;
}

describe("AuditSection", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the idle header and LLM button, calling onGenerate on click", async () => {
    const onGenerate = vi.fn();
    render(
      <AuditSection {...sectionProps(baseProps({ status: "idle", hasLlmKey: true, onGenerate }))} />
    );
    expect(screen.getByText("Executive Audit")).toBeInTheDocument();
    expect(
      screen.getByText("AI-generated risk assessment with prioritized recommendations.")
    ).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Generate executive audit" });
    expect(button).toHaveTextContent("Generate LLM Executive Audit");
    const userEvent = (await import("@testing-library/user-event")).default;
    await userEvent.setup().click(button);
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  it("shows the heuristic-only label and amber hint when hasLlmKey is false", () => {
    render(
      <AuditSection {...sectionProps(baseProps({ hasLlmKey: false }))} />
    );
    expect(
      screen.getByText("Generate Audit (Heuristic-only)")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/No provider key configured/i)
    ).toBeInTheDocument();
  });

  it("disables the button and shows a skeleton while generating", () => {
    render(
      <AuditSection {...sectionProps(baseProps({ status: "generating" }))} />
    );
    const button = screen.getByRole("button", { name: "Generate executive audit" });
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("Generating…");
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-label", "Generating audit report");
    expect(
      screen.queryByText(/Heuristic-only mode/)
    ).not.toBeInTheDocument();
  });

  it("shows the error message, code chip, and a working retry button", async () => {
    const onGenerate = vi.fn();
    render(
      <AuditSection
        {...sectionProps(
          baseProps({
            status: "error",
            errorCode: "AUDIT_RATE_LIMITED",
            errorMessage: "LLM provider timed out.",
            onGenerate,
          })
        )}
      />
    );
    expect(screen.getByText("LLM provider timed out.")).toBeInTheDocument();
    expect(screen.getByText("AUDIT_RATE_LIMITED")).toBeInTheDocument();
    const retry = screen.getByRole("button", { name: "Retry audit generation" });
    const userEvent = (await import("@testing-library/user-event")).default;
    await userEvent.setup().click(retry);
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  it("falls back to a default error message when none is provided", () => {
    render(
      <AuditSection
        {...sectionProps(baseProps({ status: "error", errorCode: null, errorMessage: null }))}
      />
    );
    expect(
      screen.getByText("The audit could not be generated.")
    ).toBeInTheDocument();
  });

  it("shows the fallback notice with reason and renders the report", () => {
    render(
      <AuditSection
        {...sectionProps(
          baseProps({
            status: "success",
            mode: "fallback",
            reason: "No LLM provider key configured.",
            report: "## Risk Summary\nPriority items below.",
          })
        )}
      />
    );
    expect(screen.getByText("Heuristic-only mode")).toBeInTheDocument();
    expect(
      screen.getByText("No LLM provider key configured.")
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Risk Summary" })).toBeInTheDocument();
    expect(screen.getByText("Priority items below.")).toBeInTheDocument();
    expect(screen.queryByText("LLM Audit")).not.toBeInTheDocument();
  });

  it("falls back to a default reason in fallback mode when reason is null", () => {
    render(
      <AuditSection
        {...sectionProps(baseProps({ status: "success", mode: "fallback", reason: null, report: "report" }))}
      />
    );
    const defaults = screen.getAllByText("No LLM provider key configured.");
    expect(defaults.length).toBeGreaterThan(0);
  });

  it("shows the LLM badge with model and no fallback notice", () => {
    render(
      <AuditSection
        {...sectionProps(
          baseProps({
            status: "success",
            mode: "llm",
            model: "llama-3.3-70b-versatile",
            report: "## Audit\nAll clear.",
          })
        )}
      />
    );
    expect(screen.getByText(/LLM Audit/)).toBeInTheDocument();
    expect(
      screen.getByText(/llama-3\.3-70b-versatile/)
    ).toBeInTheDocument();
    expect(screen.queryByText(/Heuristic-only mode/)).not.toBeInTheDocument();
  });

  it("renders success with a null report without crashing", () => {
    const { container } = render(
      <AuditSection
        {...sectionProps(baseProps({ status: "success", mode: "llm", model: null, report: null }))}
      />
    );
    expect(screen.getByText("Executive Audit")).toBeInTheDocument();
    expect(screen.queryByText(/Heuristic-only mode/)).not.toBeInTheDocument();
    expect(container.querySelectorAll("h3, ul, ol")).toHaveLength(0);
  });
});
