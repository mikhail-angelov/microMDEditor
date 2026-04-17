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

  it("generates deterministic ids per parse call", () => {
    const markdown = "# Title\n\nparagraph\n\n- item";

    const first = parseMarkdownToBlocks(markdown);
    const second = parseMarkdownToBlocks(markdown);

    expect(first.map((block) => block.id)).toEqual(["block-0", "block-1", "block-2"]);
    expect(second.map((block) => block.id)).toEqual(["block-0", "block-1", "block-2"]);
  });
});
