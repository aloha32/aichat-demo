import { describe, expect, it } from "vitest";

import { generateConversationTitle } from "@/lib/chat/utils";

describe("generateConversationTitle", () => {
  it("falls back to a default title for empty input", () => {
    expect(generateConversationTitle("   \n\t  ")).toBe("新对话");
  });

  it("collapses whitespace before building the title", () => {
    expect(generateConversationTitle("  Launch   checklist \n for   demo  ")).toBe(
      "Launch checklist for demo",
    );
  });

  it("truncates long titles with a three-dot suffix", () => {
    const title = generateConversationTitle(
      "This is a deliberately long prompt that should be trimmed before it becomes a conversation title",
    );

    expect(title.endsWith("...")).toBe(true);
    expect(title.length).toBeLessThanOrEqual(48);
  });
});
