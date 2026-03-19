// BlockWrapper - React-safe boundary for contentEditable blocks
// Uses two-layer approach: decoration layer (visual) + editable layer (input)

import React, { useRef, useEffect, useCallback } from "react";
import { Block, PluginResult } from "./types";
import { getPlugin } from "./plugins";
import { DecorationLayer } from "./DecorationLayer";
import { getCaretOffset, placeCaretAtEnd, placeCaretAtOffset, detectType } from "./utils";
import { 
  getSelectionOffsets, 
  restoreSelectionOffsets, 
  isCaretAtStart, 
  isCaretAtEnd,
  createDeltaTransform,
  applyTextMutation,
  SelectionTransform
} from "./selection";

interface BlockWrapperProps {
  block: Block;
  onChange: (id: string, raw: string) => void;
  onSplit: (id: string, before: string, after: string) => void;
  onMergeWithPrevious: (id: string) => void;
  onFocusNext: (id: string) => void;
  onFocusPrevious: (id: string, atEnd?: boolean) => void;
  onDelete: (id: string) => void;
  registerRef: (id: string, ref: HTMLDivElement | null) => void;
}

export function BlockWrapper({
  block,
  onChange,
  onSplit,
  onMergeWithPrevious,
  onFocusNext,
  onFocusPrevious,
  onDelete,
  registerRef,
}: BlockWrapperProps) {
  const editableRef = useRef<HTMLDivElement>(null);
  const lastTextRef = useRef<string>(block.raw);
  const isApplyingPluginRef = useRef<boolean>(false);

  // Register ref with parent
  useEffect(() => {
    registerRef(block.id, editableRef.current);
    return () => registerRef(block.id, null);
  }, [block.id, registerRef]);

  // Set initial content (only on mount or id change)
  useEffect(() => {
    if (!editableRef.current) return;

    // Only set if different to avoid cursor jump
    // Use textContent instead of innerText for accurate whitespace handling
    if (editableRef.current.textContent !== block.raw) {
      editableRef.current.textContent = block.raw;
      lastTextRef.current = block.raw;
    }
  }, [block.id]);

  // Apply plugin result
  const applyPluginResult = useCallback(
    (result: PluginResult, caretOffset?: number) => {
      if (!editableRef.current) return;

      if (result.type === "none") return;

      // Set flag to prevent handleInput from interfering
      isApplyingPluginRef.current = true;

      if (result.type === "update") {
        // Store the text and cursor position
        const newText = result.text;
        const offsetToUse = result.cursorOffset !== undefined ? result.cursorOffset : caretOffset;
        
        // Create a selection transform based on cursor offset
        const transform: SelectionTransform = offsetToUse !== undefined
          ? () => ({ start: offsetToUse, end: offsetToUse })
          : (oldStart, oldEnd) => {
              // If no cursor offset provided, place at end
              const textLength = newText.length;
              return { start: textLength, end: textLength };
            };
        
        // Use applyTextMutation helper which handles selection preservation
        // and avoids unnecessary textContent rewrites
        applyTextMutation(editableRef.current, newText, transform);
        lastTextRef.current = newText;
        
        // Reset flag after mutation is applied
        isApplyingPluginRef.current = false;
        onChange(block.id, newText);
      }

      if (result.type === "split") {
        onSplit(block.id, result.before, result.after);
        isApplyingPluginRef.current = false;
      }

      if (result.type === "merge") {
        onMergeWithPrevious(block.id);
        isApplyingPluginRef.current = false;
      }
    },
    [block.id, onChange, onSplit, onMergeWithPrevious]
  );

  // Handle input
  const handleInput = useCallback(() => {
    if (!editableRef.current || isApplyingPluginRef.current) return;

    let text = editableRef.current.textContent || "";

    // Normalize - remove trailing newlines that browsers add
    if (text.endsWith("\n") && !block.raw.endsWith("\n")) {
      text = text.slice(0, -1);
    }

    const plugin = getPlugin(text, block.type);

    // Apply normalization if plugin has it
    if (plugin.normalize) {
      const result = plugin.normalize(text);

      if (result.text !== text) {
        // Use applyTextMutation helper which handles selection preservation
        const transform = createDeltaTransform(result.delta);
        applyTextMutation(editableRef.current!, result.text, transform);
        text = result.text;
      }
    }

    lastTextRef.current = text;
    onChange(block.id, text);
  }, [block.id, block.raw, block.type, onChange]);

  // Handle keydown
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!editableRef.current) return;

      const text = editableRef.current.textContent || "";
      const plugin = getPlugin(text, block.type);
      
      // Use logical selection helpers
      const selectionSnapshot = getSelectionOffsets(editableRef.current);

      // Enter key
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();

        if (plugin.onEnter) {
          const sel = window.getSelection();
          const result = plugin.onEnter({
            text,
            selection: sel!,
            root: editableRef.current,
          });

          applyPluginResult(result, selectionSnapshot.start);
        } else {
          // Default split behavior
          onSplit(block.id, text.slice(0, selectionSnapshot.start), text.slice(selectionSnapshot.start));
        }
        return;
      }

      // Backspace at start - use logical selection check
      if (e.key === "Backspace" && isCaretAtStart(editableRef.current)) {
        // Check if plugin handles this
        if (plugin.onBackspace) {
          const sel = window.getSelection();
          const result = plugin.onBackspace({
            text,
            selection: sel!,
            root: editableRef.current,
          });

          if (result.type !== "none") {
            e.preventDefault();
            applyPluginResult(result);
            return;
          }
        }

        // Merge with previous block
        if (text.length === 0) {
          e.preventDefault();
          onDelete(block.id);
        } else {
          e.preventDefault();
          onMergeWithPrevious(block.id);
        }
        return;
      }

      // Arrow up at start
      if (e.key === "ArrowUp" && isCaretAtStart(editableRef.current)) {
        e.preventDefault();
        onFocusPrevious(block.id, true);
        return;
      }

      // Arrow down at end
      if (e.key === "ArrowDown" && isCaretAtEnd(editableRef.current)) {
        e.preventDefault();
        onFocusNext(block.id);
        return;
      }
    },
    [block.id, block.type, applyPluginResult, onSplit, onDelete, onMergeWithPrevious, onFocusNext, onFocusPrevious]
  );

  // Get block styles based on type
  const getBlockStyle = (): React.CSSProperties => {
    const currentType = detectType(block.raw);

    const baseStyle: React.CSSProperties = {
      position: "relative",
      minHeight: "1.5em",
    };

    switch (currentType) {
      case "heading": {
        const level = (block.raw.match(/^(#+)/)?.[1].length || 1);
        const sizes: Record<number, string> = {
          1: "2em",
          2: "1.5em",
          3: "1.25em",
          4: "1.1em",
          5: "1em",
          6: "0.9em",
        };
        return {
          ...baseStyle,
          fontSize: sizes[level] || "1em",
          fontWeight: "bold",
        };
      }
      case "quote":
        return {
          ...baseStyle,
          borderLeft: "3px solid #ddd",
          paddingLeft: "12px",
          color: "#555",
          fontStyle: "italic",
        };
      case "code":
        return {
          ...baseStyle,
          fontFamily: "monospace",
          background: "#f5f5f5",
          padding: "12px",
          borderRadius: "4px",
          whiteSpace: "pre-wrap",
        };
      case "list":
      case "ordered-list":
        return {
          ...baseStyle,
          paddingLeft: "8px",
        };
      default:
        return baseStyle;
    }
  };

  const blockStyle = getBlockStyle();

  // Get heading level for data attribute
  const getHeadingLevel = () => {
    if (block.type === "heading") {
      const match = block.raw.match(/^(#+)/);
      return match ? match[1].length.toString() : "1";
    }
    return undefined;
  };

  const headingLevel = getHeadingLevel();

  return (
    <div 
      style={{ position: "relative" }} 
      data-block-id={block.id}
      data-block-type={block.type}
      data-heading-level={headingLevel}
    >
      {/* Decoration Layer - visual only, not editable */}
      <div
        className="md-decorations"
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          whiteSpace: "pre-wrap",
          wordWrap: "break-word",
          color: "inherit",
          padding: "inherit",
        }}
      >
        <DecorationLayer text={block.raw} blockType={detectType(block.raw)} />
      </div>

      {/* Editable Layer - user types here */}
      <div
        ref={editableRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        className="md-editable"
        style={{
          position: "relative",
          background: "transparent",
          color: "transparent",
          caretColor: "var(--mmd-text)",
          whiteSpace: "pre-wrap",
          wordWrap: "break-word",
          outline: "none",
          minHeight: "1em",
        }}
        data-placeholder={block.raw === "" ? "Type something..." : undefined}
      />
    </div>
  );
}
