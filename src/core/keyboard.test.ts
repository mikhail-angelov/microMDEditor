import { applyEnter, applyBackspace, applyDelete } from "./keyboard";
import type { Block, BlockRange } from "./types";

function block(id: string, raw: string): Block {
  return { id, type: "paragraph", raw };
}

function collapsed(blockId: string, offset: number): BlockRange {
  return { start: { blockId, offset }, end: { blockId, offset }, isCollapsed: true };
}

function expanded(
  startId: string, startOffset: number,
  endId: string, endOffset: number,
): BlockRange {
  return {
    start: { blockId: startId, offset: startOffset },
    end: { blockId: endId, offset: endOffset },
    isCollapsed: false,
  };
}

// ─── applyEnter ─────────────────────────────────────────────────────────────

describe("applyEnter", () => {
  it("splits a paragraph at the caret", () => {
    const blocks = [block("a", "hello world")];
    const result = applyEnter(blocks, collapsed("a", 5));

    expect(result).not.toBeNull();
    expect(result!.blocks).toHaveLength(2);
    expect(result!.blocks[0].raw).toBe("hello");
    expect(result!.blocks[0].type).toBe("paragraph");
    expect(result!.blocks[1].raw).toBe(" world");
    expect(result!.blocks[1].type).toBe("paragraph");
    expect(result!.caret.blockId).toBe(result!.blocks[1].id);
    expect(result!.caret.offset).toBe(0);
  });

  it("creates an empty paragraph after Enter at end of heading", () => {
    const blocks = [{ id: "a", type: "heading" as const, raw: "# Title", meta: { level: 1 } }];
    const result = applyEnter(blocks, collapsed("a", 7));

    expect(result).not.toBeNull();
    expect(result!.blocks[0].raw).toBe("# Title");
    expect(result!.blocks[0].type).toBe("heading");
    expect(result!.blocks[1].raw).toBe("");
    expect(result!.blocks[1].type).toBe("paragraph");
  });

  it("demotes the split prefix when heading marker is removed by the split point", () => {
    const blocks = [{ id: "a", type: "heading" as const, raw: "# Title", meta: { level: 1 } }];
    const result = applyEnter(blocks, collapsed("a", 0));

    expect(result).not.toBeNull();
    // prefix "" → paragraph; suffix "# Title" → heading
    expect(result!.blocks[0].raw).toBe("");
    expect(result!.blocks[0].type).toBe("paragraph");
    expect(result!.blocks[1].raw).toBe("# Title");
    expect(result!.blocks[1].type).toBe("heading");
  });

  it("continues an unordered list marker on Enter", () => {
    const blocks = [{ id: "a", type: "unordered-list" as const, raw: "- item", meta: { marker: "-" } }];
    const result = applyEnter(blocks, collapsed("a", 6));

    expect(result).not.toBeNull();
    expect(result!.blocks[0].raw).toBe("- item");
    expect(result!.blocks[1].raw).toBe("- ");
    expect(result!.blocks[1].type).toBe("unordered-list");
    expect(result!.caret.offset).toBe(2); // after "- "
  });

  it("exits a list on Enter when the item is empty", () => {
    const blocks = [{ id: "a", type: "unordered-list" as const, raw: "- ", meta: { marker: "-" } }];
    const result = applyEnter(blocks, collapsed("a", 2));

    expect(result).not.toBeNull();
    expect(result!.blocks).toHaveLength(1);
    expect(result!.blocks[0].type).toBe("paragraph");
    expect(result!.blocks[0].raw).toBe("");
  });

  it("continues an ordered list with the next number", () => {
    const blocks = [{ id: "a", type: "ordered-list" as const, raw: "1. first", meta: { order: 1 } }];
    const result = applyEnter(blocks, collapsed("a", 8));

    expect(result!.blocks[1].raw).toBe("2. ");
    expect(result!.blocks[1].type).toBe("ordered-list");
  });

  it("continues a task list with an unchecked item", () => {
    const blocks = [{ id: "a", type: "task-list" as const, raw: "- [x] done", meta: { marker: "-", checked: true } }];
    const result = applyEnter(blocks, collapsed("a", 10));

    expect(result!.blocks[1].raw).toBe("- [ ] ");
    expect(result!.blocks[1].type).toBe("task-list");
  });

  it("continues a blockquote on Enter", () => {
    const blocks = [{ id: "a", type: "blockquote" as const, raw: "> text" }];
    const result = applyEnter(blocks, collapsed("a", 6));

    expect(result!.blocks[1].raw).toBe("> ");
    expect(result!.blocks[1].type).toBe("blockquote");
  });

  it("exits a blockquote on Enter when empty", () => {
    const blocks = [{ id: "a", type: "blockquote" as const, raw: "> " }];
    const result = applyEnter(blocks, collapsed("a", 2));

    expect(result!.blocks[0].type).toBe("paragraph");
  });

  it("inserts a newline inside a code fence block", () => {
    const blocks = [{ id: "a", type: "code-fence" as const, raw: "```\ncode\n```" }];
    const result = applyEnter(blocks, collapsed("a", 4));

    expect(result).not.toBeNull();
    expect(result!.blocks).toHaveLength(1);
    expect(result!.blocks[0].raw).toBe("```\n\ncode\n```");
    expect(result!.blocks[0].type).toBe("code-fence");
    expect(result!.caret.blockId).toBe("a");
    expect(result!.caret.offset).toBe(5);
  });

  it("deletes a cross-block selection then splits on Enter", () => {
    const blocks = [block("a", "hello"), block("b", "world")];
    const result = applyEnter(blocks, expanded("a", 2, "b", 3));

    expect(result).not.toBeNull();
    // Selection covers "llo" from a and "wor" from b → deleted.
    // Remaining text: "he" + "ld" → "held" → split at 2 → "he" and "ld"
    expect(result!.blocks[0].raw).toBe("he");
    expect(result!.blocks[1].raw).toBe("ld");
  });
});

// ─── applyBackspace ──────────────────────────────────────────────────────────

describe("applyBackspace", () => {
  it("merges with the previous block when caret is at offset 0", () => {
    const blocks = [block("a", "first"), block("b", "second")];
    const result = applyBackspace(blocks, collapsed("b", 0));

    expect(result).not.toBeNull();
    expect(result!.blocks).toHaveLength(1);
    expect(result!.blocks[0].id).toBe("a");
    expect(result!.blocks[0].raw).toBe("firstsecond");
    expect(result!.caret.offset).toBe(5); // junction point
  });

  it("returns null when caret is not at offset 0 (let browser delete the char)", () => {
    const blocks = [block("a", "hello")];
    expect(applyBackspace(blocks, collapsed("a", 3))).toBeNull();
  });

  it("returns null for the first block (nothing to merge into)", () => {
    const blocks = [block("a", "hello")];
    expect(applyBackspace(blocks, collapsed("a", 0))).toBeNull();
  });

  it("re-classifies the merged block type from the merged raw text", () => {
    const blocks = [
      { id: "a", type: "heading" as const, raw: "# Title", meta: { level: 1 } },
      block("b", " suffix"),
    ];
    const result = applyBackspace(blocks, collapsed("b", 0));

    expect(result!.blocks[0].raw).toBe("# Title suffix");
    expect(result!.blocks[0].type).toBe("heading");
  });

  it("deletes a cross-block selection without splitting", () => {
    const blocks = [block("a", "hello"), block("b", "world")];
    const result = applyBackspace(blocks, expanded("a", 3, "b", 2));

    expect(result).not.toBeNull();
    expect(result!.blocks).toHaveLength(1);
    expect(result!.blocks[0].raw).toBe("helrld");
    expect(result!.caret.offset).toBe(3);
  });
});

// ─── applyDelete ─────────────────────────────────────────────────────────────

describe("applyDelete", () => {
  it("merges with the next block when caret is at end of block", () => {
    const blocks = [block("a", "first"), block("b", "second")];
    const result = applyDelete(blocks, collapsed("a", 5));

    expect(result).not.toBeNull();
    expect(result!.blocks).toHaveLength(1);
    expect(result!.blocks[0].id).toBe("a");
    expect(result!.blocks[0].raw).toBe("firstsecond");
    expect(result!.caret.offset).toBe(5); // junction point
  });

  it("returns null when caret is not at end of block (let browser delete the char)", () => {
    const blocks = [block("a", "hello")];
    expect(applyDelete(blocks, collapsed("a", 2))).toBeNull();
  });

  it("returns null for the last block (nothing to merge with)", () => {
    const blocks = [block("a", "hello")];
    expect(applyDelete(blocks, collapsed("a", 5))).toBeNull();
  });

  it("does not merge across code fence boundaries", () => {
    const blocks = [
      block("a", "text"),
      { id: "b", type: "code-fence" as const, raw: "```\ncode\n```" },
    ];
    expect(applyDelete(blocks, collapsed("a", 4))).toBeNull();
  });

  it("deletes a cross-block selection", () => {
    const blocks = [block("a", "hello"), block("b", "world")];
    const result = applyDelete(blocks, expanded("a", 3, "b", 2));

    expect(result!.blocks).toHaveLength(1);
    expect(result!.blocks[0].raw).toBe("helrld");
  });
});
