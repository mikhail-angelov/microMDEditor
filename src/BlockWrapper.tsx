// BlockWrapper - React-safe boundary for contentEditable blocks
// Uses two-layer approach: decoration layer (visual) + editable layer (input)

import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useRef, useEffect, useCallback } from "react";
import { Block, PluginResult } from "./types";
import { getPlugin } from "./plugins";
import { DecorationLayer } from "./DecorationLayer";
import { detectType } from "./utils";
import {
  getSelectionOffsets,
  isCaretAtStart,
  isCaretAtEnd,
  createDeltaTransform,
  applyTextMutation,
  SelectionTransform,
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

type LineInfo = {
  start: number;
  end: number;
  text: string;
};

function getLineAtOffset(text: string, offset: number): LineInfo {
  const clamped = Math.max(0, Math.min(offset, text.length));
  const start = text.lastIndexOf("\n", Math.max(0, clamped - 1)) + 1;
  const nextNewline = text.indexOf("\n", clamped);
  const end = nextNewline === -1 ? text.length : nextNewline;
  return {
    start,
    end,
    text: text.slice(start, end),
  };
}

function removeCurrentLine(text: string, line: LineInfo): { text: string; cursorOffset: number } {
  const hasPrev = line.start > 0;
  const hasNext = line.end < text.length;

  if (!hasPrev && !hasNext) {
    return { text: "", cursorOffset: 0 };
  }

  if (!hasPrev) {
    const nextStart = Math.min(text.length, line.end + 1);
    return { text: text.slice(nextStart), cursorOffset: 0 };
  }

  if (!hasNext) {
    return { text: text.slice(0, line.start - 1), cursorOffset: line.start - 1 };
  }

  return {
    text: text.slice(0, line.start) + text.slice(line.end + 1),
    cursorOffset: line.start,
  };
}

function getMarkerOnlyBackspaceResult(text: string, caretOffset: number): PluginResult {
  const line = getLineAtOffset(text, caretOffset);
  const trimmedLine = line.text.trimEnd();

  if (trimmedLine === "-" || trimmedLine === "*") {
    const isCaretAtLineEnd = caretOffset >= line.start + line.text.length;
    if (isCaretAtLineEnd) {
      const next = removeCurrentLine(text, line);
      return { type: "update", text: next.text, cursorOffset: next.cursorOffset };
    }
  }

  if (/^\d+\.$/.test(trimmedLine)) {
    const isCaretAtLineEnd = caretOffset >= line.start + line.text.length;
    if (isCaretAtLineEnd) {
      const next = removeCurrentLine(text, line);
      return { type: "update", text: next.text, cursorOffset: next.cursorOffset };
    }
  }

  return { type: "none" };
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

  const applyPluginResult = useCallback(
    (result: PluginResult, caretOffset?: number) => {
      if (!editableRef.current || result.type === "none") return;

      isApplyingPluginRef.current = true;

      if (result.type === "update") {
        const newText = result.text;
        const offsetToUse = result.cursorOffset !== undefined ? result.cursorOffset : caretOffset;

        const transform: SelectionTransform =
          offsetToUse !== undefined
            ? () => ({ start: offsetToUse, end: offsetToUse })
            : () => {
                const textLength = newText.length;
                return { start: textLength, end: textLength };
              };

        applyTextMutation(editableRef.current, newText, transform);
        lastTextRef.current = newText;
        isApplyingPluginRef.current = false;
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
    [block.id, onChange, onSplit, onMergeWithPrevious]
  );

  const handleInput = useCallback(() => {
    if (!editableRef.current || isApplyingPluginRef.current) return;

    let text = editableRef.current.textContent || "";

    if (text.endsWith("\n") && !block.raw.endsWith("\n")) {
      text = text.slice(0, -1);
    }

    const plugin = getPlugin(text, block.type);

    if (plugin.normalize) {
      const result = plugin.normalize(text);
      if (result.text !== text) {
        const transform = createDeltaTransform(result.delta);
        applyTextMutation(editableRef.current, result.text, transform);
        text = result.text;
      }
    }

    lastTextRef.current = text;
    onChange(block.id, text);
  }, [block.id, block.raw, block.type, onChange]);

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      if (!editableRef.current) return;

      const text = editableRef.current.textContent || "";
      const plugin = getPlugin(text, block.type);
      const selectionSnapshot = getSelectionOffsets(editableRef.current);

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
          onSplit(block.id, text.slice(0, selectionSnapshot.start), text.slice(selectionSnapshot.start));
        }
        return;
      }

      if (e.key === "Backspace" && selectionSnapshot.isInsideRoot && selectionSnapshot.isCollapsed) {
        if (plugin.onBackspace) {
          const sel = window.getSelection();
          const result = plugin.onBackspace({
            text,
            selection: sel!,
            root: editableRef.current,
          });

          if (result.type !== "none") {
            e.preventDefault();
            applyPluginResult(result, selectionSnapshot.start);
            return;
          }
        }

        const markerOnlyResult = getMarkerOnlyBackspaceResult(text, selectionSnapshot.start);
        if (markerOnlyResult.type !== "none") {
          e.preventDefault();
          applyPluginResult(markerOnlyResult, selectionSnapshot.start);
          return;
        }

        if (selectionSnapshot.start === 0) {
          e.preventDefault();
          if (text.length === 0) {
            onDelete(block.id);
          } else {
            onMergeWithPrevious(block.id);
          }
          return;
        }
      }

      if (e.key === "ArrowUp" && isCaretAtStart(editableRef.current)) {
        e.preventDefault();
        onFocusPrevious(block.id, true);
        return;
      }

      if (e.key === "ArrowDown" && isCaretAtEnd(editableRef.current)) {
        e.preventDefault();
        onFocusNext(block.id);
      }
    },
    [block.id, block.type, applyPluginResult, onSplit, onDelete, onMergeWithPrevious, onFocusNext, onFocusPrevious]
  );

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
