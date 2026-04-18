import type { RenderableBlock } from "./types";

const EDITOR_ROOT_SELECTOR = '[data-mmd-editor-root="true"]';

const HEADING_SIZES: Record<number, string> = {
  1: "2em",
  2: "1.5em",
  3: "1.25em",
  4: "1.1em",
  5: "1em",
  6: "0.875em",
};

function applyBlockStyles(node: HTMLDivElement, block: RenderableBlock): void {
  const s = node.style;
  s.whiteSpace = "pre-wrap";
  s.wordBreak = "break-word";
  s.minHeight = "1.2em";
  s.margin = "0";
  s.padding = "0";

  switch (block.type) {
    case "heading": {
      const level = block.meta?.level ?? 1;
      s.fontWeight = "700";
      s.fontSize = HEADING_SIZES[level] ?? "1em";
      s.lineHeight = "1.2";
      s.margin = "0.5em 0 0.25em";
      break;
    }
    case "blockquote":
      s.borderLeft = "3px solid #d0d7de";
      s.paddingLeft = "12px";
      s.color = "#57606a";
      break;
    case "code-fence":
      s.fontFamily = "ui-monospace, SFMono-Regular, Consolas, monospace";
      s.background = "rgba(0,0,0,0.04)";
      s.borderRadius = "4px";
      s.padding = "8px 12px";
      s.fontSize = "0.875em";
      break;
    case "unordered-list":
    case "ordered-list":
    case "task-list":
      s.paddingLeft = "1.25rem";
      break;
    case "horizontal-rule":
      s.opacity = "0.4";
      break;
    default:
      break;
  }
}

function createBlockElement(block: RenderableBlock): HTMLDivElement {
  const node = document.createElement("div");
  node.setAttribute("data-block-id", block.id);
  node.setAttribute("data-block-type", block.type);
  node.textContent = block.raw;
  applyBlockStyles(node, block);
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
  const s = (root as HTMLElement).style;
  s.outline = "none";
  s.cursor = "text";
  s.fontFamily = "inherit";
  s.fontSize = "inherit";
  s.lineHeight = "1.6";
  s.padding = "8px";
  host.replaceChildren(root);
  return root;
}

export function renderBlocks(root: HTMLElement, blocks: RenderableBlock[]): void {
  // Collect existing elements by block ID so we can reuse them.
  // Reusing the same DOM node keeps the browser's cursor anchor intact
  // (important for code fences and any block that stays in place after an edit).
  const existingById = new Map<string, HTMLDivElement>();
  for (const child of root.children) {
    if (child instanceof HTMLDivElement && child.dataset.blockId) {
      existingById.set(child.dataset.blockId, child);
    }
  }

  const newChildren = blocks.map((block) => {
    const existing = existingById.get(block.id);
    if (existing) {
      if (existing.dataset.blockType !== block.type) {
        existing.dataset.blockType = block.type;
      }
      if (existing.textContent !== block.raw) {
        existing.textContent = block.raw;
      }
      applyBlockStyles(existing, block);
      return existing;
    }
    return createBlockElement(block);
  });

  root.replaceChildren(...newChildren);
}
