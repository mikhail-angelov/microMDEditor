// Selection utilities for logical selection handling
// Works in plain-text coordinates for the raw contentEditable layer.

import type { BlockPoint, BlockRange, RegisteredBlockRoot } from './types';
import { placeCaretAtOffset } from './utils';

export type LogicalSelectionSnapshot = {
  start: number;
  end: number;
  isCollapsed: boolean;
  isInsideRoot: boolean;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

function nodeOffsetWithinRoot(root: HTMLElement, targetNode: Node, targetOffset: number): number {
  if (targetNode.nodeType === Node.TEXT_NODE) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    let currentOffset = 0;
    let node: Text | null = null;

    while ((node = walker.nextNode() as Text | null)) {
      const nodeLength = node.textContent?.length || 0;
      if (node === targetNode) {
        return currentOffset + targetOffset;
      }
      currentOffset += nodeLength;
    }

    return currentOffset;
  }

  const range = document.createRange();
  range.selectNodeContents(root);
  range.setEnd(targetNode, targetOffset);
  return range.toString().length;
}

function isNodeInsideRoot(root: HTMLElement, node: Node | null): boolean {
  return !!node && (node === root || root.contains(node));
}

function isSelectionInsideRoot(root: HTMLElement, selection: Selection): boolean {
  return isNodeInsideRoot(root, selection.anchorNode) && isNodeInsideRoot(root, selection.focusNode);
}

function findRegisteredRoot(
  editorRoot: HTMLElement,
  node: Node | null,
  rootByElement: Map<HTMLElement, RegisteredBlockRoot>
): RegisteredBlockRoot | null {
  let current: Node | null = node;

  while (current && current !== editorRoot) {
    if (current.nodeType === Node.ELEMENT_NODE) {
      const match = rootByElement.get(current as HTMLElement);
      if (match) {
        return match;
      }
    }
    current = current.parentNode;
  }

  return null;
}

function resolveBlockPoint(
  root: RegisteredBlockRoot,
  node: Node,
  offset: number
): BlockPoint {
  return {
    blockId: root.id,
    offset: nodeOffsetWithinRoot(root.element, node, offset),
  };
}

function resolveRootBoundaryPoint(
  editorRoot: HTMLElement,
  roots: RegisteredBlockRoot[],
  boundaryOffset: number,
  rootByElement: Map<HTMLElement, RegisteredBlockRoot>
): BlockPoint | null {
  if (roots.length === 0) {
    return null;
  }

  const childCount = editorRoot.childNodes.length;
  const first = roots[0];
  const last = roots[roots.length - 1];

  if (boundaryOffset <= 0) {
    return { blockId: first.id, offset: 0 };
  }

  if (boundaryOffset >= childCount) {
    return { blockId: last.id, offset: last.element.textContent?.length || 0 };
  }

  let lastSeenRoot: RegisteredBlockRoot | null = null;

  for (let index = 0; index < editorRoot.childNodes.length; index += 1) {
    const child = editorRoot.childNodes[index];
    if (child.nodeType === Node.ELEMENT_NODE) {
      const match = rootByElement.get(child as HTMLElement);
      if (match) {
        if (index >= boundaryOffset) {
          return { blockId: match.id, offset: 0 };
        }
        lastSeenRoot = match;
      }
    }
  }

  if (lastSeenRoot) {
    return {
      blockId: lastSeenRoot.id,
      offset: lastSeenRoot.element.textContent?.length || 0,
    };
  }

  return { blockId: last.id, offset: last.element.textContent?.length || 0 };
}

function resolveSelectionPoint(
  editorRoot: HTMLElement,
  roots: RegisteredBlockRoot[],
  node: Node,
  offset: number,
  rootByElement: Map<HTMLElement, RegisteredBlockRoot>
): BlockPoint | null {
  if (node === editorRoot) {
    return resolveRootBoundaryPoint(editorRoot, roots, offset, rootByElement);
  }

  const root = findRegisteredRoot(editorRoot, node, rootByElement);
  if (!root) {
    return null;
  }

  return resolveBlockPoint(root, node, offset);
}

function isForwardSelection(
  anchorRoot: RegisteredBlockRoot,
  focusRoot: RegisteredBlockRoot,
  anchorOffset: number,
  focusOffset: number,
  rootOrder: Map<HTMLElement, number>
): boolean {
  const anchorIndex = rootOrder.get(anchorRoot.element);
  const focusIndex = rootOrder.get(focusRoot.element);

  if (anchorIndex === undefined || focusIndex === undefined) {
    return true;
  }

  if (anchorIndex !== focusIndex) {
    return anchorIndex < focusIndex;
  }

  return anchorOffset <= focusOffset;
}

function resolveTextPosition(root: HTMLElement, offset: number): { node: Node; offset: number } {
  const textLength = root.textContent?.length || 0;
  const clampedOffset = clamp(offset, 0, textLength);

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let currentOffset = 0;
  let node: Text | null = null;

  while ((node = walker.nextNode() as Text | null)) {
    const nodeLength = node.textContent?.length || 0;
    if (currentOffset + nodeLength >= clampedOffset) {
      return { node, offset: clampedOffset - currentOffset };
    }
    currentOffset += nodeLength;
  }

  // Fallbacks for empty roots or roots with no text nodes.
  if (root.lastChild) {
    if (root.lastChild.nodeType === Node.TEXT_NODE) {
      const text = root.lastChild.textContent || '';
      return { node: root.lastChild, offset: text.length };
    }
    return { node: root, offset: root.childNodes.length };
  }

  return { node: root, offset: 0 };
}

/**
 * Get logical selection offsets from a root element.
 * Returns plain-text offsets for start and end regardless of DOM node structure.
 */
export function getSelectionOffsets(root: HTMLElement): LogicalSelectionSnapshot {
  const sel = window.getSelection();

  if (!sel || sel.rangeCount === 0) {
    return {
      start: 0,
      end: 0,
      isCollapsed: true,
      isInsideRoot: false,
    };
  }

  const range = sel.getRangeAt(0);
  const anchorNode = sel.anchorNode;
  const focusNode = sel.focusNode;

  if (!isNodeInsideRoot(root, anchorNode) || !isNodeInsideRoot(root, focusNode)) {
    return {
      start: 0,
      end: 0,
      isCollapsed: true,
      isInsideRoot: false,
    };
  }

  const start = nodeOffsetWithinRoot(root, range.startContainer, range.startOffset);
  const end = nodeOffsetWithinRoot(root, range.endContainer, range.endOffset);

  return {
    start,
    end,
    isCollapsed: range.collapsed,
    isInsideRoot: true,
  };
}

/**
 * Restore selection offsets to a root element.
 * Supports both collapsed and range selections.
 */
export function restoreSelectionOffsets(root: HTMLElement, start: number, end?: number): void {
  const sel = window.getSelection();
  if (!sel) return;

  const textLength = root.textContent?.length || 0;
  const clampedStart = clamp(start, 0, textLength);
  const clampedEnd = clamp(end ?? start, 0, textLength);

  if (clampedStart === clampedEnd) {
    placeCaretAtOffset(root, clampedStart);
    return;
  }

  const startPos = resolveTextPosition(root, clampedStart);
  const endPos = resolveTextPosition(root, clampedEnd);
  const range = document.createRange();

  range.setStart(startPos.node, startPos.offset);
  range.setEnd(endPos.node, endPos.offset);

  sel.removeAllRanges();
  sel.addRange(range);
}

/** Check if the current collapsed caret is at the start of the root element. */
export function isCaretAtStart(root: HTMLElement): boolean {
  const snapshot = getSelectionOffsets(root);
  return snapshot.isInsideRoot && snapshot.isCollapsed && snapshot.start === 0;
}

/** Check if the current collapsed caret is at the end of the root element. */
export function isCaretAtEnd(root: HTMLElement): boolean {
  const snapshot = getSelectionOffsets(root);
  const textLength = root.textContent?.length || 0;
  return snapshot.isInsideRoot && snapshot.isCollapsed && snapshot.end === textLength;
}

/**
 * Type for selection transformation functions
 * Maps old selection offsets to new selection offsets after text transformation
 */
export type SelectionTransform = (oldStart: number, oldEnd: number) => { start: number; end: number };

/**
 * Create a simple delta-based selection transform
 * Useful for normalization operations that shift text by a fixed amount
 */
export function createDeltaTransform(delta: number): SelectionTransform {
  return (oldStart: number, oldEnd: number) => ({
    start: Math.max(0, oldStart + delta),
    end: Math.max(0, oldEnd + delta),
  });
}

/**
 * Apply text mutation with selection preservation
 * Handles the common pattern of:
 * 1. Snapshot current selection
 * 2. Apply text change
 * 3. Restore selection using transform
 */
export function applyTextMutation(
  root: HTMLElement,
  nextText: string,
  mapSelection: SelectionTransform
): void {
  const snapshot = getSelectionOffsets(root);
  
  // Only update text if it changed
  if (root.textContent !== nextText) {
    root.textContent = nextText;
  }
  
  // Restore selection if it was inside the root
  if (snapshot.isInsideRoot) {
    const newSelection = mapSelection(snapshot.start, snapshot.end);
    restoreSelectionOffsets(root, newSelection.start, newSelection.end);
  }
}

export function getEditorSelectionRange(
  editorRoot: HTMLElement,
  roots: RegisteredBlockRoot[]
): BlockRange | null {
  const selection = window.getSelection();

  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  if (!isSelectionInsideRoot(editorRoot, selection)) {
    return null;
  }

  if (!selection.anchorNode || !selection.focusNode) {
    return null;
  }

  const rootByElement = new Map<HTMLElement, RegisteredBlockRoot>(
    roots.map((root) => [root.element, root])
  );
  const rootOrder = new Map<HTMLElement, number>(
    roots.map((root, index) => [root.element, index])
  );
  const rootById = new Map<string, RegisteredBlockRoot>(
    roots.map((root) => [root.id, root])
  );

  const anchorPoint = resolveSelectionPoint(
    editorRoot,
    roots,
    selection.anchorNode,
    selection.anchorOffset,
    rootByElement
  );
  const focusPoint = resolveSelectionPoint(
    editorRoot,
    roots,
    selection.focusNode,
    selection.focusOffset,
    rootByElement
  );

  if (!anchorPoint || !focusPoint) {
    return null;
  }

  const anchorRoot = rootById.get(anchorPoint.blockId);
  const focusRoot = rootById.get(focusPoint.blockId);

  if (!anchorRoot || !focusRoot) {
    return null;
  }

  const forward = isForwardSelection(
    anchorRoot,
    focusRoot,
    anchorPoint.offset,
    focusPoint.offset,
    rootOrder
  );

  const start = forward ? anchorPoint : focusPoint;
  const end = forward ? focusPoint : anchorPoint;

  return {
    start,
    end,
    isCollapsed: start.blockId === end.blockId && start.offset === end.offset,
  };
}
