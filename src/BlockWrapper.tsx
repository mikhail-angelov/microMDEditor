// BlockWrapper - React-safe boundary for contentEditable blocks
// Uses two-layer approach: decoration layer (visual) + editable layer (input)

import React, { useRef, useEffect, useCallback } from "react";
import { Block, PluginResult } from "./types";
import { getPlugin } from "./plugins";
import { DecorationLayer } from "./DecorationLayer";
import { placeCaretAtEnd, detectType } from "./utils";
import { getSelectionOffsets, restoreSelectionOffsets } from "./selection";

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

type SelectionMapper = (start: number, end: number) => { start: number; end: number };

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

  useEffect(() => {
    registerRef(block.id, editableRef.current);
    return () => registerRef(block.id, null);
  }, [block.id, registerRef]);

  useEffect(() => {
    if (!editableRef.current) return;
    if (editableRef.current.textContent !== block.raw) {
      editableRef.current.textContent = block.raw;
      lastTextRef.current = block.raw;
    }
  }, [block.id, block.raw]);

  const applyTextMutation = useCallback(
    (
      nextText: string,
      mapSelection?: SelectionMapper,
      explicitCursorOffset?: number,
      useAnimationFrame: boolean = false
    ) => {
      if (!editableRef.current) return;

      const root = editableRef.current;
      const snapshot = getSelectionOffsets(root);
      const restore = () => {
        if (!editableRef.current) return;
        if (explicitCursorOffset !== undefined) {
          restoreSelectionOffsets(editableRef.current, explicitCursorOffset);
          return;
        }
        if (snapshot.isInsideRoot) {
          const mapped = mapSelection ? mapSelection(snapshot.start, snapshot.end) : snapshot;
          restoreSelectionOffsets(editableRef.current, mapped.start, mapped.end);
        } else {
          placeCaretAtEnd(editableRef.current);
        }
      };

      if (root.textContent !== nextText) {
        root.textContent = nextText;
      }
      lastTextRef.current = nextText;

      if (useAnimationFrame) {
        requestAnimationFrame(restore);
      } else {
        restore();
      }
    },
    []
  );

  const applyPluginResult = useCallback(
    (result: PluginResult) => {
      if (!editableRef.current) return;
      if (result.type === "none") return;

      isApplyingPluginRef.current = true;

      if (result.type === "update") {
        const newText = result.text;
        applyTextMutation(newText, undefined, result.cursorOffset, true);
        requestAnimationFrame(() => {
          isApplyingPluginRef.current = false;
        });
        onChange(block.id, newText);
        return;
      }

      if (result.type === "split") {
        onSplit(block.id, result.before, result.after);
        isApplyingPluginRef.current = false;
        return;
      }

      if (result.type === "merge") {
        onMergeWithPrevious(block.id);
        isApplyingPluginRef.current = false;
      }
    },
    [applyTextMutation, block.id, onChange, onMergeWithPrevious, onSplit]
  );

  const handleInput = useCallback(() => {
    if (!editableRef.current || isApplyingPluginRef.current) return;

    const root = editableRef.current;
    let text = root.textContent || "";

    if (text.endsWith("\n") && !block.raw.endsWith("\n")) {
      text = text.slice(0, -1);
    }

    const plugin = getPlugin(text, block.type);

    if (plugin.normalize) {
      const result = plugin.normalize(text);
      if (result.text !== text) {
        text = result.text;
        const delta = result.delta;
        applyTextMutation(
          result.text,
          (start, end) => ({
            start: Math.max(0, start + delta),
            end: Math.max(0, end + delta),
          })
        );
      }
    }

    lastTextRef.current = text;
    onChange(block.id, text);
  }, [applyTextMutation, block.id, block.raw, block.type, onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!editableRef.current) return;

      const root = editableRef.current;
      const sel = window.getSelection();
      if (!sel) return;

      const text = root.textContent || "";
      const plugin = getPlugin(text, block.type);
      const logicalSel = getSelectionOffsets(root);

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();

        if (plugin.onEnter) {
          const result = plugin.onEnter({
            text,
            selection: sel,
            root,
          });
          applyPluginResult(result);
        } else {
          onSplit(block.id, text.slice(0, logicalSel.start), text.slice(logicalSel.start));
        }
        return;
      }

      if (
        e.key === "Backspace" &&
        logicalSel.isInsideRoot &&
        logicalSel.isCollapsed &&
        logicalSel.start === 0
      ) {
        if (plugin.onBackspace) {
          const result = plugin.onBackspace({
            text,
            selection: sel,
            root,
          });

          if (result.type !== "none") {
            e.preventDefault();
            applyPluginResult(result);
            return;
          }
        }

        e.preventDefault();
        if (text.length === 0) {
          onDelete(block.id);
        } else {
          onMergeWithPrevious(block.id);
        }
        return;
      }

      if (
        e.key === "ArrowUp" &&
        logicalSel.isInsideRoot &&
        logicalSel.isCollapsed &&
        logicalSel.start === 0
      ) {
        e.preventDefault();
        onFocusPrevious(block.id, true);
        return;
      }

      if (
        e.key === "ArrowDown" &&
        logicalSel.isInsideRoot &&
        logicalSel.isCollapsed &&
        logicalSel.end === text.length
      ) {
        e.preventDefault();
        onFocusNext(block.id);
      }
    },
    [block.id, block.type, applyPluginResult, onDelete, onFocusNext, onFocusPrevious, onMergeWithPrevious, onSplit]
  );

  const getBlockStyle = (): React.CSSProperties => {
    const currentType = detectType(block.raw);

    const baseStyle: React.CSSProperties = {
      position: "relative",
      minHeight: "1.5em",
    };

    switch (currentType) {
      case "heading": {
        const level = block.raw.match(/^(#+)/)?.[1].length || 1;
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
      style={{ position: "relative", ...blockStyle }}
      data-block-id={block.id}
      data-block-type={block.type}
      data-heading-level={headingLevel}
    >
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
