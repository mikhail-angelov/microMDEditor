import { parseMarkdownToBlocks, serializeBlocksToMarkdown } from "./markdown";
import type { Block, BlockPoint, BlockRange } from "./types";

type ReplaceSelectionResult = {
  blocks: Block[];
  markdown: string;
  caret: BlockPoint;
};

function clampOffset(offset: number, raw: string): number {
  return Math.max(0, Math.min(offset, raw.length));
}

function parsePastedBlocks(pasted: string): Block[] {
  const normalized = pasted.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const chunks: string[] = [];
  let lineIndex = 0;

  while (lineIndex < lines.length) {
    if (lines[lineIndex] === "") {
      lineIndex += 1;
      continue;
    }

    if (lines[lineIndex].startsWith("```")) {
      const start = lineIndex;
      lineIndex += 1;
      while (lineIndex < lines.length && !lines[lineIndex].startsWith("```")) {
        lineIndex += 1;
      }
      if (lineIndex < lines.length) {
        lineIndex += 1;
      }
      chunks.push(lines.slice(start, lineIndex).join("\n"));
      continue;
    }

    chunks.push(lines[lineIndex]);
    lineIndex += 1;
  }

  return parseMarkdownToBlocks(chunks.join("\n\n"));
}

export function replaceSelectionWithMarkdown(
  blocks: Block[],
  range: BlockRange,
  pasted: string,
): ReplaceSelectionResult {
  const startIndex = blocks.findIndex((block) => block.id === range.start.blockId);
  const endIndex = blocks.findIndex((block) => block.id === range.end.blockId);
  if (startIndex < 0 || endIndex < 0 || startIndex > endIndex) {
    throw new Error("Selection range points to unknown blocks");
  }

  const startBlock = blocks[startIndex];
  const endBlock = blocks[endIndex];
  const inserted = parsePastedBlocks(pasted);

  if (range.isCollapsed && startIndex === endIndex && range.start.offset <= 0) {
    const nextBlocks = [...blocks.slice(0, startIndex), ...inserted, ...blocks.slice(startIndex)];
    const caretBlock = nextBlocks[startIndex + inserted.length - 1];
    return {
      blocks: nextBlocks,
      markdown: serializeBlocksToMarkdown(nextBlocks),
      caret: { blockId: caretBlock.id, offset: caretBlock.raw.length },
    };
  }

  if (
    range.isCollapsed &&
    startIndex === endIndex &&
    range.start.offset >= startBlock.raw.length
  ) {
    const nextBlocks = [
      ...blocks.slice(0, startIndex + 1),
      ...inserted,
      ...blocks.slice(startIndex + 1),
    ];
    const caretBlock = nextBlocks[startIndex + inserted.length];
    return {
      blocks: nextBlocks,
      markdown: serializeBlocksToMarkdown(nextBlocks),
      caret: { blockId: caretBlock.id, offset: caretBlock.raw.length },
    };
  }

  const startOffset = clampOffset(range.start.offset, startBlock.raw);
  const endOffset = clampOffset(range.end.offset, endBlock.raw);
  const prefix = startBlock.raw.slice(0, startOffset);
  const suffix = endBlock.raw.slice(endOffset);

  const merged =
    inserted.length === 1
      ? [{ ...inserted[0], raw: `${prefix}${inserted[0].raw}${suffix}` }]
      : inserted.map((block) => ({ ...block }));

  if (merged.length > 1) {
    merged[0] = { ...merged[0], raw: `${prefix}${merged[0].raw}` };
    merged[merged.length - 1] = {
      ...merged[merged.length - 1],
      raw: `${merged[merged.length - 1].raw}${suffix}`,
    };
  }

  const nextBlocks = [
    ...blocks.slice(0, startIndex),
    ...merged,
    ...blocks.slice(endIndex + 1),
  ];
  const caretBlock = nextBlocks[startIndex + merged.length - 1];
  const caret: BlockPoint = {
    blockId: caretBlock.id,
    offset: Math.max(0, caretBlock.raw.length - suffix.length),
  };

  return {
    blocks: nextBlocks,
    markdown: serializeBlocksToMarkdown(nextBlocks),
    caret,
  };
}
