import { parseMarkdownToBlocks, serializeBlocksToMarkdown } from "./markdown";
import { extractNodePlainText } from "./dom-text";
import { replaceSelectionWithMarkdown } from "./paste";
import { ensureEditableRoot, renderBlocks } from "./render";
import { getLogicalSelection, restoreLogicalSelection } from "./selection";
import type { Block, RenderableBlock } from "./types";

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
  return Array.from(root.children).flatMap((child, childIndex) => {
    if (!(child instanceof HTMLElement)) {
      return [];
    }

    const raw = extractNodePlainText(child);
    const domBlockId = child.dataset.blockId ?? `dom-${childIndex}`;
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

export function createEditorCore(host: HTMLElement, options: EditorCoreOptions): EditorCore {
  const root = ensureEditableRoot(host);
  let currentOptions = options;

  const handleInput = () => {
    const markdown = serializeBlocksToMarkdown(readBlocksFromDom(root));
    currentOptions.onChange?.(markdown);
  };

  const handlePaste = (event: ClipboardEvent) => {
    const pasted = event.clipboardData?.getData("text/plain");
    if (!pasted) {
      return;
    }

    event.preventDefault();

    const selection = getLogicalSelection(root);
    if (!selection) {
      return;
    }

    const next = replaceSelectionWithMarkdown(readBlocksFromDom(root), selection, pasted);
    renderBlocks(root, next.blocks);
    restoreLogicalSelection(root, { start: next.caret, end: next.caret, isCollapsed: true });
    currentOptions.onChange?.(next.markdown);
  };

  root.addEventListener("input", handleInput);
  root.addEventListener("paste", handlePaste);
  renderMarkdown(root, currentOptions.initialMarkdown);

  return {
    root,
    update(nextOptions) {
      if (nextOptions.initialMarkdown !== currentOptions.initialMarkdown) {
        renderMarkdown(root, nextOptions.initialMarkdown);
      }
      currentOptions = nextOptions;
    },
    destroy() {
      root.removeEventListener("input", handleInput);
      root.removeEventListener("paste", handlePaste);
      if (root.parentElement) {
        root.remove();
      }
    },
  };
}
