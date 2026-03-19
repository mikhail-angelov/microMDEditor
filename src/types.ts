// Core types for the Notion-style Markdown editor

export type Block = {
  id: string;
  type: string;
  raw: string; // last synced value (not live)
};

export type EditorState = {
  blocks: Block[];
};

export type LogicalSelection = {
  blockId: string;
  anchor: number;
  focus: number;
};

// Plugin System Types
export type PluginCtx = {
  text: string;
  selection: Selection;
  root: HTMLElement;
};

export type PluginResult =
  | { type: "none" }
  | { type: "update"; text: string; cursorOffset?: number }
  | { type: "split"; before: string; after: string }
  | { type: "merge" };

export type Decoration = {
  type: string;
  content: string;
  start: number;
  end: number;
};

export type BlockPlugin = {
  type: string;
  match(text: string): boolean;
  normalize?(text: string): { text: string; delta: number };
  onEnter?(ctx: PluginCtx): PluginResult;
  onBackspace?(ctx: PluginCtx): PluginResult;
  decorate?(text: string): Decoration[];
};

// Token types for decoration
export type Token = {
  type: "text" | "bold" | "italic" | "code" | "syntax" | "heading" | "link";
  content: string;
};

// Theme types
export type Theme = "light" | "dark" | "auto";

// Editor Props
export type MicroMDEditorProps = {
  initialMarkdown?: string;
  onChange?: (markdown: string) => void;
  className?: string;
  style?: React.CSSProperties;
  theme?: Theme;
};
