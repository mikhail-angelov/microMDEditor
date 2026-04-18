import { generateId } from "./id";
import type { Block, BlockPoint, BlockRange } from "./types";
import { parseMarkdownToBlocks, serializeBlocksToMarkdown } from "./markdown";

export type KeyResult = {
  blocks: Block[];
  markdown: string;
  caret: BlockPoint;
};

function clamp(value: number, max: number): number {
  return Math.max(0, Math.min(value, max));
}

function getActualMarker(block: Block): string {
  return block.raw.match(/^(?:#{1,6} |[-*] (?:\[[ xX]\] )?|\d+\. |> )/)?.[0] ?? "";
}

function continuationPrefixFor(block: Block): string {
  switch (block.type) {
    case "unordered-list":
      return `${block.meta?.marker ?? "-"} `;
    case "ordered-list":
      return `${(block.meta?.order ?? 1) + 1}. `;
    case "task-list":
      return "- [ ] ";
    case "blockquote":
      return "> ";
    default:
      return "";
  }
}

function parsedBlock(raw: string): Pick<Block, "type" | "meta"> {
  if (raw.length === 0) return { type: "paragraph" };
  const b = parseMarkdownToBlocks(raw)[0];
  return { type: b?.type ?? "paragraph", meta: b?.meta };
}

// Collapse a non-collapsed range by merging start prefix and end suffix.
function deleteRange(blocks: Block[], range: BlockRange): KeyResult | null {
  const startIdx = blocks.findIndex((b) => b.id === range.start.blockId);
  const endIdx = blocks.findIndex((b) => b.id === range.end.blockId);
  if (startIdx < 0 || endIdx < 0 || startIdx > endIdx) return null;

  const startBlock = blocks[startIdx];
  const endBlock = blocks[endIdx];
  const prefix = startBlock.raw.slice(0, clamp(range.start.offset, startBlock.raw.length));
  const suffix = endBlock.raw.slice(clamp(range.end.offset, endBlock.raw.length));
  const mergedRaw = prefix + suffix;

  const merged: Block = { id: startBlock.id, ...parsedBlock(mergedRaw), raw: mergedRaw };
  const next = [...blocks.slice(0, startIdx), merged, ...blocks.slice(endIdx + 1)];

  return {
    blocks: next,
    markdown: serializeBlocksToMarkdown(next),
    caret: { blockId: merged.id, offset: prefix.length },
  };
}

export function applyEnter(blocks: Block[], selection: BlockRange): KeyResult | null {
  // Non-collapsed: delete the selection first, then split at the caret.
  if (!selection.isCollapsed) {
    const deleted = deleteRange(blocks, selection);
    if (!deleted) return null;
    return applyEnter(deleted.blocks, {
      start: deleted.caret,
      end: deleted.caret,
      isCollapsed: true,
    });
  }

  const idx = blocks.findIndex((b) => b.id === selection.start.blockId);
  if (idx < 0) return null;

  const block = blocks[idx];
  const offset = clamp(selection.start.offset, block.raw.length);

  // Code fence: insert literal newline instead of splitting the block.
  if (block.type === "code-fence") {
    const newRaw = block.raw.slice(0, offset) + "\n" + block.raw.slice(offset);
    const updated: Block = { ...block, raw: newRaw };
    const next = [...blocks.slice(0, idx), updated, ...blocks.slice(idx + 1)];
    return {
      blocks: next,
      markdown: serializeBlocksToMarkdown(next),
      caret: { blockId: block.id, offset: offset + 1 },
    };
  }
  const prefix = block.raw.slice(0, offset);
  const suffix = block.raw.slice(offset);
  const continuation = continuationPrefixFor(block);
  const actualMarker = getActualMarker(block);

  // Empty structural block (only marker remains): exit the structure.
  if (actualMarker && suffix === "" && block.raw === actualMarker) {
    const para: Block = { id: generateId(), type: "paragraph", raw: "" };
    const next = [...blocks.slice(0, idx), para, ...blocks.slice(idx + 1)];
    return {
      blocks: next,
      markdown: serializeBlocksToMarkdown(next),
      caret: { blockId: para.id, offset: 0 },
    };
  }

  const updatedInfo = parsedBlock(prefix);
  const updated: Block = { id: block.id, ...updatedInfo, raw: prefix };

  const newRaw = continuation + suffix;
  const newInfo = parsedBlock(newRaw);
  const newBlock: Block = { id: generateId(), ...newInfo, raw: newRaw };

  const next = [...blocks.slice(0, idx), updated, newBlock, ...blocks.slice(idx + 1)];

  return {
    blocks: next,
    markdown: serializeBlocksToMarkdown(next),
    caret: { blockId: newBlock.id, offset: continuation.length },
  };
}

export function applyBackspace(blocks: Block[], selection: BlockRange): KeyResult | null {
  // Non-collapsed: delete the selection.
  if (!selection.isCollapsed) return deleteRange(blocks, selection);

  if (selection.start.offset !== 0) return null;

  const idx = blocks.findIndex((b) => b.id === selection.start.blockId);
  if (idx <= 0) return null;

  const cur = blocks[idx];
  const prev = blocks[idx - 1];
  const caretOffset = prev.raw.length;
  const mergedRaw = prev.raw + cur.raw;
  const merged: Block = { id: prev.id, ...parsedBlock(mergedRaw), raw: mergedRaw };

  const next = [...blocks.slice(0, idx - 1), merged, ...blocks.slice(idx + 1)];

  return {
    blocks: next,
    markdown: serializeBlocksToMarkdown(next),
    caret: { blockId: merged.id, offset: caretOffset },
  };
}

export function applyDelete(blocks: Block[], selection: BlockRange): KeyResult | null {
  // Non-collapsed: delete the selection.
  if (!selection.isCollapsed) return deleteRange(blocks, selection);

  const idx = blocks.findIndex((b) => b.id === selection.start.blockId);
  if (idx < 0) return null;

  const block = blocks[idx];

  // Only intercept when caret is at the end of the block.
  if (selection.start.offset < block.raw.length) return null;

  // Last block or code fence boundary: let the browser handle.
  if (idx >= blocks.length - 1) return null;
  if (block.type === "code-fence" || blocks[idx + 1].type === "code-fence") return null;

  const nextBlock = blocks[idx + 1];
  const mergedRaw = block.raw + nextBlock.raw;
  const merged: Block = { id: block.id, ...parsedBlock(mergedRaw), raw: mergedRaw };

  const next = [...blocks.slice(0, idx), merged, ...blocks.slice(idx + 2)];

  return {
    blocks: next,
    markdown: serializeBlocksToMarkdown(next),
    caret: { blockId: merged.id, offset: block.raw.length },
  };
}
