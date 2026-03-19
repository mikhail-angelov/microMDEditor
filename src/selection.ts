// Selection utilities for logical selection handling
// Provides higher-level APIs for working with selection in contentEditable elements

import { getCaretOffset, placeCaretAtOffset } from './utils';

export type LogicalSelectionSnapshot = {
  start: number;
  end: number;
  isCollapsed: boolean;
  isInsideRoot: boolean;
};

/**
 * Get logical selection offsets from a root element
 * Returns a snapshot of the current selection in plain-text coordinates
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
  
  // Check if selection is inside the root element
  const isInsideRoot = root.contains(range.commonAncestorContainer);
  
  if (!isInsideRoot) {
    return {
      start: 0,
      end: 0,
      isCollapsed: true,
      isInsideRoot: false,
    };
  }

  const start = getCaretOffset(root, sel);
  const isCollapsed = sel.isCollapsed;
  const end = isCollapsed ? start : getCaretOffset(root, sel, false);

  return {
    start,
    end,
    isCollapsed,
    isInsideRoot: true,
  };
}

/**
 * Restore selection offsets to a root element
 * Places caret at the specified logical offsets
 */
export function restoreSelectionOffsets(root: HTMLElement, start: number, end?: number): void {
  const textLength = root.textContent?.length || 0;
  const clampedStart = Math.max(0, Math.min(start, textLength));
  const clampedEnd = end !== undefined 
    ? Math.max(0, Math.min(end, textLength))
    : clampedStart;

  if (clampedStart === clampedEnd) {
    // Collapsed selection
    placeCaretAtOffset(root, clampedStart);
  } else {
    // Range selection - we need to implement range selection placement
    // For now, fall back to collapsed at start
    // TODO: Implement proper range selection restoration
    placeCaretAtOffset(root, clampedStart);
  }
}

/**
 * Check if caret is at the start of the root element
 */
export function isCaretAtStart(root: HTMLElement): boolean {
  const snapshot = getSelectionOffsets(root);
  return snapshot.isInsideRoot && snapshot.isCollapsed && snapshot.start === 0;
}

/**
 * Check if caret is at the end of the root element
 */
export function isCaretAtEnd(root: HTMLElement): boolean {
  const textLength = root.textContent?.length || 0;
  const snapshot = getSelectionOffsets(root);
  return snapshot.isInsideRoot && snapshot.isCollapsed && snapshot.start === textLength;
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