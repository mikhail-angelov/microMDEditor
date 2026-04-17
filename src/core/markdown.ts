import type { Block } from "./types";

export function parseMarkdownToBlocks(markdown: string): Block[] {
  let nextId = 0;
  const genId = () => `block-${nextId++}`;
  const normalized = markdown.replace(/\r\n/g, "\n");

  if (normalized.length === 0) {
    return [{ id: genId(), type: "paragraph", raw: "" }];
  }

  const lines = normalized.split("\n");
  const chunks: string[] = [];
  let i = 0;

  while (i < lines.length) {
    if (lines[i] === "") {
      i++;
      continue;
    }

    if (lines[i].startsWith("```")) {
      const start = i;
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        i++;
      }
      if (i < lines.length) {
        i++;
      }
      chunks.push(lines.slice(start, i).join("\n"));
      continue;
    }

    const start = i;
    while (i < lines.length && lines[i] !== "") {
      i++;
    }
    chunks.push(lines.slice(start, i).join("\n"));
  }

  return chunks.map((chunk) => {
    if (/^#{1,6}\s/.test(chunk)) {
      const level = chunk.match(/^#+/)?.[0].length ?? 1;
      return { id: genId(), type: "heading", raw: chunk, meta: { level } };
    }
    if (/^-\s\[[ xX]\]\s/.test(chunk)) {
      return {
        id: genId(),
        type: "task-list",
        raw: chunk,
        meta: { marker: "-", checked: /^-\s\[[xX]\]/.test(chunk) },
      };
    }
    if (/^[-*]\s/.test(chunk)) {
      return { id: genId(), type: "unordered-list", raw: chunk, meta: { marker: chunk[0] } };
    }
    if (/^\d+\.\s/.test(chunk)) {
      const order = Number(chunk.match(/^\d+/)?.[0] ?? "1");
      return { id: genId(), type: "ordered-list", raw: chunk, meta: { order } };
    }
    if (/^>\s/.test(chunk)) {
      return { id: genId(), type: "blockquote", raw: chunk };
    }
    if (/^```/.test(chunk)) {
      return { id: genId(), type: "code-fence", raw: chunk };
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(chunk.trim())) {
      return { id: genId(), type: "horizontal-rule", raw: chunk.trim() };
    }
    return { id: genId(), type: "paragraph", raw: chunk };
  });
}

export function serializeBlocksToMarkdown(blocks: Block[]): string {
  return blocks.map((block) => block.raw).join("\n\n");
}
