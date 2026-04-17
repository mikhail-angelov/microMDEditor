import type { BlockPoint, BlockRange } from "./types";
import { extractNodePlainText, extractRootPlainText } from "./dom-text";

function getRequiredBlockId(block: HTMLElement): string {
  const blockId = block.dataset.blockId;
  if (!blockId) {
    throw new Error("Top-level block is missing data-block-id");
  }
  return blockId;
}

function getTopLevelBlock(root: HTMLElement, node: Node | null): HTMLElement | null {
  let current = node;

  while (current && current !== root) {
    if (current.parentNode === root && current.nodeType === Node.ELEMENT_NODE) {
      return current as HTMLElement;
    }
    current = current.parentNode;
  }

  return null;
}

function getOffsetWithinBlock(block: HTMLElement, node: Node, offset: number): number {
  const range = document.createRange();
  range.selectNodeContents(block);
  range.setEnd(node, offset);
  return extractNodePlainText(range.cloneContents()).length;
}

function resolveRootBoundaryPoint(root: HTMLElement, offset: number): BlockPoint | null {
  const childNodes = Array.from(root.childNodes);
  const clampedOffset = Math.max(0, Math.min(offset, childNodes.length));

  for (let index = clampedOffset; index < childNodes.length; index += 1) {
    const node = childNodes[index];
    if (node?.nodeType === Node.ELEMENT_NODE && node.parentNode === root) {
      const block = node as HTMLElement;
      return { blockId: getRequiredBlockId(block), offset: 0 };
    }
  }

  for (let index = clampedOffset - 1; index >= 0; index -= 1) {
    const node = childNodes[index];
    if (node?.nodeType === Node.ELEMENT_NODE && node.parentNode === root) {
      const block = node as HTMLElement;
      return {
        blockId: getRequiredBlockId(block),
        offset: extractNodePlainText(block).length,
      };
    }
  }

  return null;
}

function resolvePoint(root: HTMLElement, node: Node | null, offset: number): BlockPoint | null {
  if (!node) {
    return null;
  }

  if (node === root) {
    return resolveRootBoundaryPoint(root, offset);
  }

  const block = getTopLevelBlock(root, node);
  if (!block) {
    return null;
  }

  return {
    blockId: getRequiredBlockId(block),
    offset: getOffsetWithinBlock(block, node, offset),
  };
}

export function getLogicalSelection(root: HTMLElement): BlockRange | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const anchor = resolvePoint(root, selection.anchorNode, selection.anchorOffset);
  const focus = resolvePoint(root, selection.focusNode, selection.focusOffset);
  if (!anchor || !focus) {
    return null;
  }

  const blocks = Array.from(root.children) as HTMLElement[];
  const blockIndex = (point: BlockPoint) =>
    blocks.findIndex((block) => block.dataset.blockId === point.blockId);
  const anchorIndex = blockIndex(anchor);
  const focusIndex = blockIndex(focus);

  const startFirst =
    anchorIndex < focusIndex ||
    (anchorIndex === focusIndex && anchor.offset <= focus.offset);

  return startFirst
    ? { start: anchor, end: focus, isCollapsed: selection.isCollapsed }
    : { start: focus, end: anchor, isCollapsed: selection.isCollapsed };
}

function resolveNodeAtOffset(block: HTMLElement, targetOffset: number): { node: Node; offset: number } {
  const walker = document.createTreeWalker(
    block,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    {
      acceptNode(node) {
        if (node.nodeType === Node.TEXT_NODE) {
          return NodeFilter.FILTER_ACCEPT;
        }
        if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName === "BR") {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_SKIP;
      },
    },
  );

  let consumed = 0;
  let current = walker.nextNode();
  while (current) {
    const length =
      current.nodeType === Node.TEXT_NODE
        ? current.textContent?.length ?? 0
        : (current as HTMLElement).tagName === "BR"
          ? 1
          : 0;

    if (targetOffset <= consumed + length) {
      if (current.nodeType === Node.TEXT_NODE) {
        return { node: current, offset: targetOffset - consumed };
      }

      const br = current as HTMLElement;
      const parent = br.parentNode ?? block;
      const brIndex = Array.prototype.indexOf.call(parent.childNodes, br);
      return { node: parent, offset: targetOffset - consumed === 0 ? brIndex : brIndex + 1 };
    }

    consumed += length;
    current = walker.nextNode();
  }

  return { node: block, offset: block.childNodes.length };
}

export function restoreLogicalSelection(root: HTMLElement, range: BlockRange): void {
  const selection = window.getSelection();
  if (!selection) {
    return;
  }

  const blocks = Array.from(root.children) as HTMLElement[];
  const findBlock = (id: string) => blocks.find((block) => block.dataset.blockId === id);

  const startBlock = findBlock(range.start.blockId);
  const endBlock = findBlock(range.end.blockId);
  if (!startBlock || !endBlock) {
    return;
  }

  const start = resolveNodeAtOffset(startBlock, range.start.offset);
  const end = resolveNodeAtOffset(endBlock, range.end.offset);

  const domRange = document.createRange();
  domRange.setStart(start.node, start.offset);
  domRange.setEnd(end.node, end.offset);

  selection.removeAllRanges();
  selection.addRange(domRange);
}

export { extractRootPlainText };
