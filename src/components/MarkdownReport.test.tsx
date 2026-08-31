// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import MarkdownReport from "@/components/MarkdownReport";

describe("MarkdownReport", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders headings, bullets, and numbered items", () => {
    render(
      <MarkdownReport
        content={[
          "# RepoPulse Report",
          "",
          "## Summary",
          "",
          "- fast release cadence",
          "- single owner risk",
          "",
          "### Details",
          "",
          "1. first priority",
          "2. second priority",
          "",
          "closing paragraph",
        ].join("\n")}
      />
    );
    expect(screen.getByText("RepoPulse Report")).toBeInTheDocument();
    expect(screen.getByText("Summary")).toBeInTheDocument();
    expect(screen.getByText("Details")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getByText("fast release cadence")).toBeInTheDocument();
    expect(screen.getByText("single owner risk")).toBeInTheDocument();
    expect(screen.getByText("first priority")).toBeInTheDocument();
    expect(screen.getByText("second priority")).toBeInTheDocument();
    expect(screen.getByText("closing paragraph")).toBeInTheDocument();
    expect(screen.queryByText(/^1\. /)).not.toBeInTheDocument();
  });

  it("renders numbered items without the leading number prefix", () => {
    const { container } = render(
      <MarkdownReport content={"1. one\n2. two\n3. three"} />
    );
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("one");
    expect(items[1]).toHaveTextContent("two");
    expect(items[2]).toHaveTextContent("three");
    expect(container.textContent).not.toContain("1. ");
  });

  it("renders bold segments as strong elements", () => {
    const { container } = render(
      <MarkdownReport content={"Risk level **high** for this window."} />
    );
    const strong = container.querySelector("strong");
    expect(strong).not.toBeNull();
    expect(strong).toHaveTextContent("high");
    expect(screen.getByText("Risk level", { exact: false })).toBeInTheDocument();
  });

  it("renders bold segments inside headings and list items", () => {
    const { container } = render(
      <MarkdownReport
        content={"## **Key** risks\n- **urgent** item"}
      />
    );
    const strongs = container.querySelectorAll("strong");
    expect(strongs).toHaveLength(2);
    expect(strongs[0]).toHaveTextContent("Key");
    expect(strongs[1]).toHaveTextContent("urgent");
  });

  it("renders nothing for empty and whitespace-only content", () => {
    const { container, rerender } = render(<MarkdownReport content="" />);
    expect(container.childElementCount).toBe(0);
    expect(container.querySelector("div")).toBeNull();
    rerender(<MarkdownReport content={"   \n  \n"} />);
    expect(container.childElementCount).toBe(0);
    expect(container.querySelector("div")).toBeNull();
  });

  it("renders a mixed document in correct block order", () => {
    render(
      <MarkdownReport
        content={[
          "## Heading",
          "",
          "- bullet",
          "",
          "outro paragraph",
        ].join("\n")}
      />
    );
    expect(screen.getByRole("heading", { name: "Heading" })).toBeInTheDocument();
    expect(screen.getByRole("listitem")).toBeInTheDocument();
    expect(screen.getByText("outro paragraph")).toBeInTheDocument();
    const ordered = Array.from(
      document.body.querySelectorAll("h2, li, p")
    ).map((el) => ({ tag: el.tagName, text: el.textContent }));
    expect(ordered).toEqual([
      { tag: "H2", text: "Heading" },
      { tag: "LI", text: "bullet" },
      { tag: "P", text: "outro paragraph" },
    ]);
  });
});
