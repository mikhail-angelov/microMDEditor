import { MicroMDEditor as ReactMicroMDEditor } from "./MicroMDEditor";
import type { ComponentChild } from "preact";
import type { MicroMDEditorProps } from "./types";

export const MicroMDEditor = ReactMicroMDEditor as (
  props: MicroMDEditorProps
) => ComponentChild;

export default MicroMDEditor;

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
