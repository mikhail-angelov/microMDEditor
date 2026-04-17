import { replaceSelectionWithMarkdown } from "./paste";

describe("replaceSelectionWithMarkdown", () => {
  it("replaces a multi-block range and places caret at end of inserted content", () => {
    const result = replaceSelectionWithMarkdown(
      [
        { id: "a", type: "paragraph", raw: "hello" },
        { id: "b", type: "paragraph", raw: "world" },
      ],
      {
        start: { blockId: "a", offset: 2 },
        end: { blockId: "b", offset: 3 },
        isCollapsed: false,
      },
      "# Title\nparagraph",
    );

    expect(result.markdown).toBe("he# Title\n\nparagraphld");
    expect(result.caret.blockId).toBe(result.blocks[result.blocks.length - 1].id);
  });
});
