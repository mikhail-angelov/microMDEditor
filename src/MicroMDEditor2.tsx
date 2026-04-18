import { CSSProperties, useEffect, useLayoutEffect, useRef } from 'react';

type BlockType = 'heading1' | 'heading2' | 'list-dash' | 'list-star' | 'paragraph';

type Block = {
  type: BlockType;
  text: string;
};

export type MicroMDEditor2Props = {
  initialMarkdown?: string;
  onChange?: (markdown: string) => void;
  className?: string;
  style?: CSSProperties;
  debug?: boolean;
};

type SelectionPoint = {
  blockIndex: number;
  offset: number;
};

type SelectionSnapshot = {
  anchor: SelectionPoint;
  focus: SelectionPoint;
};

type NormalizedSelection = {
  start: SelectionPoint;
  end: SelectionPoint;
};

function parseMarkdown(markdown: string): Block[] {
  const normalized = markdown.replace(/\r\n/g, '\n');
  const lines = normalized.split(/\n+/);
  const blocks = lines.map((line) => {
    if (line.startsWith('## ')) {
      return { type: 'heading2' as const, text: line };
    }

    if (line.startsWith('# ')) {
      return { type: 'heading1' as const, text: line };
    }

    if (line.startsWith('- ')) {
      return { type: 'list-dash' as const, text: line };
    }

    if (line.startsWith('* ')) {
      return { type: 'list-star' as const, text: line };
    }

    return { type: 'paragraph' as const, text: line };
  });

  if (blocks.length === 0) {
    return [{ type: 'paragraph', text: '' }];
  }

  return blocks;
}

function blocksToMarkdown(blocks: Block[]): string {
  return blocks.map((block) => block.text).join('\n\n');
}

function parseTextToBlocks(text: string): Block[] {
  return parseMarkdown(text);
}

function getNodeText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? '';
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }

  const element = node as HTMLElement;
  if (element.tagName === 'BR') {
    return '\n';
  }

  let text = '';
  element.childNodes.forEach((child) => {
    text += getNodeText(child);
  });
  return text;
}

function createBlockElement(block: Block): HTMLElement {
  const tagName =
    block.type === 'heading1' ? 'h1' : block.type === 'heading2' ? 'h2' : 'div';
  const element = document.createElement(tagName);
  element.dataset.blockType = block.type;
  element.textContent = block.text;
  element.style.margin = '0';
  element.style.minHeight = '1.2em';
  element.style.whiteSpace = 'pre-wrap';
  element.style.wordBreak = 'break-word';

  if (block.type === 'heading1') {
    element.style.fontSize = '2rem';
    element.style.fontWeight = '700';
    element.style.lineHeight = '1.2';
    element.style.marginBottom = '0.25em';
  }

  if (block.type === 'heading2') {
    element.style.fontSize = '1.5rem';
    element.style.fontWeight = '700';
    element.style.lineHeight = '1.25';
    element.style.marginBottom = '0.25em';
  }

  if (block.type === 'list-dash' || block.type === 'list-star') {
    element.style.paddingLeft = '1.25rem';
  }

  return element;
}

function renderBlocks(root: HTMLDivElement, blocks: Block[]): void {
  root.replaceChildren(...blocks.map(createBlockElement));
}

function inferBlockFromElement(element: HTMLElement): Block[] {
  const text = getNodeText(element);
  return parseTextToBlocks(text);
}

function readBlocksFromDom(root: HTMLDivElement): Block[] {
  const blocks: Block[] = [];

  root.childNodes.forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      blocks.push(...inferBlockFromElement(node as HTMLElement));
      return;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      const text = getNodeText(node);
      if (text.length > 0) {
        blocks.push(...parseTextToBlocks(text));
      }
    }
  });

  if (blocks.length === 0) {
    return [{ type: 'paragraph', text: '' }];
  }

  return blocks;
}

function getBlockAncestor(root: HTMLDivElement, node: Node | null): HTMLElement | null {
  let current = node;

  while (current && current !== root) {
    if (current.parentNode === root && current.nodeType === Node.ELEMENT_NODE) {
      return current as HTMLElement;
    }
    current = current.parentNode;
  }

  return null;
}

function getOffsetWithinBlock(block: HTMLElement, targetNode: Node, targetOffset: number): number {
  if (targetNode === block) {
    return targetOffset;
  }

  const range = document.createRange();
  range.selectNodeContents(block);
  range.setEnd(targetNode, targetOffset);
  return range.toString().length;
}

function resolveRootBoundaryPoint(root: HTMLDivElement, offset: number): SelectionPoint | null {
  const children = Array.from(root.children) as HTMLElement[];
  if (children.length === 0) {
    return { blockIndex: 0, offset: 0 };
  }

  if (offset <= 0) {
    return { blockIndex: 0, offset: 0 };
  }

  if (offset >= children.length) {
    const lastIndex = children.length - 1;
    return {
      blockIndex: lastIndex,
      offset: children[lastIndex].textContent?.length ?? 0,
    };
  }

  return { blockIndex: offset, offset: 0 };
}

function resolvePoint(root: HTMLDivElement, node: Node | null, offset: number): SelectionPoint | null {
  if (!node) {
    return null;
  }

  if (node === root) {
    return resolveRootBoundaryPoint(root, offset);
  }

  const block = getBlockAncestor(root, node);
  if (!block) {
    return null;
  }

  const blockIndex = Array.from(root.children).indexOf(block);
  if (blockIndex === -1) {
    return null;
  }

  return {
    blockIndex,
    offset: getOffsetWithinBlock(block, node, offset),
  };
}

function snapshotSelection(root: HTMLDivElement): SelectionSnapshot | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const anchor = resolvePoint(root, selection.anchorNode, selection.anchorOffset);
  const focus = resolvePoint(root, selection.focusNode, selection.focusOffset);

  if (!anchor || !focus) {
    return null;
  }

  return { anchor, focus };
}

function normalizeSelection(snapshot: SelectionSnapshot): NormalizedSelection {
  const anchorBeforeFocus =
    snapshot.anchor.blockIndex < snapshot.focus.blockIndex ||
    (snapshot.anchor.blockIndex === snapshot.focus.blockIndex &&
      snapshot.anchor.offset <= snapshot.focus.offset);

  return anchorBeforeFocus
    ? { start: snapshot.anchor, end: snapshot.focus }
    : { start: snapshot.focus, end: snapshot.anchor };
}

function replaceSelectionInBlocks(
  blocks: Block[],
  selection: NormalizedSelection,
  pastedText: string,
): { blocks: Block[]; caret: SelectionPoint } {
  const startBlock = blocks[selection.start.blockIndex];
  const endBlock = blocks[selection.end.blockIndex];

  if (!startBlock || !endBlock) {
    return { blocks, caret: selection.end };
  }

  const insertedBlocks = parseMarkdown(pastedText);
  const si = selection.start.blockIndex;
  const ei = selection.end.blockIndex;

  // Collapsed at end of block: insert pasted blocks after, no merging.
  if (
    si === ei &&
    selection.start.offset >= startBlock.text.length
  ) {
    const nextBlocks = [
      ...blocks.slice(0, si + 1),
      ...insertedBlocks,
      ...blocks.slice(si + 1),
    ];
    const caretBlock = nextBlocks[si + insertedBlocks.length];
    return {
      blocks: nextBlocks,
      caret: { blockIndex: si + insertedBlocks.length, offset: caretBlock.text.length },
    };
  }

  // Collapsed at start of block: insert pasted blocks before, no merging.
  if (si === ei && selection.start.offset === 0) {
    const nextBlocks = [
      ...blocks.slice(0, si),
      ...insertedBlocks,
      ...blocks.slice(si),
    ];
    const caretBlock = nextBlocks[si + insertedBlocks.length - 1];
    return {
      blocks: nextBlocks,
      caret: { blockIndex: si + insertedBlocks.length - 1, offset: caretBlock.text.length },
    };
  }

  const prefix = startBlock.text.slice(0, selection.start.offset);
  const suffix = endBlock.text.slice(selection.end.offset);

  const mergedBlocks =
    insertedBlocks.length === 1
      ? [{ ...insertedBlocks[0], text: `${prefix}${insertedBlocks[0].text}${suffix}` }]
      : insertedBlocks.map((block) => ({ ...block }));

  if (mergedBlocks.length > 1) {
    mergedBlocks[0] = { ...mergedBlocks[0], text: `${prefix}${mergedBlocks[0].text}` };
    const last = mergedBlocks.length - 1;
    mergedBlocks[last] = { ...mergedBlocks[last], text: `${mergedBlocks[last].text}${suffix}` };
  }

  const nextBlocks = [
    ...blocks.slice(0, si),
    ...mergedBlocks,
    ...blocks.slice(ei + 1),
  ];

  const caretBlockIndex = si + mergedBlocks.length - 1;
  const caretOffset =
    mergedBlocks.length === 1
      ? prefix.length + insertedBlocks[0].text.length
      : mergedBlocks[mergedBlocks.length - 1].text.length - suffix.length;

  return {
    blocks: nextBlocks,
    caret: { blockIndex: caretBlockIndex, offset: caretOffset },
  };
}

function findTextPosition(block: HTMLElement, offset: number): { node: Node; offset: number } {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, null);
  let consumed = 0;
  let node: Text | null = null;

  while ((node = walker.nextNode() as Text | null)) {
    const length = node.textContent?.length ?? 0;
    if (consumed + length >= offset) {
      return { node, offset: offset - consumed };
    }
    consumed += length;
  }

  if (block.firstChild && block.firstChild.nodeType === Node.TEXT_NODE) {
    const text = block.firstChild.textContent ?? '';
    return { node: block.firstChild, offset: Math.min(offset, text.length) };
  }

  return { node: block, offset: block.childNodes.length };
}

function restoreSelection(root: HTMLDivElement, snapshot: SelectionSnapshot | null): void {
  if (!snapshot) {
    return;
  }

  const selection = window.getSelection();
  if (!selection) {
    return;
  }

  const anchorBlock = root.children.item(snapshot.anchor.blockIndex) as HTMLElement | null;
  const focusBlock = root.children.item(snapshot.focus.blockIndex) as HTMLElement | null;

  if (!anchorBlock || !focusBlock) {
    return;
  }

  const anchor = findTextPosition(anchorBlock, Math.min(snapshot.anchor.offset, anchorBlock.textContent?.length ?? 0));
  const focus = findTextPosition(focusBlock, Math.min(snapshot.focus.offset, focusBlock.textContent?.length ?? 0));
  const range = document.createRange();

  range.setStart(anchor.node, anchor.offset);
  range.setEnd(focus.node, focus.offset);

  selection.removeAllRanges();
  selection.addRange(range);
}

function isNodeInsideRoot(root: HTMLElement, node: Node | null): boolean {
  return !!node && (node === root || root.contains(node));
}

function insertPlainTextAtSelection(root: HTMLDivElement, text: string): void {
  const selection = window.getSelection();
  const textNode = document.createTextNode(text);

  if (!selection || selection.rangeCount === 0) {
    root.appendChild(textNode);
    const fallbackRange = document.createRange();
    fallbackRange.setStart(textNode, text.length);
    fallbackRange.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(fallbackRange);
    return;
  }

  const range = selection.getRangeAt(0);
  if (!isNodeInsideRoot(root, range.startContainer) || !isNodeInsideRoot(root, range.endContainer)) {
    root.appendChild(textNode);
    const fallbackRange = document.createRange();
    fallbackRange.setStart(textNode, text.length);
    fallbackRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(fallbackRange);
    return;
  }

  range.deleteContents();
  range.insertNode(textNode);

  const nextRange = document.createRange();
  nextRange.setStart(textNode, text.length);
  nextRange.collapse(true);
  selection.removeAllRanges();
  selection.addRange(nextRange);
}

function applyEditableRootStyles(root: HTMLDivElement): void {
  root.setAttribute('contenteditable', 'true');
  root.spellcheck = false;
  root.style.outline = 'none';
  root.style.whiteSpace = 'pre-wrap';
  root.style.wordBreak = 'break-word';
  root.style.padding = '16px';
  root.style.border = '1px solid #d0d7de';
  root.style.borderRadius = '12px';
  root.style.background = '#ffffff';
  root.style.color = '#111827';
  root.style.fontFamily = 'ui-sans-serif, system-ui, sans-serif';
  root.style.fontSize = '16px';
  root.style.lineHeight = '1.5';
  root.style.minHeight = '240px';
}

export function MicroMDEditor2({
  initialMarkdown = '',
  onChange,
  className,
  style,
  debug = false,
}: MicroMDEditor2Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const markdownRef = useRef<string>(initialMarkdown);

  useLayoutEffect(() => {
    if (!hostRef.current || editorRef.current) {
      return;
    }

    const root = document.createElement('div');
    applyEditableRootStyles(root);
    renderBlocks(root, parseMarkdown(markdownRef.current));
    hostRef.current.appendChild(root);
    editorRef.current = root;

    const handleInput = () => {
      if (!editorRef.current) {
        return;
      }

      if (debug) {
        console.log('[MicroMDEditor2] input.innerHTML', editorRef.current.innerHTML);
        console.log('[MicroMDEditor2] input.textContent', editorRef.current.textContent);
        console.log(
          '[MicroMDEditor2] input.childNodes',
          Array.from(editorRef.current.childNodes).map((node) => ({
            type: node.nodeType,
            name: node.nodeName,
            text: node.textContent,
          })),
        );
      }

      const selection = snapshotSelection(editorRef.current);
      const blocks = readBlocksFromDom(editorRef.current);
      const nextMarkdown = blocksToMarkdown(blocks);

      markdownRef.current = nextMarkdown;
      renderBlocks(editorRef.current, blocks);
      restoreSelection(editorRef.current, selection);
      onChange?.(nextMarkdown);
    };

    const handlePaste = (event: ClipboardEvent) => {
      const pastedText = event.clipboardData?.getData('text/plain');

      if (!pastedText) {
        if (!debug) {
          return;
        }

        console.log('[MicroMDEditor2] paste.text/plain', pastedText);
        console.log('[MicroMDEditor2] paste.text/html', event.clipboardData?.getData('text/html'));
        return;
      }

      event.preventDefault();
      const currentBlocks = readBlocksFromDom(root);
      const currentSelection = snapshotSelection(root);

      if (currentSelection) {
        const next = replaceSelectionInBlocks(
          currentBlocks,
          normalizeSelection(currentSelection),
          pastedText,
        );
        const caretSelection: SelectionSnapshot = {
          anchor: next.caret,
          focus: next.caret,
        };

        markdownRef.current = blocksToMarkdown(next.blocks);
        renderBlocks(root, next.blocks);
        restoreSelection(root, caretSelection);
        onChange?.(markdownRef.current);
      } else {
        insertPlainTextAtSelection(root, pastedText);
        handleInput();
      }

      if (!debug) {
        return;
      }

      console.log('[MicroMDEditor2] paste.text/plain', pastedText);
      console.log('[MicroMDEditor2] paste.text/html', event.clipboardData?.getData('text/html'));

      queueMicrotask(() => {
        if (!editorRef.current) {
          return;
        }

        console.log('[MicroMDEditor2] post-paste.innerHTML', editorRef.current.innerHTML);
        console.log('[MicroMDEditor2] post-paste.textContent', editorRef.current.textContent);
        console.log(
          '[MicroMDEditor2] post-paste.childNodes',
          Array.from(editorRef.current.childNodes).map((node) => ({
            type: node.nodeType,
            name: node.nodeName,
            text: node.textContent,
          })),
        );
      });
    };

    root.addEventListener('input', handleInput);
    root.addEventListener('paste', handlePaste);

    return () => {
      root.removeEventListener('input', handleInput);
      root.removeEventListener('paste', handlePaste);
      root.remove();
      editorRef.current = null;
    };
  }, [debug, onChange]);

  useEffect(() => {
    if (!editorRef.current) {
      return;
    }

    if (initialMarkdown === markdownRef.current) {
      return;
    }

    markdownRef.current = initialMarkdown;
    renderBlocks(editorRef.current, parseMarkdown(initialMarkdown));
  }, [initialMarkdown]);

  return <div ref={hostRef} className={className} style={style} />;
}

export default MicroMDEditor2;
