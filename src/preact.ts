import {
  MicroMDEditor as ReactMicroMDEditor,
  MicroMDEditorProps,
} from "./MicroMDEditor";
import type { ComponentChild } from "preact";

export const MicroMDEditor = ReactMicroMDEditor as (
  props: MicroMDEditorProps,
) => ComponentChild;

export type { MicroMDEditorProps } from "./MicroMDEditor";
