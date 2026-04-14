export type Block = {
  id: string;
  type: string;
  raw: string;
};

export type EditorState = {
  blocks: Block[];
};

export type LogicalSelection = {
  blockId: string;
  anchor: number;
  focus: number;
};

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

export type Token = {
  type: "text" | "bold" | "italic" | "code" | "strike" | "syntax" | "heading" | "link";
  content: string;
};

export type Theme = "light" | "dark" | "auto";

export type EditorStyle = Record<string, string | number | undefined>;

export type MicroMDEditorProps = {
  initialMarkdown?: string;
  onChange?: (markdown: string) => void;
  className?: string;
  style?: EditorStyle;
  theme?: Theme;
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

export type RegisteredBlockRoot = {
  id: string;
  element: HTMLElement;
};

export type ClipboardReplaceResult = {
  blocks: Block[];
  caret: BlockPoint;
};
