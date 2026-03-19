// MicroMDEditor - Main editor component
// Notion-style architecture: React controls structure, browser controls content

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Block, MicroMDEditorProps, Theme } from "./types";
import { BlockWrapper } from "./BlockWrapper";
import { parseMarkdown, blocksToMarkdown, genId, detectType, placeCaretAtEnd, placeCaretAtOffset } from "./utils";

export function MicroMDEditor({
  initialMarkdown = "",
  onChange,
  className,
  style,
  theme = "light",
}: MicroMDEditorProps) {
  // Parse initial markdown into blocks
  const [blocks, setBlocks] = useState<Block[]>(() =>
    parseMarkdown(initialMarkdown)
  );

  // Track block refs for focus management
  const blockRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  // Track which block should receive focus after render
  const pendingFocus = useRef<{ blockId: string; atEnd?: boolean; offset?: number } | null>(null);

  // Register block ref
  const registerRef = useCallback((id: string, ref: HTMLDivElement | null) => {
    if (ref) {
      blockRefs.current.set(id, ref);
    } else {
      blockRefs.current.delete(id);
    }
  }, []);

  // Apply pending focus after render
  useEffect(() => {
    if (pendingFocus.current) {
      const { blockId, atEnd, offset } = pendingFocus.current;
      const ref = blockRefs.current.get(blockId);
      
      if (ref) {
        ref.focus();
        
        if (offset !== undefined) {
          placeCaretAtOffset(ref, offset);
        } else if (atEnd) {
          placeCaretAtEnd(ref);
        } else {
          // Place at start
          placeCaretAtOffset(ref, 0);
        }
      }
      
      pendingFocus.current = null;
    }
  });

  // Notify parent of changes
  useEffect(() => {
    if (onChange) {
      const markdown = blocksToMarkdown(blocks);
      onChange(markdown);
    }
  }, [blocks, onChange]);

  // Update a single block
  const updateBlock = useCallback((id: string, raw: string) => {
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === id ? { ...b, raw, type: detectType(raw) } : b
      )
    );
  }, []);

  // Split a block at cursor position
  const splitBlock = useCallback((id: string, before: string, after: string) => {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      if (idx === -1) return prev;

      const newId = genId();

      // Schedule focus on the new block
      pendingFocus.current = { blockId: newId, atEnd: false };

      return [
        ...prev.slice(0, idx),
        { ...prev[idx], raw: before, type: detectType(before) },
        { id: newId, type: detectType(after), raw: after },
        ...prev.slice(idx + 1),
      ];
    });
  }, []);

  // Delete a block
  const deleteBlock = useCallback((id: string) => {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      if (idx === -1) return prev;

      // Focus previous block
      if (idx > 0) {
        pendingFocus.current = { blockId: prev[idx - 1].id, atEnd: true };
      }

      // Don't delete the last block
      if (prev.length === 1) {
        return [{ ...prev[0], raw: "", type: "paragraph" }];
      }

      return [...prev.slice(0, idx), ...prev.slice(idx + 1)];
    });
  }, []);

  // Merge with previous block
  const mergeWithPrevious = useCallback((id: string) => {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      if (idx <= 0) return prev;

      const currentBlock = prev[idx];
      const previousBlock = prev[idx - 1];
      const mergedRaw = previousBlock.raw + currentBlock.raw;

      // Focus at the merge point
      pendingFocus.current = {
        blockId: previousBlock.id,
        offset: previousBlock.raw.length,
      };

      return [
        ...prev.slice(0, idx - 1),
        { ...previousBlock, raw: mergedRaw, type: detectType(mergedRaw) },
        ...prev.slice(idx + 1),
      ];
    });
  }, []);

  // Focus next block
  const focusNext = useCallback((currentId: string) => {
    const idx = blocks.findIndex((b) => b.id === currentId);
    if (idx < blocks.length - 1) {
      pendingFocus.current = { blockId: blocks[idx + 1].id, atEnd: false };
      // Force re-render to apply focus
      setBlocks((prev) => [...prev]);
    }
  }, [blocks]);

  // Focus previous block
  const focusPrevious = useCallback((currentId: string, atEnd = false) => {
    const idx = blocks.findIndex((b) => b.id === currentId);
    if (idx > 0) {
      pendingFocus.current = { blockId: blocks[idx - 1].id, atEnd };
      // Force re-render to apply focus
      setBlocks((prev) => [...prev]);
    }
  }, [blocks]);

  // Determine actual theme (handle "auto" by checking prefers-color-scheme)
  const [actualTheme, setActualTheme] = useState<"light" | "dark">(() => {
    if (theme === "auto") {
      // Check if window is available (for SSR)
      if (typeof window !== "undefined" && window.matchMedia) {
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      }
      return "light"; // Default to light if window is not available
    }
    return theme;
  });

  // Update theme when prop changes or system preference changes (for "auto" mode)
  useEffect(() => {
    if (theme === "auto") {
      // Handle system preference changes
      if (typeof window !== "undefined" && window.matchMedia) {
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        const handleChange = (e: MediaQueryListEvent) => {
          setActualTheme(e.matches ? "dark" : "light");
        };
        
        mediaQuery.addEventListener("change", handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
      }
    } else {
      // Direct theme change (light or dark)
      setActualTheme(theme);
    }
  }, [theme]);

  return (
    <div
      className={`micro-md-editor micro-md-editor-${actualTheme} ${className || ""}`}
      style={{
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        fontSize: "16px",
        lineHeight: "1.6",
        padding: "16px",
        ...style,
      }}
    >
      {/* CSS for decorations with theme support */}
      <style>{`
        /* Light theme (default) */
        .micro-md-editor-light {
          --mmd-bg: #ffffff;
          --mmd-text: #1a1a1a;
          --mmd-border: #e0e0e0;
          --mmd-placeholder: #aaa;
          --mmd-code-bg: rgba(0, 0, 0, 0.06);
          --mmd-code-text: #1a1a1a;
          --mmd-link: #0066cc;
          --mmd-quote-border: #ddd;
          --mmd-quote-text: #555;
          --mmd-syntax-opacity: 0.4;
          --mmd-selection-bg: rgba(0, 123, 255, 0.2);
        }

        /* Dark theme */
        .micro-md-editor-dark {
          --mmd-bg: #1a1a1a;
          --mmd-text: #f0f0f0;
          --mmd-border: #444;
          --mmd-placeholder: #888;
          --mmd-code-bg: rgba(255, 255, 255, 0.1);
          --mmd-code-text: #f0f0f0;
          --mmd-link: #66b3ff;
          --mmd-quote-border: #666;
          --mmd-quote-text: #ccc;
          --mmd-syntax-opacity: 0.6;
          --mmd-selection-bg: rgba(100, 181, 246, 0.3);
        }

        .micro-md-editor {
          background-color: var(--mmd-bg);
          color: var(--mmd-text);
          transition: background-color 0.2s ease, color 0.2s ease;
        }

        .micro-md-editor .md-syntax {
          opacity: var(--mmd-syntax-opacity);
        }

        .micro-md-editor .md-decorations strong {
          font-weight: bold;
        }

        .micro-md-editor .md-decorations em {
          font-style: italic;
        }

        .micro-md-editor .md-decorations .inline-code {
          font-family: monospace;
          background: var(--mmd-code-bg);
          color: var(--mmd-code-text);
          padding: 2px 4px;
          border-radius: 3px;
        }

        .micro-md-editor .md-decorations .md-link {
          color: var(--mmd-link);
          text-decoration: underline;
        }

        .micro-md-editor [data-placeholder]:empty::before {
          content: attr(data-placeholder);
          color: var(--mmd-placeholder);
          pointer-events: none;
        }

        .micro-md-editor [data-block-id] {
          margin-bottom: 4px;
        }

        .micro-md-editor .md-decorations,
        .micro-md-editor .md-editable {
          font: inherit;
          line-height: inherit;
        }

        /* Block-specific styling */
        .micro-md-editor [data-block-type="quote"] {
          border-left: 3px solid var(--mmd-quote-border);
          padding-left: 12px;
          color: var(--mmd-quote-text);
        }

        .micro-md-editor [data-block-type="code"] {
          font-family: monospace;
          background: var(--mmd-code-bg);
          padding: 12px;
          border-radius: 4px;
          white-space: pre;
          overflow-x: auto;
        }

        .micro-md-editor [data-block-type="heading"] {
          font-weight: 600;
        }

        .micro-md-editor [data-block-type="heading"][data-heading-level="1"] {
          font-size: 2em;
          margin-top: 0.67em;
          margin-bottom: 0.67em;
        }

        .micro-md-editor [data-block-type="heading"][data-heading-level="2"] {
          font-size: 1.5em;
          margin-top: 0.83em;
          margin-bottom: 0.83em;
        }

        .micro-md-editor [data-block-type="heading"][data-heading-level="3"] {
          font-size: 1.17em;
          margin-top: 1em;
          margin-bottom: 1em;
        }

        /* Selection styling */
        .micro-md-editor .md-editable::selection {
          background-color: var(--mmd-selection-bg);
        }

        .micro-md-editor .md-editable::-moz-selection {
          background-color: var(--mmd-selection-bg);
        }
      `}</style>

      {blocks.map((block) => (
        <BlockWrapper
          key={block.id}
          block={block}
          onChange={updateBlock}
          onSplit={splitBlock}
          onMergeWithPrevious={mergeWithPrevious}
          onFocusNext={focusNext}
          onFocusPrevious={focusPrevious}
          onDelete={deleteBlock}
          registerRef={registerRef}
        />
      ))}
    </div>
  );
}

export default MicroMDEditor;
