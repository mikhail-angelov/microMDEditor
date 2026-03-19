// Utility functions for the Markdown editor

/**
 * Generate a unique ID for blocks
 */
export function genId(): string {
  return Math.random().toString(36).slice(2, 11);
}

/**
 * Escape HTML special characters
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "\x26amp;")
    .replace(/</g, "\x26lt;")
    .replace(/>/g, "\x26gt;")
    .replace(/"/g, "\x26quot;")
    .replace(/'/g, "\x26#039;");
}

/**
 * Get caret offset relative to root element (in plain text terms)
 */
export function getCaretOffset(root: HTMLElement, selection: Selection): number {
  const range = selection.getRangeAt(0);
  const preRange = range.cloneRange();

  preRange.selectNodeContents(root);
  preRange.setEnd(range.endContainer, range.endOffset);

  return preRange.toString().length;
}

/**
 * Place caret at the end of an element
 */
export function placeCaretAtEnd(el: HTMLElement): void {
  const range = document.createRange();
  const sel = window.getSelection();
  
  if (!sel) return;
  
  range.selectNodeContents(el);
  range.collapse(false);
  
  sel.removeAllRanges();
  sel.addRange(range);
}

/**
 * Place caret at a specific offset in an element
 */
export function placeCaretAtOffset(el: HTMLElement, offset: number): void {
  const sel = window.getSelection();
  if (!sel) return;

  // Use textContent instead of innerText for accurate offset calculation
  // innerText normalizes whitespace which can cause issues in code blocks
  const textContent = el.textContent || "";
  const clampedOffset = Math.min(offset, textContent.length);

  // Walk through text nodes to find the right position
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
  let currentOffset = 0;
  let node: Text | null = null;

  while ((node = walker.nextNode() as Text | null)) {
    const nodeLength = node.textContent?.length || 0;
    if (currentOffset + nodeLength >= clampedOffset) {
      const range = document.createRange();
      range.setStart(node, clampedOffset - currentOffset);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }
    currentOffset += nodeLength;
  }

  // Fallback: place at end
  placeCaretAtEnd(el);
}

/**
 * Detect block type from text content
 * Should match plugin detection logic
 */
export function detectType(text: string): string {
  if (/^#{1,6}\s/.test(text)) return "heading";
  if (/^>\s?/.test(text)) return "quote";
  if (/^[-*]\s/.test(text)) return "list";
  if (/^\d+\.\s/.test(text)) return "ordered-list";
  
  // Check for code blocks - any line starting with ```
  const lines = text.split('\n');
  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      return "code";
    }
  }
  
  return "paragraph";
}

import { Block } from "./types";

/**
 * Parse markdown into blocks
 */
export function parseMarkdown(markdown: string): Block[] {
  const lines = markdown.split("\n");
  const blocks: Block[] = [];
  
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    
    // Check for code block
    if (line.startsWith("```")) {
      let codeContent = line;
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeContent += "\n" + lines[i];
        i++;
      }
      if (i < lines.length) {
        codeContent += "\n" + lines[i];
        i++;
      }
      blocks.push({
        id: genId(),
        type: "code",
        raw: codeContent,
      });
      continue;
    }
    
    // Check for quote (multi-line)
    if (line.startsWith(">")) {
      let quoteContent = line;
      i++;
      while (i < lines.length && lines[i].startsWith(">")) {
        quoteContent += "\n" + lines[i];
        i++;
      }
      blocks.push({
        id: genId(),
        type: "quote",
        raw: quoteContent,
      });
      continue;
    }
    
    // Regular line
    blocks.push({
      id: genId(),
      type: detectType(line),
      raw: line,
    });
    i++;
  }
  
  // Ensure at least one block
  if (blocks.length === 0) {
    blocks.push({
      id: genId(),
      type: "paragraph",
      raw: "",
    });
  }
  
  return blocks;
}

/**
 * Serialize blocks back to markdown
 */
export function blocksToMarkdown(blocks: Block[]): string {
  return blocks.map((block) => block.raw).join("\n");
}
