import { useLayoutEffect, useRef } from "react";
import { createEditorCore } from "./core";
import type { EditorCore } from "./core";

export type MicroMDEditorProps = {
  initialMarkdown: string;
  onChange?: (markdown: string) => void;
};

export function MicroMDEditor({ initialMarkdown, onChange }: MicroMDEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const coreRef = useRef<EditorCore | null>(null);

  useLayoutEffect(() => {
    if (!hostRef.current) {
      return;
    }

    coreRef.current = createEditorCore(hostRef.current, { initialMarkdown, onChange });
    return () => {
      coreRef.current?.destroy();
      coreRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    coreRef.current?.update({ initialMarkdown, onChange });
  }, [initialMarkdown, onChange]);

  return <div ref={hostRef} />;
}
