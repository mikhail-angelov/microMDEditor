// Plugin system for block-level behavior

import { BlockPlugin, PluginCtx, PluginResult } from "./types";
import { getCaretOffset } from "./utils";

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
    
    const normalizedLines = lines.map((line, index) => {
      if (line.trim() === "") {
        // Empty line becomes "> " - adds 2 characters
        if (index === 0) totalDelta += 2;
        return "> ";
      }
      
      if (line.startsWith(">")) {
        // Already starts with >, no change
        return line;
      }
      
      // Add "> " prefix - adds 2 characters
      if (index === 0) totalDelta += 2;
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
    
    const normalizedLines = lines.map((line, index) => {
      if (line.trim() === "") {
        // Empty line becomes "- " - adds 2 characters
        if (index === 0) totalDelta += 2;
        return "- ";
      }
      
      if (/^[-*]\s/.test(line)) {
        // Already starts with - or *, no change
        return line;
      }
      
      // Add "- " prefix - adds 2 characters
      if (index === 0) totalDelta += 2;
      return `- ${line}`;
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

    // Add newline with list prefix
    const newText = before + "\n- " + after;
    return {
      type: "update",
      text: newText,
      cursorOffset: before.length + 3, // Position after "- " ("- " is 2 chars + newline)
    };
  },

  onBackspace(ctx: PluginCtx): PluginResult {
    const { text } = ctx;

    // Convert to paragraph if only "- " or "* "
    if (text === "- " || text === "* ") {
      return {
        type: "update",
        text: "",
      };
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

    const before = ctx.text.slice(0, offset);
    const after = ctx.text.slice(offset);

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
    const { text } = ctx;

    // Convert to paragraph if only "1. " etc.
    if (/^\d+\.\s$/.test(text)) {
      return {
        type: "update",
        text: "",
      };
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
    const lines = text.split('\n');
    
    // If any line starts with ```, treat as code block
    for (const line of lines) {
      if (line.trim().startsWith('```')) {
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
    const lines = before.split('\n');
    const currentLine = lines[lines.length - 1];
    
    // For code blocks, we need to handle lines with ``` markers specially
    // Check if line contains ``` (could be opening or closing marker)
    // We need to check if the line (after trimming whitespace) starts with ```
    const trimmedLine = currentLine.trim();
    let indentation = '';
    
    // Only calculate indentation if this is not a ``` marker line
    if (!trimmedLine.startsWith('```')) {
      // Calculate indentation of current line (only whitespace at start)
      const match = currentLine.match(/^(\s*)/);
      indentation = match ? match[1] : '';
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
    if (currentPlugin && currentPlugin.match(text)) {
      return currentPlugin;
    }
  }
  
  // Otherwise, find the first matching plugin
  return plugins.find((p) => p.match(text)) || ParagraphPlugin;
}
