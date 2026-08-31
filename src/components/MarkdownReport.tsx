"use client";

import { Fragment, type ReactNode } from "react";

interface MarkdownReportProps {
  content: string;
}

const orderedItemPattern = /^\d+\. /;

function renderInline(text: string, blockKeyPrefix: string): ReactNode[] {
  const parts = text.split(/\*\*(.+?)\*\*/);
  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <strong key={`${blockKeyPrefix}-inline-${index}`} className="font-semibold">
        {part}
      </strong>
    ) : (
      <Fragment key={`${blockKeyPrefix}-inline-${index}`}>{part}</Fragment>
    )
  );
}

export default function MarkdownReport({ content }: MarkdownReportProps) {
  if (content.trim().length === 0) {
    return null;
  }

  const lines = content.split("\n");
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];
  let listKind: "ul" | "ol" | null = null;
  let blockIndex = 0;

  function flushList() {
    if (listItems.length > 0 && listKind !== null) {
      const items = listItems;
      const kind = listKind;
      const prefix = `block-${blockIndex}`;
      const Tag = kind;
      blocks.push(
        <Tag
          key={prefix}
          className={
            kind === "ul"
              ? "my-3 list-disc space-y-1 pl-5"
              : "my-3 list-decimal space-y-1 pl-5"
          }
        >
          {items.map((item, itemIndex) => (
            <li key={`${prefix}-item-${itemIndex}`} className="pl-1">
              {renderInline(item, `${prefix}-item-${itemIndex}`)}
            </li>
          ))}
        </Tag>
      );
      blockIndex += 1;
      listItems = [];
      listKind = null;
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.trim().length === 0) {
      flushList();
      continue;
    }

    if (line.startsWith("### ")) {
      flushList();
      const prefix = `block-${blockIndex}`;
      blocks.push(
        <h3
          key={prefix}
          className="mt-5 text-base font-semibold text-neutral-900 first:mt-0 dark:text-neutral-100"
        >
          {renderInline(line.slice(4), prefix)}
        </h3>
      );
      blockIndex += 1;
      continue;
    }

    if (line.startsWith("## ")) {
      flushList();
      const prefix = `block-${blockIndex}`;
      blocks.push(
        <h2
          key={prefix}
          className="mt-6 text-lg font-semibold text-neutral-900 first:mt-0 dark:text-neutral-100"
        >
          {renderInline(line.slice(3), prefix)}
        </h2>
      );
      blockIndex += 1;
      continue;
    }

    if (line.startsWith("# ")) {
      flushList();
      const prefix = `block-${blockIndex}`;
      blocks.push(
        <h2
          key={prefix}
          className="text-xl font-bold text-neutral-900 first:mt-0 dark:text-neutral-100"
        >
          {renderInline(line.slice(2), prefix)}
        </h2>
      );
      blockIndex += 1;
      continue;
    }

    if (line.startsWith("- ")) {
      if (listKind === "ol") {
        flushList();
      }
      listKind = "ul";
      listItems.push(line.slice(2));
      continue;
    }

    if (orderedItemPattern.test(line)) {
      if (listKind === "ul") {
        flushList();
      }
      listKind = "ol";
      listItems.push(line.replace(orderedItemPattern, ""));
      continue;
    }

    flushList();
    const prefix = `block-${blockIndex}`;
    blocks.push(
      <p key={prefix} className="my-3 first:mt-0">
        {renderInline(line, prefix)}
      </p>
    );
    blockIndex += 1;
  }

  flushList();

  return (
    <div className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
      {blocks}
    </div>
  );
}
