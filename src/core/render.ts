import type { RenderableBlock } from "./types";

const EDITOR_ROOT_SELECTOR = '[data-mmd-editor-root="true"]';

function createBlockElement(block: RenderableBlock): HTMLDivElement {
  const node = document.createElement("div");
  node.setAttribute("data-block-id", block.id);
  node.setAttribute("data-block-type", block.type);
  node.textContent = block.raw;
  return node;
}

function isOwnedEditorRoot(node: Element): node is HTMLElement {
  return (
    node instanceof HTMLElement &&
    node.matches(EDITOR_ROOT_SELECTOR)
  );
}

export function ensureEditableRoot(host: HTMLElement): HTMLElement {
  const existingRoot = Array.from(host.children).find((child) => isOwnedEditorRoot(child));
  const root = existingRoot ?? document.createElement("div");

  root.setAttribute("data-mmd-editor-root", "true");
  root.setAttribute("contenteditable", "true");
  host.replaceChildren(root);
  return root;
}

export function renderBlocks(root: HTMLElement, blocks: RenderableBlock[]): void {
  root.replaceChildren(...blocks.map((block) => createBlockElement(block)));
}
