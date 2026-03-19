import { Token } from "./types";
import { escapeHtml } from "./utils";

export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let textBuffer = "";

  const flushTextBuffer = () => {
    if (textBuffer.length > 0) {
      tokens.push({ type: "text", content: textBuffer });
      textBuffer = "";
    }
  };

  while (i < text.length) {
    if (text.startsWith("**", i)) {
      flushTextBuffer();
      const end = text.indexOf("**", i + 2);
      if (end !== -1) {
        tokens.push({ type: "syntax", content: "**" });
        tokens.push({ type: "bold", content: text.slice(i + 2, end) });
        tokens.push({ type: "syntax", content: "**" });
        i = end + 2;
        continue;
      }
    }

    if (text.startsWith("~~", i)) {
      flushTextBuffer();
      const end = text.indexOf("~~", i + 2);
      if (end !== -1) {
        tokens.push({ type: "syntax", content: "~~" });
        tokens.push({ type: "strike", content: text.slice(i + 2, end) });
        tokens.push({ type: "syntax", content: "~~" });
        i = end + 2;
        continue;
      }
    }

    if (text[i] === "*" && text[i + 1] !== "*" && (i === 0 || text[i - 1] !== "*")) {
      flushTextBuffer();
      const end = text.indexOf("*", i + 1);
      if (end !== -1 && text[end + 1] !== "*") {
        tokens.push({ type: "syntax", content: "*" });
        tokens.push({ type: "italic", content: text.slice(i + 1, end) });
        tokens.push({ type: "syntax", content: "*" });
        i = end + 1;
        continue;
      }
    }

    if (text[i] === "`") {
      if (text.startsWith("```", i)) {
        textBuffer += "```";
        i += 3;
        continue;
      }

      flushTextBuffer();
      const end = text.indexOf("`", i + 1);
      if (end !== -1) {
        tokens.push({ type: "syntax", content: "`" });
        tokens.push({ type: "code", content: text.slice(i + 1, end) });
        tokens.push({ type: "syntax", content: "`" });
        i = end + 1;
        continue;
      }
    }

    if (i === 0 && text[i] === "#") {
      flushTextBuffer();
      let hashEnd = 0;
      while (text[hashEnd] === "#" && hashEnd < 6) {
        hashEnd++;
      }
      if (text[hashEnd] === " ") {
        tokens.push({ type: "syntax", content: text.slice(0, hashEnd + 1) });
        i = hashEnd + 1;
        continue;
      }
    }

    if (text[i] === "[") {
      flushTextBuffer();
      const bracketEnd = text.indexOf("]", i + 1);
      if (bracketEnd !== -1 && text[bracketEnd + 1] === "(") {
        const parenEnd = text.indexOf(")", bracketEnd + 2);
        if (parenEnd !== -1) {
          const fullLink = text.slice(i, parenEnd + 1);
          tokens.push({ type: "link", content: fullLink });
          i = parenEnd + 1;
          continue;
        }
      }
    }

    textBuffer += text[i];
    i++;
  }

  flushTextBuffer();
  return tokens;
}

export function renderDecorations(text: string, blockType: string): string {
  if (blockType === "code") {
    return escapeHtml(text);
  }

  return tokenize(text)
    .map((t) => {
      const content = escapeHtml(t.content);
      switch (t.type) {
        case "bold":
          return `<span class="md-inline-bold">${content}</span>`;
        case "italic":
          return `<span class="md-inline-italic">${content}</span>`;
        case "code":
          return `<span class="md-inline-code">${content}</span>`;
        case "strike":
          return `<span class="md-inline-strike">${content}</span>`;
        case "syntax":
          return `<span class="md-syntax">${content}</span>`;
        case "heading":
          return `<span class="md-heading">${content}</span>`;
        case "link":
          return `<span class="md-link">${content}</span>`;
        default:
          return content;
      }
    })
    .join("");
}
