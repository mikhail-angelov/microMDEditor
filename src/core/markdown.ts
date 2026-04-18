import { generateId } from "./id";
import type { Block } from "./types";

export function parseMarkdownToBlocks(markdown: string): Block[] {
  const normalized = markdown.replace(/\r\n/g, "\n");

  if (normalized.length === 0) {
    return [{ id: generateId(), type: "paragraph", raw: "" }];
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

    const chunkLines: string[] = [];
    while (i < lines.length && lines[i] !== "") {
      // Special handling for poll format: split on lines starting with # or -
      // This ensures proper block separation for poll format
      const line = lines[i];
      if ((line.startsWith('#') || /^[-*]\s/.test(line)) && chunkLines.length > 0) {
        // Start a new chunk
        chunks.push(chunkLines.join("\n"));
        chunkLines.length = 0;
      }
      chunkLines.push(line);
      i++;
    }
    if (chunkLines.length > 0) {
      chunks.push(chunkLines.join("\n"));
    }
  }

  return chunks.map((chunk) => {
    if (/^#{1,6}\s/.test(chunk)) {
      const level = chunk.match(/^#+/)?.[0].length ?? 1;
      return { id: generateId(), type: "heading", raw: chunk, meta: { level } };
    }
    if (/^-\s\[[ xX]\]\s/.test(chunk)) {
      return {
        id: generateId(),
        type: "task-list",
        raw: chunk,
        meta: { marker: "-", checked: /^-\s\[[xX]\]/.test(chunk) },
      };
    }
    if (/^[-*]\s/.test(chunk)) {
      return { id: generateId(), type: "unordered-list", raw: chunk, meta: { marker: chunk[0] } };
    }
    if (/^\d+\.\s/.test(chunk)) {
      const order = Number(chunk.match(/^\d+/)?.[0] ?? "1");
      return { id: generateId(), type: "ordered-list", raw: chunk, meta: { order } };
    }
    if (/^>\s/.test(chunk)) {
      return { id: generateId(), type: "blockquote", raw: chunk };
    }
    if (/^```/.test(chunk)) {
      return { id: generateId(), type: "code-fence", raw: chunk };
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(chunk.trim())) {
      return { id: generateId(), type: "horizontal-rule", raw: chunk.trim() };
    }
    return { id: generateId(), type: "paragraph", raw: chunk };
  });
}

export function serializeBlocksToMarkdown(blocks: Block[]): string {
  return blocks.map((block) => block.raw).join("\n\n");
}
