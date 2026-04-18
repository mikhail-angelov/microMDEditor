import {
  parseMarkdownToBlocks,
  serializeBlocksToMarkdown,
} from "./markdown";

describe("parseMarkdownToBlocks", () => {
  it("parses supported block markers into canonical block types", () => {
    const markdown = [
      "# H1",
      "",
      "## H2",
      "",
      "- item",
      "",
      "* item",
      "",
      "1. item",
      "",
      "- [ ] task",
      "",
      "> quote",
      "",
      "```ts",
      "const x = 1;",
      "```",
      "",
      "---",
      "",
      "paragraph",
    ].join("\n");

    const blocks = parseMarkdownToBlocks(markdown);

    expect(blocks.map((block) => block.type)).toEqual([
      "heading",
      "heading",
      "unordered-list",
      "unordered-list",
      "ordered-list",
      "task-list",
      "blockquote",
      "code-fence",
      "horizontal-rule",
      "paragraph",
    ]);
  });

  it("round-trips canonical markdown exactly", () => {
    const markdown = "# Title\n\nparagraph\n\n- item";
    expect(serializeBlocksToMarkdown(parseMarkdownToBlocks(markdown))).toBe(markdown);
  });

  it("keeps fenced code blocks with internal blank lines as one block and round-trips", () => {
    const markdown = ["```ts", "const x = 1;", "", "const y = 2;", "```"].join("\n");

    const blocks = parseMarkdownToBlocks(markdown);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.type).toBe("code-fence");
    expect(serializeBlocksToMarkdown(blocks)).toBe(markdown);
  });

  it("generates unique ids within a parse call, and different ids across calls", () => {
    const markdown = "# Title\n\nparagraph\n\n- item";

    const first = parseMarkdownToBlocks(markdown);
    const second = parseMarkdownToBlocks(markdown);

    // All IDs within a single call are unique
    expect(new Set(first.map((b) => b.id)).size).toBe(3);
    expect(new Set(second.map((b) => b.id)).size).toBe(3);
    // IDs are not reused across calls (prevents collision when pasting)
    const firstIds = new Set(first.map((b) => b.id));
    second.forEach((b) => expect(firstIds.has(b.id)).toBe(false));
  });
});
