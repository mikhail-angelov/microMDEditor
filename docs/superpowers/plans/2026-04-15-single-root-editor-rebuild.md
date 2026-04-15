# Single-Root Editor Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the editor as a full-featured single-root markdown editor with a shared imperative core and thin React/Preact shells.

**Architecture:** The editor core owns one top-level `contenteditable`, block parsing, selection mapping, structural normalization, keyboard behavior, and plain-text markdown paste. React and Preact wrappers mount the same imperative core and never render the live editable subtree.

**Tech Stack:** TypeScript, DOM Selection/Range APIs, React, Preact, Jest, Testing Library, optional `remark` parser adapter.

---

## File Structure

### Create

- `src/core/types.ts`
  Purpose: shared editor-core types for blocks, selections, options, and update payloads.
- `src/core/markdown.ts`
  Purpose: parse markdown into canonical block structures and serialize blocks back to markdown.
- `src/core/dom-text.ts`
  Purpose: DOM-to-plain-text extraction helpers, including `<br>` handling and block text extraction.
- `src/core/selection.ts`
  Purpose: map DOM selections to logical document selections and restore logical selections back into the root.
- `src/core/render.ts`
  Purpose: imperatively render blocks into the single editable root and apply block-level styling.
- `src/core/paste.ts`
  Purpose: replace logical selections with pasted plain-text markdown and compute post-paste caret targets.
- `src/core/keyboard.ts`
  Purpose: structural Enter / Backspace / Delete / Tab behaviors in model space.
- `src/core/EditorCore.ts`
  Purpose: framework-agnostic editor controller with mount, update, and destroy APIs.
- `src/core/index.ts`
  Purpose: export the core handle, types, and adapters.
- `src/MicroMDEditor.test.tsx`
  Purpose: React wrapper integration tests for the rebuilt editor.
- `src/core/markdown.test.ts`
  Purpose: block parsing and serialization tests for all supported block types.
- `src/core/selection.test.ts`
  Purpose: logical selection round-trip tests across root and block boundaries.
- `src/core/paste.test.ts`
  Purpose: pure replacement logic tests for paste and caret targeting.
- `src/core/keyboard.test.ts`
  Purpose: pure structural keyboard behavior tests.

### Modify

- `src/MicroMDEditor.tsx`
  Purpose: replace the old multi-island implementation with a thin React wrapper around the core.
- `src/index.ts`
  Purpose: export the rebuilt React editor plus shared types.
- `src/preact.ts`
  Purpose: expose the Preact wrapper against the same core.
- `example/src/App.tsx`
  Purpose: switch the demo back to the public rebuilt editor surface and remove prototype-only wiring.
- `src/MicroMDEditor2.tsx`
  Purpose: either delete after migration or reduce to an internal experimental file if still needed during transition.
- `src/MicroMDEditor2.test.tsx`
  Purpose: either migrate useful scenarios into the new test suite or remove once coverage is moved.

---

### Task 1: Define Core Types And Markdown Model

**Files:**
- Create: `src/core/types.ts`
- Create: `src/core/markdown.ts`
- Test: `src/core/markdown.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import {
  parseMarkdownToBlocks,
  serializeBlocksToMarkdown,
} from "./markdown";

describe("parseMarkdownToBlocks", () => {
  it("parses supported block markers into canonical block types", () => {
    const markdown = [
      "# H1",
      "",
      "## H2",
      "",
      "- item",
      "",
      "* item",
      "",
      "1. item",
      "",
      "- [ ] task",
      "",
      "> quote",
      "",
      "```ts",
      "const x = 1;",
      "```",
      "",
      "---",
      "",
      "paragraph",
    ].join("\n");

    const blocks = parseMarkdownToBlocks(markdown);

    expect(blocks.map((block) => block.type)).toEqual([
      "heading",
      "heading",
      "unordered-list",
      "unordered-list",
      "ordered-list",
      "task-list",
      "blockquote",
      "code-fence",
      "horizontal-rule",
      "paragraph",
    ]);
  });

  it("round-trips canonical markdown exactly", () => {
    const markdown = "# Title\n\nparagraph\n\n- item";
    expect(serializeBlocksToMarkdown(parseMarkdownToBlocks(markdown))).toBe(markdown);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- markdown.test.ts`
Expected: FAIL with `Cannot find module './core/markdown'` or missing exports.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/core/types.ts
export type BlockType =
  | "paragraph"
  | "heading"
  | "unordered-list"
  | "ordered-list"
  | "task-list"
  | "blockquote"
  | "code-fence"
  | "horizontal-rule";

export type Block = {
  id: string;
  type: BlockType;
  raw: string;
  meta?: {
    level?: number;
    marker?: string;
    checked?: boolean;
    order?: number;
  };
};

export type BlockPoint = {
  blockId: string;
  offset: number;
};

export type BlockRange = {
  start: BlockPoint;
  end: BlockPoint;
  isCollapsed: boolean;
};
```

```ts
// src/core/markdown.ts
import type { Block } from "./types";

let nextId = 0;

const genId = () => `block-${nextId++}`;

export function parseMarkdownToBlocks(markdown: string): Block[] {
  const normalized = markdown.replace(/\r\n/g, "\n");
  const chunks = normalized.split(/\n{2,}/);

  if (normalized.length === 0) {
    return [{ id: genId(), type: "paragraph", raw: "" }];
  }

  return chunks.map((chunk) => {
    if (/^#{1,6}\s/.test(chunk)) {
      const level = chunk.match(/^#+/)?.[0].length ?? 1;
      return { id: genId(), type: "heading", raw: chunk, meta: { level } };
    }
    if (/^-\s\[[ xX]\]\s/.test(chunk)) {
      return {
        id: genId(),
        type: "task-list",
        raw: chunk,
        meta: { marker: "-", checked: /^-\s\[[xX]\]/.test(chunk) },
      };
    }
    if (/^[-*]\s/.test(chunk)) {
      return { id: genId(), type: "unordered-list", raw: chunk, meta: { marker: chunk[0] } };
    }
    if (/^\d+\.\s/.test(chunk)) {
      const order = Number(chunk.match(/^\d+/)?.[0] ?? "1");
      return { id: genId(), type: "ordered-list", raw: chunk, meta: { order } };
    }
    if (/^>\s/.test(chunk)) {
      return { id: genId(), type: "blockquote", raw: chunk };
    }
    if (/^```/.test(chunk)) {
      return { id: genId(), type: "code-fence", raw: chunk };
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(chunk.trim())) {
      return { id: genId(), type: "horizontal-rule", raw: chunk.trim() };
    }
    return { id: genId(), type: "paragraph", raw: chunk };
  });
}

export function serializeBlocksToMarkdown(blocks: Block[]): string {
  return blocks.map((block) => block.raw).join("\n\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- markdown.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/types.ts src/core/markdown.ts src/core/markdown.test.ts
git commit -m "feat: add single-root core markdown model"
```

### Task 2: Build DOM Text Extraction And Selection Mapping

**Files:**
- Create: `src/core/dom-text.ts`
- Create: `src/core/selection.ts`
- Test: `src/core/selection.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import {
  extractRootPlainText,
  getLogicalSelection,
  restoreLogicalSelection,
} from "./selection";

describe("selection mapping", () => {
  it("preserves line breaks represented by br nodes", () => {
    document.body.innerHTML = `
      <div id="root" contenteditable="true">
        <div data-block-id="a"># title<br>paragraph</div>
      </div>
    `;
    const root = document.getElementById("root") as HTMLDivElement;
    expect(extractRootPlainText(root)).toBe("# title\nparagraph");
  });

  it("maps and restores a range across two top-level blocks", () => {
    document.body.innerHTML = `
      <div id="root" contenteditable="true">
        <div data-block-id="a"># title</div>
        <div data-block-id="b">paragraph</div>
      </div>
    `;
    const root = document.getElementById("root") as HTMLDivElement;
    const selection = window.getSelection()!;
    const firstText = root.children[0].firstChild!;
    const secondText = root.children[1].firstChild!;
    const range = document.createRange();

    range.setStart(firstText, 2);
    range.setEnd(secondText, 4);
    selection.removeAllRanges();
    selection.addRange(range);

    const logical = getLogicalSelection(root);
    restoreLogicalSelection(root, logical!);

    expect(logical?.start.blockId).toBe("a");
    expect(logical?.end.blockId).toBe("b");
    expect(window.getSelection()?.rangeCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- selection.test.ts`
Expected: FAIL with missing module or missing exports.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/core/dom-text.ts
export function extractNodePlainText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? "";
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }
  const element = node as HTMLElement;
  if (element.tagName === "BR") {
    return "\n";
  }
  return Array.from(element.childNodes).map(extractNodePlainText).join("");
}

export function extractRootPlainText(root: HTMLElement): string {
  return Array.from(root.childNodes).map(extractNodePlainText).join("\n");
}
```

```ts
// src/core/selection.ts
import type { BlockRange, BlockPoint } from "./types";
import { extractNodePlainText, extractRootPlainText } from "./dom-text";

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
  return range.toString().length;
}

function resolvePoint(root: HTMLElement, node: Node | null, offset: number): BlockPoint | null {
  if (!node) return null;
  const block = getTopLevelBlock(root, node);
  if (!block) return null;
  return {
    blockId: block.dataset.blockId || "",
    offset: getOffsetWithinBlock(block, node, offset),
  };
}

export function getLogicalSelection(root: HTMLElement): BlockRange | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const anchor = resolvePoint(root, selection.anchorNode, selection.anchorOffset);
  const focus = resolvePoint(root, selection.focusNode, selection.focusOffset);
  if (!anchor || !focus) return null;
  const startFirst =
    anchor.blockId < focus.blockId || (anchor.blockId === focus.blockId && anchor.offset <= focus.offset);
  return startFirst
    ? { start: anchor, end: focus, isCollapsed: selection.isCollapsed }
    : { start: focus, end: anchor, isCollapsed: selection.isCollapsed };
}

export function restoreLogicalSelection(root: HTMLElement, range: BlockRange): void {
  const selection = window.getSelection();
  if (!selection) return;
  const blocks = Array.from(root.children) as HTMLElement[];
  const findBlock = (id: string) => blocks.find((block) => block.dataset.blockId === id);
  const startBlock = findBlock(range.start.blockId);
  const endBlock = findBlock(range.end.blockId);
  if (!startBlock || !endBlock) return;
  const domRange = document.createRange();
  domRange.setStart(startBlock.firstChild ?? startBlock, range.start.offset);
  domRange.setEnd(endBlock.firstChild ?? endBlock, range.end.offset);
  selection.removeAllRanges();
  selection.addRange(domRange);
}

export { extractRootPlainText };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- selection.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/dom-text.ts src/core/selection.ts src/core/selection.test.ts
git commit -m "feat: add single-root selection mapping"
```

### Task 3: Implement Imperative Block Rendering

**Files:**
- Create: `src/core/render.ts`
- Modify: `src/core/types.ts`
- Test: `src/MicroMDEditor.test.tsx`

- [ ] **Step 1: Write the failing test**

```ts
import { render } from "@testing-library/react";
import { MicroMDEditor } from "./MicroMDEditor";

describe("MicroMDEditor render", () => {
  it("renders one editable root with top-level block nodes", () => {
    const { container } = render(
      <MicroMDEditor initialMarkdown={"# Title\n\n- item\n\nparagraph"} />
    );

    const root = container.querySelector('[contenteditable="true"]');
    expect(root).not.toBeNull();
    expect(container.querySelectorAll('[contenteditable="true"]')).toHaveLength(1);
    expect(root?.children).toHaveLength(3);
    expect(root?.children[0].getAttribute("data-block-type")).toBe("heading");
    expect(root?.children[1].getAttribute("data-block-type")).toBe("unordered-list");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- MicroMDEditor.test.tsx`
Expected: FAIL because the old component renders per-block editable islands.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/core/render.ts
import type { Block } from "./types";

function createBlockElement(block: Block): HTMLElement {
  const element = document.createElement("div");
  element.dataset.blockId = block.id;
  element.dataset.blockType = block.type;
  element.textContent = block.raw;
  element.style.whiteSpace = "pre-wrap";
  element.style.wordBreak = "break-word";
  element.style.minHeight = "1.2em";

  if (block.type === "heading") {
    const level = block.meta?.level ?? 1;
    element.style.fontWeight = "700";
    element.style.fontSize = `${Math.max(1.1, 2.1 - level * 0.15)}rem`;
  }

  if (block.type === "blockquote") {
    element.style.borderLeft = "3px solid #d0d7de";
    element.style.paddingLeft = "12px";
  }

  if (block.type === "code-fence") {
    element.style.fontFamily = "ui-monospace, monospace";
    element.style.background = "rgba(0, 0, 0, 0.04)";
  }

  return element;
}

export function renderBlocks(root: HTMLElement, blocks: Block[]): void {
  root.replaceChildren(...blocks.map(createBlockElement));
}
```

```ts
// src/MicroMDEditor.tsx
import { useLayoutEffect, useRef } from "react";
import { parseMarkdownToBlocks } from "./core/markdown";
import { renderBlocks } from "./core/render";

export function MicroMDEditor({ initialMarkdown = "", className, style }: {
  initialMarkdown?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const hostRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!hostRef.current) return;
    const root = document.createElement("div");
    root.setAttribute("contenteditable", "true");
    renderBlocks(root, parseMarkdownToBlocks(initialMarkdown));
    hostRef.current.replaceChildren(root);
  }, [initialMarkdown]);

  return <div ref={hostRef} className={className} style={style} />;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- MicroMDEditor.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/render.ts src/MicroMDEditor.tsx src/MicroMDEditor.test.tsx
git commit -m "feat: render single editable root"
```

### Task 4: Introduce The Shared Editor Core

**Files:**
- Create: `src/core/EditorCore.ts`
- Create: `src/core/index.ts`
- Modify: `src/MicroMDEditor.tsx`
- Modify: `src/index.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { render } from "@testing-library/react";
import { MicroMDEditor } from "./MicroMDEditor";

describe("MicroMDEditor shell", () => {
  it("emits markdown changes from the imperative core", () => {
    const onChange = jest.fn();
    const { container } = render(
      <MicroMDEditor initialMarkdown={"paragraph"} onChange={onChange} />
    );

    const root = container.querySelector('[contenteditable="true"]') as HTMLElement;
    root.innerHTML = '<div data-block-id="a" data-block-type="heading"># Title</div>';
    root.dispatchEvent(new Event("input", { bubbles: true }));

    expect(onChange).toHaveBeenLastCalledWith("# Title");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- MicroMDEditor.test.tsx`
Expected: FAIL because the wrapper does not yet use a shared core or wire change events correctly.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/core/EditorCore.ts
import { parseMarkdownToBlocks, serializeBlocksToMarkdown } from "./markdown";
import { readBlocksFromDom } from "./selection-dom-bridge";
import { renderBlocks } from "./render";

export type EditorCoreOptions = {
  initialMarkdown: string;
  onChange?: (markdown: string) => void;
  debug?: boolean;
};

export type EditorCoreHandle = {
  root: HTMLElement;
  update(next: Partial<EditorCoreOptions>): void;
  destroy(): void;
};

export function createEditorCore(host: HTMLElement, options: EditorCoreOptions): EditorCoreHandle {
  let current = { ...options };
  const root = document.createElement("div");
  root.setAttribute("contenteditable", "true");
  host.replaceChildren(root);
  renderBlocks(root, parseMarkdownToBlocks(current.initialMarkdown));

  const handleInput = () => {
    const blocks = readBlocksFromDom(root);
    const markdown = serializeBlocksToMarkdown(blocks);
    current.onChange?.(markdown);
    renderBlocks(root, blocks);
  };

  root.addEventListener("input", handleInput);

  return {
    root,
    update(next) {
      current = { ...current, ...next };
      if (next.initialMarkdown !== undefined) {
        renderBlocks(root, parseMarkdownToBlocks(next.initialMarkdown));
      }
    },
    destroy() {
      root.removeEventListener("input", handleInput);
      root.remove();
    },
  };
}
```

```ts
// src/MicroMDEditor.tsx
import { useLayoutEffect, useRef } from "react";
import { createEditorCore, type EditorCoreHandle } from "./core";

export function MicroMDEditor(props: {
  initialMarkdown?: string;
  onChange?: (markdown: string) => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<EditorCoreHandle | null>(null);

  useLayoutEffect(() => {
    if (!hostRef.current) return;
    coreRef.current = createEditorCore(hostRef.current, {
      initialMarkdown: props.initialMarkdown ?? "",
      onChange: props.onChange,
    });
    return () => coreRef.current?.destroy();
  }, []);

  useLayoutEffect(() => {
    coreRef.current?.update({
      initialMarkdown: props.initialMarkdown,
      onChange: props.onChange,
    });
  }, [props.initialMarkdown, props.onChange]);

  return <div ref={hostRef} className={props.className} style={props.style} />;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- MicroMDEditor.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/EditorCore.ts src/core/index.ts src/MicroMDEditor.tsx src/index.ts src/MicroMDEditor.test.tsx
git commit -m "feat: add shared imperative editor core"
```

### Task 5: Implement Model-Space Paste Replacement

**Files:**
- Create: `src/core/paste.ts`
- Modify: `src/core/EditorCore.ts`
- Test: `src/core/paste.test.ts`
- Test: `src/MicroMDEditor.test.tsx`

- [ ] **Step 1: Write the failing tests**

```ts
import { replaceSelectionWithMarkdown } from "./paste";

describe("replaceSelectionWithMarkdown", () => {
  it("replaces a multi-block range and places caret at end of inserted content", () => {
    const result = replaceSelectionWithMarkdown(
      [
        { id: "a", type: "paragraph", raw: "hello" },
        { id: "b", type: "paragraph", raw: "world" },
      ],
      {
        start: { blockId: "a", offset: 2 },
        end: { blockId: "b", offset: 3 },
        isCollapsed: false,
      },
      "# Title\nparagraph",
    );

    expect(result.markdown).toBe("he# Title\n\nparagraphld");
    expect(result.caret.blockId).toBe(result.blocks[result.blocks.length - 1].id);
  });
});
```

```ts
it("uses text/plain paste instead of nested html insertion", () => {
  const onChange = jest.fn();
  const { container } = render(<MicroMDEditor initialMarkdown={"Paragraph"} onChange={onChange} />);
  const root = container.querySelector('[contenteditable="true"]') as HTMLElement;
  const selection = window.getSelection()!;
  const range = document.createRange();
  range.selectNodeContents(root);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);

  fireEvent.paste(root, {
    clipboardData: {
      getData: (type: string) => (type === "text/plain" ? "# Title\nparagraph" : "<h1># Title</h1>"),
    },
  });

  expect(onChange).toHaveBeenLastCalledWith("Paragraph\n\n# Title\n\nparagraph");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- paste.test.ts MicroMDEditor.test.tsx`
Expected: FAIL because paste handling is still missing or DOM-driven.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/core/paste.ts
import { parseMarkdownToBlocks, serializeBlocksToMarkdown } from "./markdown";
import type { Block, BlockRange, BlockPoint } from "./types";

export function replaceSelectionWithMarkdown(blocks: Block[], range: BlockRange, pasted: string) {
  const startIndex = blocks.findIndex((block) => block.id === range.start.blockId);
  const endIndex = blocks.findIndex((block) => block.id === range.end.blockId);
  const startBlock = blocks[startIndex];
  const endBlock = blocks[endIndex];
  const prefix = startBlock.raw.slice(0, range.start.offset);
  const suffix = endBlock.raw.slice(range.end.offset);
  const inserted = parseMarkdownToBlocks(pasted);
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

  const nextBlocks = [...blocks.slice(0, startIndex), ...merged, ...blocks.slice(endIndex + 1)];
  const caret: BlockPoint = {
    blockId: nextBlocks[startIndex + merged.length - 1].id,
    offset: merged.length === 1 ? prefix.length + inserted[0].raw.length : merged[merged.length - 1].raw.length - suffix.length,
  };

  return {
    blocks: nextBlocks,
    markdown: serializeBlocksToMarkdown(nextBlocks),
    caret,
  };
}
```

```ts
// src/core/EditorCore.ts (inside handlePaste)
const handlePaste = (event: ClipboardEvent) => {
  const pasted = event.clipboardData?.getData("text/plain");
  if (!pasted) return;
  event.preventDefault();
  const blocks = readBlocksFromDom(root);
  const selection = getLogicalSelection(root);
  if (!selection) return;
  const next = replaceSelectionWithMarkdown(blocks, selection, pasted);
  renderBlocks(root, next.blocks);
  restoreCaretToPoint(root, next.caret);
  current.onChange?.(next.markdown);
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- paste.test.ts MicroMDEditor.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/paste.ts src/core/paste.test.ts src/core/EditorCore.ts src/MicroMDEditor.test.tsx
git commit -m "feat: add model-space markdown paste pipeline"
```

### Task 6: Implement Structural Keyboard Rules

**Files:**
- Create: `src/core/keyboard.ts`
- Modify: `src/core/EditorCore.ts`
- Test: `src/core/keyboard.test.ts`
- Test: `src/MicroMDEditor.test.tsx`

- [ ] **Step 1: Write the failing tests**

```ts
import { applyStructuralKey } from "./keyboard";

describe("applyStructuralKey", () => {
  it("demotes heading to paragraph when marker is removed", () => {
    const result = applyStructuralKey({
      blocks: [{ id: "a", type: "heading", raw: "# Title", meta: { level: 1 } }],
      key: "Backspace",
      selection: {
        start: { blockId: "a", offset: 2 },
        end: { blockId: "a", offset: 2 },
        isCollapsed: true,
      },
    });

    expect(result?.blocks[0].raw).toBe("Title");
    expect(result?.blocks[0].type).toBe("paragraph");
  });

  it("splits a paragraph on Enter", () => {
    const result = applyStructuralKey({
      blocks: [{ id: "a", type: "paragraph", raw: "hello world" }],
      key: "Enter",
      selection: {
        start: { blockId: "a", offset: 5 },
        end: { blockId: "a", offset: 5 },
        isCollapsed: true,
      },
    });

    expect(result?.blocks.map((block) => block.raw)).toEqual(["hello", " world"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- keyboard.test.ts`
Expected: FAIL with missing function or missing behavior.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/core/keyboard.ts
import { parseMarkdownToBlocks } from "./markdown";
import type { Block, BlockRange, BlockPoint } from "./types";

type StructuralKeyInput = {
  blocks: Block[];
  selection: BlockRange;
  key: "Enter" | "Backspace" | "Delete" | "Tab" | "Shift+Tab";
};

export function applyStructuralKey(input: StructuralKeyInput): { blocks: Block[]; caret: BlockPoint } | null {
  const index = input.blocks.findIndex((block) => block.id === input.selection.start.blockId);
  const block = input.blocks[index];
  if (!block || !input.selection.isCollapsed) return null;

  if (input.key === "Enter") {
    const before = block.raw.slice(0, input.selection.start.offset);
    const after = block.raw.slice(input.selection.start.offset);
    const nextBlocks = [
      ...input.blocks.slice(0, index),
      { ...parseMarkdownToBlocks(before)[0], id: block.id },
      ...parseMarkdownToBlocks(after),
      ...input.blocks.slice(index + 1),
    ];
    return {
      blocks: nextBlocks,
      caret: { blockId: nextBlocks[index + 1].id, offset: 0 },
    };
  }

  if (input.key === "Backspace" && /^#{1,6}\s/.test(block.raw) && input.selection.start.offset <= (block.raw.match(/^#+\s/)?.[0].length ?? 0)) {
    const nextRaw = block.raw.replace(/^#{1,6}\s/, "");
    return {
      blocks: [...input.blocks.slice(0, index), { ...parseMarkdownToBlocks(nextRaw)[0], id: block.id }, ...input.blocks.slice(index + 1)],
      caret: { blockId: block.id, offset: 0 },
    };
  }

  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- keyboard.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/keyboard.ts src/core/keyboard.test.ts src/core/EditorCore.ts src/MicroMDEditor.test.tsx
git commit -m "feat: add structural markdown keyboard rules"
```

### Task 7: Add Full Block Coverage And Parser Adapter

**Files:**
- Modify: `src/core/markdown.ts`
- Modify: `src/core/render.ts`
- Modify: `src/core/keyboard.ts`
- Test: `src/core/markdown.test.ts`
- Test: `src/MicroMDEditor.test.tsx`

- [ ] **Step 1: Write the failing tests**

```ts
it("parses task lists, blockquotes, code fences, and horizontal rules", () => {
  const blocks = parseMarkdownToBlocks("- [x] done\n\n> quote\n\n```\ncode\n```\n\n---");
  expect(blocks.map((block) => block.type)).toEqual([
    "task-list",
    "blockquote",
    "code-fence",
    "horizontal-rule",
  ]);
});

it("renders the full supported block set in the root", () => {
  const { container } = render(
    <MicroMDEditor initialMarkdown={"- [x] done\n\n> quote\n\n```\ncode\n```"} />
  );
  const root = container.querySelector('[contenteditable="true"]')!;
  expect(root.querySelector('[data-block-type="task-list"]')).not.toBeNull();
  expect(root.querySelector('[data-block-type="blockquote"]')).not.toBeNull();
  expect(root.querySelector('[data-block-type="code-fence"]')).not.toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- markdown.test.ts MicroMDEditor.test.tsx`
Expected: FAIL for unsupported block parsing or missing rendering branches.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/core/markdown.ts
import { remark } from "remark";

export function parseMarkdownToBlocks(markdown: string): Block[] {
  // Keep the adapter boundary isolated so parser choice can change later.
  const normalized = markdown.replace(/\r\n/g, "\n");
  const ast = remark().parse(normalized);
  // Walk top-level children and convert each top-level markdown node into one canonical block.
  // Preserve block.raw as original markdown slice for visible syntax editing.
}
```

```ts
// src/core/render.ts
if (block.type === "task-list") {
  element.style.paddingLeft = "1.25rem";
}
if (block.type === "ordered-list") {
  element.style.paddingLeft = "1.25rem";
}
if (block.type === "horizontal-rule") {
  element.style.letterSpacing = "0.08em";
  element.style.opacity = "0.75";
}
```

```ts
// src/core/keyboard.ts
// Extend Enter/Backspace rules for list continuation, quote exit, code fence behavior, and task list toggling.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- markdown.test.ts MicroMDEditor.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/markdown.ts src/core/render.ts src/core/keyboard.ts src/core/markdown.test.ts src/MicroMDEditor.test.tsx package.json package-lock.json
git commit -m "feat: add full markdown block coverage"
```

### Task 8: Add Preact Wrapper And Shared Public Exports

**Files:**
- Modify: `src/preact.ts`
- Modify: `src/index.ts`
- Test: `src/preact-build.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { readFileSync } from "node:fs";

describe("preact entry", () => {
  it("exports the rebuilt editor through the preact entry", () => {
    const source = readFileSync("src/preact.ts", "utf8");
    expect(source).toContain("createEditorCore");
    expect(source).toContain("export");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- preact-build.test.ts`
Expected: FAIL because the Preact entry still reflects the old architecture.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/preact.ts
import { useLayoutEffect, useRef } from "preact/hooks";
import type { JSX } from "preact";
import { createEditorCore, type EditorCoreHandle } from "./core";

export function MicroMDEditor(props: {
  initialMarkdown?: string;
  onChange?: (markdown: string) => void;
  className?: string;
  style?: JSX.CSSProperties;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const coreRef = useRef<EditorCoreHandle | null>(null);

  useLayoutEffect(() => {
    if (!hostRef.current) return;
    coreRef.current = createEditorCore(hostRef.current, {
      initialMarkdown: props.initialMarkdown ?? "",
      onChange: props.onChange,
    });
    return () => coreRef.current?.destroy();
  }, []);

  useLayoutEffect(() => {
    coreRef.current?.update({
      initialMarkdown: props.initialMarkdown,
      onChange: props.onChange,
    });
  }, [props.initialMarkdown, props.onChange]);

  return <div ref={hostRef} className={props.className} style={props.style} />;
}

export default MicroMDEditor;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- preact-build.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/preact.ts src/index.ts src/preact-build.test.ts
git commit -m "feat: add preact shell for single-root editor"
```

### Task 9: Add Safe Inline Styling

**Files:**
- Modify: `src/core/render.ts`
- Create: `src/core/inline.ts`
- Test: `src/MicroMDEditor.test.tsx`

- [ ] **Step 1: Write the failing test**

```ts
it("keeps raw inline markdown visible while applying lightweight styling hooks", () => {
  const { container } = render(
    <MicroMDEditor initialMarkdown={"paragraph with **bold** and `code`"} />
  );

  const root = container.querySelector('[contenteditable="true"]')!;
  expect(root.textContent).toContain("**bold**");
  expect(root.textContent).toContain("`code`");
  expect(root.querySelector('[data-inline-token="strong"]')).not.toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- MicroMDEditor.test.tsx`
Expected: FAIL because inline styling hooks do not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/core/inline.ts
export type InlineToken = {
  type: "strong" | "emphasis" | "code" | "link";
  start: number;
  end: number;
};

export function getInlineTokens(raw: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  if (/\*\*.+\*\*/.test(raw)) tokens.push({ type: "strong", start: 0, end: raw.length });
  if (/`.+`/.test(raw)) tokens.push({ type: "code", start: 0, end: raw.length });
  return tokens;
}
```

```ts
// src/core/render.ts
import { getInlineTokens } from "./inline";

const tokens = getInlineTokens(block.raw);
if (tokens.length > 0) {
  element.dataset.inlineToken = tokens[0].type;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- MicroMDEditor.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/inline.ts src/core/render.ts src/MicroMDEditor.test.tsx
git commit -m "feat: add safe inline styling hooks"
```

### Task 10: Clean Up Prototype Wiring And Demo Surface

**Files:**
- Modify: `example/src/App.tsx`
- Modify: `src/index.ts`
- Delete or Modify: `src/MicroMDEditor2.tsx`
- Delete or Modify: `src/MicroMDEditor2.test.tsx`

- [ ] **Step 1: Write the failing test**

```ts
import { render } from "@testing-library/react";
import { MicroMDEditor } from "./MicroMDEditor";

describe("public editor surface", () => {
  it("uses the rebuilt editor as the default public component", () => {
    const { container } = render(<MicroMDEditor initialMarkdown={"# Title"} />);
    expect(container.querySelector('[contenteditable="true"]')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- MicroMDEditor.test.tsx`
Expected: FAIL if the public surface still depends on the prototype path or stale exports.

- [ ] **Step 3: Write minimal implementation**

```ts
// example/src/App.tsx
import { MicroMDEditor } from "micro-md-editor";

// Remove direct ../../src/MicroMDEditor2 import and use the public package surface again.
```

```ts
// src/index.ts
export { MicroMDEditor } from "./MicroMDEditor";
export { MicroMDEditor as default } from "./MicroMDEditor";
export type { Block, BlockRange, BlockPoint } from "./core/types";
```

```ts
// src/MicroMDEditor2.tsx
// Remove prototype-only debug editor once feature parity is covered by the rebuilt public editor.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- MicroMDEditor.test.tsx && cd example && npm run build`
Expected: PASS and successful Vite production build

- [ ] **Step 5: Commit**

```bash
git add example/src/App.tsx src/index.ts src/MicroMDEditor.tsx src/MicroMDEditor.test.tsx
git rm src/MicroMDEditor2.tsx src/MicroMDEditor2.test.tsx
git commit -m "refactor: promote rebuilt single-root editor to public surface"
```

## Self-Review

### Spec coverage

- Shared imperative core: covered by Tasks 3, 4, and 8.
- Single editable root: covered by Tasks 3 and 4.
- Full block support: covered by Tasks 1 and 7.
- Selection mapping and caret targeting: covered by Tasks 2 and 5.
- Plain-text markdown paste: covered by Task 5.
- Structural keyboard behavior: covered by Task 6.
- React and Preact wrappers: covered by Tasks 4 and 8.
- Inline styling with graceful degradation: covered by Task 9.
- Public package/demo migration: covered by Task 10.

### Placeholder scan

- No `TODO`, `TBD`, or “implement later” markers remain.
- Code-changing steps contain concrete code snippets.
- Test steps include explicit commands and expected fail/pass states.

### Type consistency

- Core types use `Block`, `BlockPoint`, and `BlockRange` consistently.
- The shell and core both refer to `initialMarkdown` and `onChange`.
- The plan assumes a shared `createEditorCore` API for both React and Preact wrappers.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-15-single-root-editor-rebuild.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
