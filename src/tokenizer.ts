// Tokenizer for decoration layer - converts markdown to displayable tokens

import { Token } from "./types";
import { escapeHtml } from "./utils";

/**
 * Tokenize text into decoration tokens
 * Handles: **bold**, *italic*, `code`, headings, links
 * Groups text runs for efficiency
 */
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
    // Bold **text**
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

    // Italic *text* (but not if it's part of **)
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

    // Inline code `text` - handle triple backticks as text
    if (text[i] === "`") {
      // Check if this is triple backticks
      if (text.startsWith("```", i)) {
        // Triple backticks - treat as text, not inline code
        // Add all three backticks to buffer
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

    // Heading syntax (# ## ### etc.) at start
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

    // Link [text](url)
    if (text[i] === "[") {
      flushTextBuffer();
      const bracketEnd = text.indexOf("]", i + 1);
      if (bracketEnd !== -1 && text[bracketEnd + 1] === "(") {
        const parenEnd = text.indexOf(")", bracketEnd + 2);
        if (parenEnd !== -1) {
          tokens.push({ type: "syntax", content: "[" });
          tokens.push({ type: "link", content: text.slice(i + 1, bracketEnd) });
          tokens.push({ type: "syntax", content: "](" + text.slice(bracketEnd + 2, parenEnd) + ")" });
          i = parenEnd + 1;
          continue;
        }
      }
    }

    // Accumulate regular text
    textBuffer += text[i];
    i++;
  }

  // Flush any remaining text
  flushTextBuffer();

  return tokens;
}

/**
 * Render tokens to HTML string for decoration layer
 */
export function renderDecorations(text: string, blockType: string): string {
  // For code blocks, don't tokenize - just render as plain text
  if (blockType === "code") {
    return escapeHtml(text);
  }

  const tokens = tokenize(text);

  return tokens
    .map((t) => {
      const content = escapeHtml(t.content);

      switch (t.type) {
        case "bold":
          return `<strong>${content}</strong>`;
        case "italic":
          return `<em>${content}</em>`;
        case "code":
          return `<code class="inline-code">${content}</code>`;
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
