// Plugin system for block-level behavior

import { BlockPlugin, PluginCtx, PluginResult } from "./types";
import { getCaretOffset } from "./utils";

function getCurrentLineBounds(text: string, offset: number) {
  const safeOffset = Math.max(0, Math.min(offset, text.length));
  const lineStart = text.lastIndexOf("\n", Math.max(0, safeOffset - 1)) + 1;
  const nextNewline = text.indexOf("\n", safeOffset);
  const lineEnd = nextNewline === -1 ? text.length : nextNewline;

  return {
    lineStart,
    lineEnd,
    line: text.slice(lineStart, lineEnd),
  };
}

function removeCurrentLine(text: string, lineStart: number, lineEnd: number) {
  if (lineStart === 0 && lineEnd === text.length) {
    return { text: "", cursorOffset: 0 };
  }

  if (lineStart === 0) {
    const nextStart = Math.min(text.length, lineEnd + 1);
    return {
      text: text.slice(nextStart),
      cursorOffset: 0,
    };
  }

  const removeFrom = lineStart - 1;
  return {
    text: text.slice(0, removeFrom) + text.slice(lineEnd),
    cursorOffset: removeFrom,
  };
}

/**
 * Paragraph Plugin - default fallback
 */
export const ParagraphPlugin: BlockPlugin = {
  type: "paragraph",

  match: () => true,

  onEnter(ctx: PluginCtx): PluginResult {
    const offset = getCaretOffset(ctx.root, ctx.selection);

    return {
      type: "split",
      before: ctx.text.slice(0, offset),
      after: ctx.text.slice(offset),
    };
  },
};

/**
 * Heading Plugin - handles # ## ### etc.
 */
export const HeadingPlugin: BlockPlugin = {
  type: "heading",

  match(text: string): boolean {
    return /^#{1,6}\s/.test(text);
  },

  onEnter(ctx: PluginCtx): PluginResult {
    const offset = getCaretOffset(ctx.root, ctx.selection);

    return {
      type: "split",
      before: ctx.text.slice(0, offset),
      after: ctx.text.slice(offset),
    };
  },

  onBackspace(ctx: PluginCtx): PluginResult {
    // Match heading prefix like "# ", "## ", etc.
    const match = ctx.text.match(/^(#{1,6})\s?$/);
    if (match) {
      // Remove the heading prefix
      return {
        type: "update",
        text: "",
      };
    }
    return { type: "none" };
  },
};

/**
 * Quote Plugin - handles > blockquotes
 */
export const QuotePlugin: BlockPlugin = {
  type: "quote",

  match(text: string): boolean {
    return /^>\s?/.test(text);
  },

  normalize(text: string): { text: string; delta: number } {
    const lines = text.split("\n");
    let totalDelta = 0;

    const normalizedLines = lines.map((line) => {
      if (line.trim() === "") {
        // Empty line becomes "> " - adds 2 characters
        totalDelta += 2;
        return "> ";
      }

      if (line.startsWith(">")) {
        // Already starts with >, no change
        return line;
      }

      // Add "> " prefix - adds 2 characters
      totalDelta += 2;
      return `> ${line}`;
    });

    return {
      text: normalizedLines.join("\n"),
      delta: totalDelta,
    };
  },

  onEnter(ctx: PluginCtx): PluginResult {
    const offset = getCaretOffset(ctx.root, ctx.selection);

    const before = ctx.text.slice(0, offset);
    const after = ctx.text.slice(offset);

    // Add newline with quote prefix
    const newText = before + "\n> " + after;
    return {
      type: "update",
      text: newText,
      cursorOffset: before.length + 3, // Position after "> " ("> " is 2 chars + newline)
    };
  },

  onBackspace(ctx: PluginCtx): PluginResult {
    const { text } = ctx;

    // Exit quote if empty
    if (text.trim() === ">" || text.trim() === "> ") {
      return {
        type: "update",
        text: "",
      };
    }

    return { type: "none" };
  },
};

/**
 * List Plugin - handles - and * list items
 */
export const ListPlugin: BlockPlugin = {
  type: "list",

  match(text: string): boolean {
    return /^[-*]\s/.test(text);
  },

  normalize(text: string): { text: string; delta: number } {
    const lines = text.split("\n");
    let totalDelta = 0;

    const normalizedLines = lines.map((line) => {
      if (line.trim() === "") {
        // Empty line becomes "- " - adds 2 characters
        totalDelta += 2;
        return "- ";
      }

      if (/^[-*]\s/.test(line)) {
        // Already starts with - or *, no change
        return line;
      }

      // Add "- " prefix - adds 2 characters
      totalDelta += 2;
      return `- ${line}`;
    });

    return {
      text: normalizedLines.join("\n"),
      delta: totalDelta,
    };
  },

  onEnter(ctx: PluginCtx): PluginResult {
    const offset = getCaretOffset(ctx.root, ctx.selection);
    const { lineStart, lineEnd, line } = getCurrentLineBounds(ctx.text, offset);

    const before = ctx.text.slice(0, offset);
    const after = ctx.text.slice(offset);

    // Check if we're at the end of an empty list item
    if (/^[-*]\s?$/.test(line) && offset >= lineStart + line.length) {
      // If it's the last line in the block, convert to paragraph (remove marker)
      // Otherwise, remove the entire line (old behavior)
      if (lineEnd === ctx.text.length) {
        // Last line: convert to paragraph by removing just the marker
        const markerLength = line.endsWith(" ") ? 3 : 2;
        const newText =
          ctx.text.slice(0, lineStart - 1) +
          ctx.text.slice(lineStart + markerLength);

        return {
          type: "split",
          before: newText,
          after: "",
        };
      }
      // Not last line: remove the entire line (old behavior)
      const result = removeCurrentLine(ctx.text, lineStart, lineEnd);
      return {
        type: "update",
        text: result.text,
        cursorOffset: result.cursorOffset,
      };
    }

    // Add newline with list prefix
    const newText = before + "\n- " + after;
    return {
      type: "update",
      text: newText,
      cursorOffset: before.length + 3, // Position after "- " ("- " is 2 chars + newline)
    };
  },

  onBackspace(ctx: PluginCtx): PluginResult {
    if (!ctx.selection.isCollapsed) {
      return { type: "none" };
    }

    const { text } = ctx;
    const offset = getCaretOffset(ctx.root, ctx.selection);
    const { lineStart, lineEnd, line } = getCurrentLineBounds(text, offset);
    
    // Check if we're at the end of an empty list item
    if (/^[-*]\s?$/.test(line) && offset >= lineStart + line.length) {
      // If it's the last line in the block, convert to paragraph (remove marker)
      // Otherwise, remove the entire line (old behavior)
      if (lineEnd === text.length) {
        // If it's the last and only line in the block
        if (lineStart === 0) {
          return {
            type: "update",
            text: "",
            cursorOffset: 0, // Fixed: cursor should be at position 0, not 2
          };
        }
        // Last line: convert to paragraph by removing just the marker
        // Need to remove newline before the line too
        const markerLength = line.endsWith(" ") ? 2 : 1;
        const newText = text.slice(0, lineStart - 1) + text.slice(lineStart + markerLength);
        return {
          type: "split",
          before: newText,
          after: "",
        };
      }
      // Not last line: remove the entire line (old behavior)
      const result = removeCurrentLine(text, lineStart, lineEnd);
      return {
        type: "update",
        text: result.text,
        cursorOffset: result.cursorOffset,
      };
    }
    
    // Handle Backspace at beginning of text in list item (cursor right after marker)
    // Example: "- text" with cursor between "- " and "text" (offset = lineStart + 2)
    // Should delete the space, resulting in "-text"
    // Example: "-text" (no space) with cursor between "-" and "t" (offset = lineStart + 1)
    // Should delete the "-" marker, resulting in "text"
    if (line.length > 0 && (line[0] === "-" || line[0] === "*")) {
      const cursorInLine = offset - lineStart;

      // Cursor is right after marker (position 1 for "-" or 2 for "- ")
      if (cursorInLine === 1) {
        // Cursor right after "-" (could be "-text" or "- text")
        if (line.length > 1 && line[1] === " ") {
          // "- text": delete the space
          const newLine = "-" + line.slice(2);
          const newText = text.slice(0, lineStart) + newLine + text.slice(lineEnd);
          return {
            type: "update",
            text: newText,
            cursorOffset: lineStart + 1, // Cursor stays after "-"
          };
        } else {
          // "-text": delete the "-" marker
          const newLine = line.slice(1);
          if (lineStart === 0) {
            // First line: split from rest of list
            const newList = text.slice(lineEnd);
            return {
              type: "split",
              before: newLine,
              after: newList,
            };
          }
          const newText = text.slice(0, lineStart - 1) + newLine + text.slice(lineEnd);
          return {
            type: "update",
            text: newText,
            cursorOffset: lineStart - 1, // Cursor at beginning of line (where "-" was)
          };
        }
      } else if (cursorInLine === 2 && line.length >= 2 && line[1] === " ") {
        // Cursor after "- " (space exists)
        const newLine = "-" + line.slice(2); // Remove the space
        const newText = text.slice(0, lineStart) + newLine + text.slice(lineEnd);
        return {
          type: "update",
          text: newText,
          cursorOffset: lineStart + 1, // Cursor after "-"
        };
      }
    }

    return { type: "none" };
  },
};

/**
 * Ordered List Plugin - handles 1. 2. etc.
 */
export const OrderedListPlugin: BlockPlugin = {
  type: "ordered-list",

  match(text: string): boolean {
    return /^\d+\.\s/.test(text);
  },

  onEnter(ctx: PluginCtx): PluginResult {
    const offset = getCaretOffset(ctx.root, ctx.selection);
    const { lineStart, lineEnd, line } = getCurrentLineBounds(ctx.text, offset);

    const before = ctx.text.slice(0, offset);
    const after = ctx.text.slice(offset);

    // Check if we're at the end of an empty ordered list item
    if (/^\d+\.\s?$/.test(line) && offset >= lineStart + line.length) {
      // If it's the last line in the block, convert to paragraph (remove marker)
      // Otherwise, remove the entire line (old behavior)
      if (lineEnd === ctx.text.length) {
        // Last line: convert to paragraph by removing just the marker
        const match = line.match(/^(\d+)(\.)(\s?)/);
        if (match) {
          const [fullMatch, number, dot, space] = match;
          const markerLength = number.length + dot.length + (space ? 1 : 0);
          const newText =
            ctx.text.slice(0, lineStart) +
            ctx.text.slice(lineStart + markerLength);
          return {
            type: "update",
            text: newText,
            cursorOffset: lineStart, // Cursor stays at beginning of line
          };
        }
      } else {
        // Not last line: remove the entire line (old behavior)
        const result = removeCurrentLine(ctx.text, lineStart, lineEnd);
        return {
          type: "update",
          text: result.text,
          cursorOffset: result.cursorOffset,
        };
      }
    }

    // Extract current number and increment
    const match = ctx.text.match(/^(\d+)\./);
    const nextNum = match ? parseInt(match[1], 10) + 1 : 1;

    // Calculate prefix length (e.g., "1. " is 3 chars, "10. " is 4 chars)
    const prefixLength = `${nextNum}. `.length;
    const newText = before + `\n${nextNum}. ` + after;

    return {
      type: "update",
      text: newText,
      cursorOffset: before.length + 1 + prefixLength, // Position after prefix (newline + prefix)
    };
  },

  onBackspace(ctx: PluginCtx): PluginResult {
    if (!ctx.selection.isCollapsed) {
      return { type: "none" };
    }

    const { text } = ctx;
    const offset = getCaretOffset(ctx.root, ctx.selection);
    const { lineStart, lineEnd, line } = getCurrentLineBounds(text, offset);

    // Check if we're at the end of an empty ordered list item
    if (/^\d+\.\s?$/.test(line) && offset >= lineStart + line.length) {
      // If it's the last line in the block, convert to paragraph (remove marker)
      // Otherwise, remove the entire line (old behavior)
      if (lineEnd === text.length) {
        // Last line: convert to paragraph by removing just the marker
        const match = line.match(/^(\d+)(\.)(\s?)/);
        if (match) {
          const [fullMatch, number, dot, space] = match;
          const markerLength = number.length + dot.length + (space ? 1 : 0);
          const newText =
            text.slice(0, lineStart) + text.slice(lineStart + markerLength);
          return {
            type: "update",
            text: newText,
            cursorOffset: lineStart, // Cursor stays at beginning of line
          };
        }
      } else {
        // Not last line: remove the entire line (old behavior)
        const result = removeCurrentLine(text, lineStart, lineEnd);
        return {
          type: "update",
          text: result.text,
          cursorOffset: result.cursorOffset,
        };
      }
    }
    
    // Handle Backspace at beginning of text in ordered list item
    // Example: "1. text" with cursor between "1. " and "text"
    // Should delete the space, resulting in "1.text"
    if (line.length > 0 && /^\d+\./.test(line)) {
      const cursorInLine = offset - lineStart;
      const match = line.match(/^(\d+)(\.)(\s?)/);
      
      if (match) {
        const [fullMatch, number, dot, space] = match;
        const prefixLength = number.length + dot.length + (space ? 1 : 0);
        
        // Cursor is right after the prefix (after "1." or "1. ")
        if (cursorInLine === prefixLength) {
          // Delete the space if it exists
          if (space) {
            const newLine = number + dot + line.slice(prefixLength);
            const newText = text.slice(0, lineStart) + newLine + text.slice(lineEnd);
            return {
              type: "update",
              text: newText,
              cursorOffset: lineStart + number.length + dot.length, // Cursor after "1."
            };
          }
        } else if (cursorInLine === number.length + dot.length && !space) {
          // Cursor right after "1." (no space), delete the "."
          const newLine = number + line.slice(number.length + dot.length);
          if (lineStart === 0) {
            // First line: split from rest of list
            const newList = text.slice(lineEnd);
            return {
              type: "split",
              before: newLine,
              after: newList,
            };
          }
          const newText = text.slice(0, lineStart - 1) + newLine + text.slice(lineEnd);
          return {
            type: "update",
            text: newText,
            cursorOffset: lineStart - 1, // Cursor at beginning of line
          };
        }
      }
    }

    return { type: "none" };
  },
};

/**
 * Code Block Plugin - handles ``` code blocks
 */
export const CodeBlockPlugin: BlockPlugin = {
  type: "code",

  match(text: string): boolean {
    // Check if text starts with ``` (opening marker)
    // OR if it contains ``` anywhere (could be multi-line code block)
    // We need to handle multi-line code blocks as atomic blocks
    const lines = text.split("\n");

    // If any line starts with ```, treat as code block
    for (const line of lines) {
      if (line.trim().startsWith("```")) {
        return true;
      }
    }

    return false;
  },

  normalize(text: string): { text: string; delta: number } {
    return { text, delta: 0 }; // No transform for code
  },

  onEnter(ctx: PluginCtx): PluginResult {
    const offset = getCaretOffset(ctx.root, ctx.selection);

    const before = ctx.text.slice(0, offset);
    const after = ctx.text.slice(offset);

    // Find the current line in 'before'
    const lines = before.split("\n");
    const currentLine = lines[lines.length - 1];

    // For code blocks, we need to handle lines with ``` markers specially
    // Check if line contains ``` (could be opening or closing marker)
    // We need to check if the line (after trimming whitespace) starts with ```
    const trimmedLine = currentLine.trim();
    let indentation = "";

    // Only calculate indentation if this is not a ``` marker line
    if (!trimmedLine.startsWith("```")) {
      // Calculate indentation of current line (only whitespace at start)
      const match = currentLine.match(/^(\s*)/);
      indentation = match ? match[1] : "";
    }

    // Insert newline with preserved indentation (if any)
    const newText = before + "\n" + indentation + after;

    // Calculate cursor position (after newline and indentation)
    const cursorOffset = before.length + 1 + indentation.length;

    return {
      type: "update",
      text: newText,
      cursorOffset,
    };
  },

  onBackspace(ctx: PluginCtx): PluginResult {
    if (ctx.text === "```") {
      return {
        type: "update",
        text: "",
      };
    }

    return { type: "none" };
  },
};

/**
 * Plugin registry - order matters, first match wins
 */
export const plugins: BlockPlugin[] = [
  HeadingPlugin,
  QuotePlugin,
  ListPlugin,
  OrderedListPlugin,
  CodeBlockPlugin,
  ParagraphPlugin, // Fallback - always matches
];

/**
 * Get the appropriate plugin for a given text
 * Optionally consider current type for sticky behavior
 */
export function getPlugin(text: string, currentType?: string): BlockPlugin {
  // If we have a current type, try to find that plugin first
  if (currentType) {
    const currentPlugin = plugins.find((p) => p.type === currentType);
    if (currentPlugin) {
      // For sticky behavior, we should check if the current plugin still matches
      // OR if we're in a "partial edit" state (e.g., removed ">" from quote but still want quote)
      // For now, we'll use a simple approach: if current plugin matches, use it
      if (currentPlugin.match(text)) {
        return currentPlugin;
      }
    }
  }

  // Otherwise, find the first matching plugin
  return plugins.find((p) => p.match(text)) || ParagraphPlugin;
}
