import { replaceSelectionWithMarkdown } from "./paste";
import type { Block, BlockRange } from "./types";

function collapsed(blockId: string, offset: number): BlockRange {
  return { start: { blockId, offset }, end: { blockId, offset }, isCollapsed: true };
}

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

  it("appends heading and list items after a paragraph and produces unique block IDs", () => {
    const existingBlocks: Block[] = [
      { id: "existing-para", type: "paragraph", raw: "Intro paragraph" },
    ];

    const result = replaceSelectionWithMarkdown(
      existingBlocks,
      collapsed("existing-para", existingBlocks[0].raw.length),
      "# Section Header\n- First item\n- Second item\n- Third item",
    );

    expect(result.blocks).toHaveLength(5);
    expect(result.blocks[0].raw).toBe("Intro paragraph");
    expect(result.blocks[0].type).toBe("paragraph");
    expect(result.blocks[1].raw).toBe("# Section Header");
    expect(result.blocks[1].type).toBe("heading");
    expect(result.blocks[2].raw).toBe("- First item");
    expect(result.blocks[2].type).toBe("unordered-list");
    expect(result.blocks[3].raw).toBe("- Second item");
    expect(result.blocks[4].raw).toBe("- Third item");

    // All IDs must be unique
    const ids = result.blocks.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);

    expect(result.markdown).toBe(
      "Intro paragraph\n\n# Section Header\n\n- First item\n\n- Second item\n\n- Third item",
    );
  });

  it("caret lands at end of last pasted block", () => {
    const existingBlocks: Block[] = [
      { id: "para-xyz", type: "paragraph", raw: "Before" },
    ];

    const result = replaceSelectionWithMarkdown(
      existingBlocks,
      collapsed("para-xyz", 6),
      "# Title\n- item 1",
    );

    const lastBlock = result.blocks[result.blocks.length - 1];
    expect(result.caret.blockId).toBe(lastBlock.id);
    expect(result.caret.offset).toBe(lastBlock.raw.length);
  });
});
