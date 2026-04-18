import { h } from "preact";
import { useLayoutEffect, useRef } from "preact/hooks";
import { createEditorCore } from "./core";
import type { EditorCore } from "./core";

export type MicroMDEditorProps = {
  initialMarkdown: string;
  onChange?: (markdown: string) => void;
};

export function MicroMDEditor({ initialMarkdown, onChange }: MicroMDEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const coreRef = useRef<EditorCore | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useLayoutEffect(() => {
    if (!hostRef.current) return;
    coreRef.current = createEditorCore(hostRef.current, {
      initialMarkdown,
      onChange: (md) => onChangeRef.current?.(md),
    });
    return () => {
      coreRef.current?.destroy();
      coreRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    coreRef.current?.update({ initialMarkdown, onChange: (md) => onChangeRef.current?.(md) });
  }, [initialMarkdown]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return h("div", { ref: hostRef as any });
}

export type { MicroMDEditorProps as default };
