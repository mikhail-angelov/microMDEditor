// micro-md-editor - A Notion-style Markdown editor for React
// Main entry point

export { MicroMDEditor } from "./MicroMDEditor";
export { MicroMDEditor as default } from "./MicroMDEditor";

// Export types
export type {
  Block,
  EditorState,
  LogicalSelection,
  PluginCtx,
  PluginResult,
  Decoration,
  BlockPlugin,
  Token,
  MicroMDEditorProps,
} from "./types";

// Export plugins for extensibility
export {
  ParagraphPlugin,
  HeadingPlugin,
  QuotePlugin,
  ListPlugin,
  OrderedListPlugin,
  CodeBlockPlugin,
  plugins,
  getPlugin,
} from "./plugins";

// Export utilities
export {
  genId,
  escapeHtml,
  getCaretOffset,
  placeCaretAtEnd,
  placeCaretAtOffset,
  detectType,
  parseMarkdown,
  blocksToMarkdown,
} from "./utils";

// Export selection utilities
export {
  getSelectionOffsets,
  restoreSelectionOffsets,
  isCaretAtStart,
  isCaretAtEnd,
  createDeltaTransform,
  applyTextMutation,
  type SelectionTransform,
  type LogicalSelectionSnapshot,
} from "./selection";

// Export tokenizer
export { tokenize, renderDecorations } from "./tokenizer";

// Export BlockWrapper for advanced usage
export { BlockWrapper } from "./BlockWrapper";
