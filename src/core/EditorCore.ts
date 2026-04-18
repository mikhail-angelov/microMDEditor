import { generateId } from "./id";
import { parseMarkdownToBlocks, serializeBlocksToMarkdown } from "./markdown";
import { extractNodePlainText } from "./dom-text";
import { replaceSelectionWithMarkdown } from "./paste";
import { ensureEditableRoot, renderBlocks } from "./render";
import { getLogicalSelection, restoreLogicalSelection } from "./selection";
import { applyEnter, applyBackspace, applyDelete } from "./keyboard";
import type { Block, BlockRange, RenderableBlock } from "./types";

export type EditorCoreOptions = {
  initialMarkdown: string;
  onChange?: (markdown: string) => void;
};

export type EditorCore = {
  root: HTMLElement;
  update: (options: EditorCoreOptions) => void;
  destroy: () => void;
};

function readBlocksFromDom(root: HTMLElement): Block[] {
  return Array.from(root.children).flatMap((child) => {
    if (!(child instanceof HTMLElement)) {
      return [];
    }

    const raw = extractNodePlainText(child);
    const domBlockId = child.dataset.blockId ?? generateId();
    return parseMarkdownToBlocks(raw).map((block, blockIndex) => ({
      ...block,
      id: blockIndex === 0 ? domBlockId : `${domBlockId}-${blockIndex}`,
    }));
  });
}

function renderMarkdown(root: HTMLElement, markdown: string): void {
  const blocks: RenderableBlock[] = parseMarkdownToBlocks(markdown);
  renderBlocks(root, blocks);
}

function safeGetLogicalSelection(root: HTMLElement): BlockRange | null {
  try {
    return getLogicalSelection(root);
  } catch {
    return null;
  }
}

export function createEditorCore(host: HTMLElement, options: EditorCoreOptions): EditorCore {
  const root = ensureEditableRoot(host);
  let currentOptions = options;
  // Tracks the live markdown content so update() can distinguish external
  // programmatic changes from the parent echoing back onChange output.
  let currentMarkdown = options.initialMarkdown;

  const handleInput = () => {
    const logicalSel = safeGetLogicalSelection(root);

    if (logicalSel) {
      const editedEl = Array.from(root.children).find(
        (el) => (el as HTMLElement).dataset.blockId === logicalSel.start.blockId,
      ) as HTMLElement | undefined;

      if (editedEl) {
        const raw = extractNodePlainText(editedEl);
        const reparsed = parseMarkdownToBlocks(raw);
        if (reparsed.length === 1 && reparsed[0].type !== editedEl.dataset.blockType) {
          editedEl.dataset.blockType = reparsed[0].type;
        }
      }
    }

    const markdown = serializeBlocksToMarkdown(readBlocksFromDom(root));
    currentMarkdown = markdown;
    currentOptions.onChange?.(markdown);
  };

  const handlePaste = (event: ClipboardEvent) => {
    const pasted = event.clipboardData?.getData("text/plain");
    if (!pasted) return;
    event.preventDefault();

    const blocks = readBlocksFromDom(root);
    let selection = safeGetLogicalSelection(root);

    if (!selection) {
      const last = blocks[blocks.length - 1];
      if (!last) return;
      selection = {
        start: { blockId: last.id, offset: last.raw.length },
        end: { blockId: last.id, offset: last.raw.length },
        isCollapsed: true,
      };
    }

    let next;
    try {
      next = replaceSelectionWithMarkdown(blocks, selection, pasted);
    } catch {
      return;
    }

    renderBlocks(root, next.blocks);
    currentMarkdown = next.markdown;
    restoreLogicalSelection(root, { start: next.caret, end: next.caret, isCollapsed: true });
    currentOptions.onChange?.(next.markdown);
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Enter" && event.key !== "Backspace" && event.key !== "Delete") return;

    const selection = safeGetLogicalSelection(root);
    if (!selection) return;

    // For Enter with a non-collapsed selection, collapse to the end (focus) so
    // the split happens where the cursor visually is, not where the selection started.
    const effectiveSelection =
      event.key === "Enter" && !selection.isCollapsed
        ? { start: selection.end, end: selection.end, isCollapsed: true as const }
        : selection;

    const blocks = readBlocksFromDom(root);
    const result =
      event.key === "Enter"
        ? applyEnter(blocks, effectiveSelection)
        : event.key === "Backspace"
          ? applyBackspace(blocks, selection)
          : applyDelete(blocks, selection);

    if (!result) return;

    event.preventDefault();
    renderBlocks(root, result.blocks);
    currentMarkdown = result.markdown;
    restoreLogicalSelection(root, { start: result.caret, end: result.caret, isCollapsed: true });
    currentOptions.onChange?.(result.markdown);
  };

  root.addEventListener("input", handleInput);
  root.addEventListener("paste", handlePaste);
  root.addEventListener("keydown", handleKeyDown);
  renderMarkdown(root, currentMarkdown);

  return {
    root,
    update(nextOptions) {
      // Only re-render when the incoming markdown differs from what we have
      // internally — prevents echoed onChange values from clobbering the DOM.
      if (nextOptions.initialMarkdown !== currentMarkdown) {
        currentMarkdown = nextOptions.initialMarkdown;
        renderMarkdown(root, nextOptions.initialMarkdown);
      }
      currentOptions = nextOptions;
    },
    destroy() {
      root.removeEventListener("input", handleInput);
      root.removeEventListener("paste", handlePaste);
      root.removeEventListener("keydown", handleKeyDown);
      if (root.parentElement) {
        root.remove();
      }
    },
  };
}
