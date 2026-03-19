Alright — let’s rebuild this the **correct way** so you stop fighting React and the browser.

This will be a **Notion-style architecture**:

👉 React controls **structure (blocks)**
👉 Browser controls **content (DOM inside blocks)**
👉 You sync **DOM → state**, never force React to re-render inner HTML

---

# 🧠 Core Principles

### 1. React NEVER re-renders editable content

* No token `<span>` trees
* No diffing inside contentEditable

### 2. Each block is an **isolated editing island**

### 3. Source of truth during typing = **DOM**, not state

### 4. State updates are **lazy + structural only**

---

# 🏗️ High-Level Architecture

```
Editor
 ├── BlockWrapper (React-controlled)
 │    └── BlockContent (contentEditable, DOM-controlled)
```

---

# 🔥 FINAL DESIGN

## 1. Editor State (only structure)

```ts
type Block = {
  id: string;
  type: string;
  raw: string; // last synced value (not live)
};

type EditorState = {
  blocks: Block[];
};
```

---

## 2. Editor Component (SAFE)

```tsx
export function Editor({ initialMarkdown }: { initialMarkdown: string }) {
  const [blocks, setBlocks] = React.useState<Block[]>(() =>
    parseMarkdown(initialMarkdown)
  );

  const updateBlock = React.useCallback((id: string, raw: string) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, raw } : b))
    );
  }, []);

  const splitBlock = React.useCallback((id: string, offset: number) => {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      if (idx === -1) return prev;

      const block = prev[idx];

      const before = block.raw.slice(0, offset);
      const after = block.raw.slice(offset);

      return [
        ...prev.slice(0, idx),
        { ...block, id: genId(), raw: before },
        { id: genId(), type: detectType(after), raw: after },
        ...prev.slice(idx + 1),
      ];
    });
  }, []);

  return (
    <div>
      {blocks.map((block) => (
        <BlockWrapper
          key={block.id}
          block={block}
          onChange={updateBlock}
          onSplit={splitBlock}
        />
      ))}
    </div>
  );
}
```

---

# 🔒 3. BlockWrapper (React-safe boundary)

```tsx
function BlockWrapper({
  block,
  onChange,
  onSplit,
}: {
  block: Block;
  onChange: (id: string, raw: string) => void;
  onSplit: (id: string, offset: number) => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  // 🔥 ONLY set initial content
  React.useEffect(() => {
    if (!ref.current) return;

    if (ref.current.innerText !== block.raw) {
      ref.current.innerText = block.raw;
    }
  }, [block.id]); // ⚠️ NOT raw

  /*
  INPUT (DOM → STATE)
  */

  const handleInput = () => {
    if (!ref.current) return;
    const text = ref.current.innerText;
    onChange(block.id, text);
  };

  /*
  ENTER HANDLING
  */

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();

      const sel = window.getSelection();
      if (!sel || !ref.current) return;

      const offset = getCaretOffset(ref.current, sel);

      onSplit(block.id, offset);
    }
  };

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      style={getBlockStyle(block.type)}
    />
  );
}
```

---

# ✂️ 4. Caret Offset (CRITICAL)

```ts
function getCaretOffset(root: HTMLElement, selection: Selection): number {
  const range = selection.getRangeAt(0);
  const preRange = range.cloneRange();

  preRange.selectNodeContents(root);
  preRange.setEnd(range.endContainer, range.endOffset);

  return preRange.toString().length;
}
```

---

# 🔍 5. Plugin Detection (PURE TEXT)

````ts
function detectType(text: string): string {
  if (/^>\s/.test(text)) return "quote";
  if (/^[-*]\s/.test(text)) return "list";
  if (/^```/.test(text)) return "code";
  return "paragraph";
}
````

---

# 🎨 6. Styling (NO STRUCTURE CHANGES)

```ts
function getBlockStyle(type: string): React.CSSProperties {
  switch (type) {
    case "quote":
      return {
        borderLeft: "3px solid #ddd",
        paddingLeft: "8px",
        color: "#555",
      };
    case "code":
      return {
        fontFamily: "monospace",
        background: "#f5f5f5",
        padding: "8px",
        whiteSpace: "pre",
      };
    default:
      return {};
  }
}
```

---

# 🚫 What we REMOVED (this was breaking everything)

❌ token spans
❌ React rendering per character
❌ removing lines dynamically
❌ plugin DOM rendering
❌ controlled contentEditable

---

# ✅ What you GAIN

### ✔ No crashes

### ✔ Native typing performance

### ✔ Selection never breaks

### ✔ Simpler mental model

-



👉 Plugins **DO NOT render DOM**
👉 Plugins **ONLY transform text + handle behavior**

---

# 🧠 Plugin System (Safe Version)

## 🔑 Core idea

Each plugin defines:

```ts
type BlockPlugin = {
  type: string;

  match(text: string): boolean;

  normalize?(text: string): string;

  onEnter?(ctx: PluginCtx): PluginResult;

  onBackspace?(ctx: PluginCtx): PluginResult;

  decorate?(text: string): Decoration[];
};
```

---

## 🔧 Plugin Context

```ts
type PluginCtx = {
  text: string;
  selection: Selection;
  root: HTMLElement;
};
```

---

## 🔁 Plugin Result

```ts
type PluginResult =
  | { type: "none" }
  | { type: "update"; text: string }
  | { type: "split"; before: string; after: string }
  | { type: "merge" };
```

---

# 🏗️ Editor Flow (IMPORTANT)

### On every input:

```ts
1. Read DOM text
2. Detect plugin
3. Normalize text (plugin.normalize)
4. Save to state
```

---

### On Enter:

```ts
1. Detect plugin
2. plugin.onEnter()
3. Apply result
```

---

# 🧩 Plugin Registry

```ts
const plugins: BlockPlugin[] = [
  QuotePlugin,
  ListPlugin,
  CodeBlockPlugin,
  ParagraphPlugin,
];

function getPlugin(text: string): BlockPlugin {
  return plugins.find((p) => p.match(text)) || ParagraphPlugin;
}
```

---

# ✍️ Example: Paragraph Plugin

```ts
const ParagraphPlugin: BlockPlugin = {
  type: "paragraph",

  match: () => true,

  onEnter(ctx) {
    const offset = getCaretOffset(ctx.root, ctx.selection);

    return {
      type: "split",
      before: ctx.text.slice(0, offset),
      after: ctx.text.slice(offset),
    };
  },
};
```

---

# 💬 Quote Plugin (SAFE)

```ts
const QuotePlugin: BlockPlugin = {
  type: "quote",

  match(text) {
    return /^>\s?/.test(text);
  },

  normalize(text) {
    return text
      .split("\n")
      .map((line) => {
        if (line.trim() === "") return "> ";
        return line.startsWith(">") ? line : `> ${line}`;
      })
      .join("\n");
  },

  onEnter(ctx) {
    const offset = getCaretOffset(ctx.root, ctx.selection);

    const before = ctx.text.slice(0, offset);
    const after = ctx.text.slice(offset);

    return {
      type: "update",
      text: before + "\n> " + after,
    };
  },

  onBackspace(ctx) {
    const { text } = ctx;

    // exit quote if empty
    if (text.trim() === ">" || text.trim() === "> ") {
      return {
        type: "update",
        text: "",
      };
    }

    return { type: "none" };
  },
};
```

---

# 📋 List Plugin (WITH type switching)

```ts
const ListPlugin: BlockPlugin = {
  type: "list",

  match(text) {
    return /^[-*]\s/.test(text);
  },

  normalize(text) {
    return text
      .split("\n")
      .map((line) => {
        if (line.trim() === "") return "- ";
        return /^[-*]\s/.test(line) ? line : `- ${line}`;
      })
      .join("\n");
  },

  onEnter(ctx) {
    const offset = getCaretOffset(ctx.root, ctx.selection);

    const before = ctx.text.slice(0, offset);
    const after = ctx.text.slice(offset);

    return {
      type: "update",
      text: before + "\n- " + after,
    };
  },

  onBackspace(ctx) {
    const { text } = ctx;

    // "- " → convert to paragraph
    if (text === "- " || text === "* ") {
      return {
        type: "update",
        text: "",
      };
    }

    return { type: "none" };
  },
};
```

---

# 💻 Code Block Plugin (multiline-safe)

````ts
const CodeBlockPlugin: BlockPlugin = {
  type: "code",

  match(text) {
    return /^```/.test(text);
  },

  normalize(text) {
    return text; // no transform
  },

  onEnter(ctx) {
    const offset = getCaretOffset(ctx.root, ctx.selection);

    const before = ctx.text.slice(0, offset);
    const after = ctx.text.slice(offset);

    return {
      type: "update",
      text: before + "\n" + after, // 🔥 no splitting
    };
  },

  onBackspace(ctx) {
    if (ctx.text === "```") {
      return {
        type: "update",
        text: "",
      };
    }

    return { type: "none" };
  },
};
````

---

# ⚙️ BlockWrapper with Plugins

Replace your handler logic with:

```ts
const handleInput = () => {
  if (!ref.current) return;

  let text = ref.current.innerText;

  const plugin = getPlugin(text);

  if (plugin.normalize) {
    const normalized = plugin.normalize(text);

    if (normalized !== text) {
      text = normalized;

      // 🔥 update DOM manually (not React)
      ref.current.innerText = normalized;
      placeCaretAtEnd(ref.current);
    }
  }

  onChange(block.id, text);
};
```

---

# ⌨️ Keyboard Handling

```ts
const handleKeyDown = (e: React.KeyboardEvent) => {
  if (!ref.current) return;

  const sel = window.getSelection();
  if (!sel) return;

  const text = ref.current.innerText;
  const plugin = getPlugin(text);

  if (e.key === "Enter" && plugin.onEnter) {
    e.preventDefault();

    const result = plugin.onEnter({
      text,
      selection: sel,
      root: ref.current,
    });

    applyPluginResult(result);
  }

  if (e.key === "Backspace" && plugin.onBackspace) {
    const result = plugin.onBackspace({
      text,
      selection: sel,
      root: ref.current,
    });

    applyPluginResult(result);
  }
};
```

---

# 🔁 Applying Plugin Results

```ts
function applyPluginResult(result: PluginResult) {
  if (result.type === "none") return;

  if (result.type === "update") {
    ref.current.innerText = result.text;
    placeCaretAtEnd(ref.current);
    onChange(block.id, result.text);
  }

  if (result.type === "split") {
    onSplit(block.id, getCaretOffset(ref.current!, window.getSelection()!));
  }
}
```

---

Great — this is the piece that turns your editor from “works” into **feels like Notion**.

Right now you rely on `window.getSelection()` + offsets → that’s fragile because:

* DOM mutates
* text nodes split/merge
* offsets become invalid

So we build a **selection engine** that:

👉 maps DOM ↔ logical text
👉 survives mutations
👉 restores caret precisely

---

# 🧠 Core Idea

We introduce a **logical selection model**:

```ts
type LogicalSelection = {
  blockId: string;
  anchor: number;
  focus: number;
};
```

👉 offsets are relative to **plain text**, not DOM

---

# 🏗️ Architecture

```
DOM Selection
   ↓ (read)
Logical Selection (stable)
   ↓ (store in state)
Render / mutations
   ↓
Restore DOM Selection
```

---

# 🔥 Step 1 — Mark DOM with offsets

Inside each block, wrap text in **offset-aware spans**

BUT ⚠️ we still avoid complex trees

👉 minimal approach:

```ts
function renderTextWithOffsets(text: string) {
  return text.split("").map((char, i) => {
    return `<span data-offset="${i}">${escapeHtml(char)}</span>`;
  }).join("");
}
```

Then:

```tsx
<div
  ref={ref}
  contentEditable
  dangerouslySetInnerHTML={{
    __html: renderTextWithOffsets(block.raw),
  }}
/>
```

---

# 🧠 Why this works

Now every character has:

```html
<span data-offset="42">a</span>
```

👉 we can always map DOM → text offset

---

# 📥 Step 2 — Read selection from DOM

```ts
function getLogicalSelection(root: HTMLElement, blockId: string): LogicalSelection | null {
  const sel = window.getSelection();
  if (!sel || !sel.anchorNode) return null;

  const anchorEl = getOffsetSpan(sel.anchorNode);
  const focusEl = getOffsetSpan(sel.focusNode);

  if (!anchorEl || !focusEl) return null;

  const anchor = Number(anchorEl.dataset.offset);
  const focus = Number(focusEl.dataset.offset);

  return {
    blockId,
    anchor,
    focus,
  };
}
```

---

### helper:

```ts
function getOffsetSpan(node: Node | null): HTMLElement | null {
  while (node) {
    if (
      node instanceof HTMLElement &&
      node.dataset.offset !== undefined
    ) {
      return node;
    }
    node = node.parentNode!;
  }
  return null;
}
```

---

# 📤 Step 3 — Restore selection

```ts
function restoreSelection(root: HTMLElement, sel: LogicalSelection) {
  const { anchor, focus } = sel;

  const anchorEl = root.querySelector(`[data-offset="${anchor}"]`);
  const focusEl = root.querySelector(`[data-offset="${focus}"]`);

  if (!anchorEl || !focusEl) return;

  const range = document.createRange();
  range.setStart(anchorEl.firstChild || anchorEl, 0);
  range.setEnd(focusEl.firstChild || focusEl, 0);

  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}
```

---

# ⚠️ Important Edge Cases

## 1. Empty block

You MUST render at least one span:

```ts
if (text.length === 0) {
  return `<span data-offset="0">\u200B</span>`;
}
```

---

## 2. Caret at end

Add virtual offset:

```ts
<span data-offset={text.length}></span>
```

---

# 🔁 Step 4 — Integrate into Editor

### On input:

```ts
const sel = getLogicalSelection(ref.current, block.id);

const text = ref.current.innerText;

onChange(block.id, text, sel);
```

---

### On render:

```ts
useLayoutEffect(() => {
  if (selection) {
    restoreSelection(ref.current, selection);
  }
}, [block.raw]);
```

---

# 🔥 Step 5 — Mutation-safe updates

When plugin modifies text:

```ts
function applyTextUpdate(newText: string, prevSel: LogicalSelection) {
  const delta = newText.length - oldText.length;

  return {
    text: newText,
    selection: {
      ...prevSel,
      anchor: prevSel.anchor + delta,
      focus: prevSel.focus + delta,
    },
  };
}
```

---

# 🧠 Why this is powerful

You now have:

### ✅ Selection independent from DOM

### ✅ Survives re-renders

### ✅ Works with plugins

### ✅ Enables advanced UX

---

# 🚀 What this unlocks

Now you can implement:

### 1. Inline formatting

* bold / italic without breaking cursor

### 2. Smart transforms

* `# ` → heading without cursor jump

### 3. Multi-block selection

* shift + arrows across blocks

### 4. Decorations layer (Notion-style)

---

# ⚠️ Tradeoff

This approach:

👉 adds many DOM nodes (1 per char)

BUT:

👉 it is the simplest **correct** model

---

# 💡 Production optimization (later)

You can switch to:

* **range-based spans (per token)**
* or **text node + offset math (Lexical style)**

---

Perfect — this is where your editor starts to feel like a real **WYSIWYG Markdown editor**, without breaking the safe architecture we built.

We’ll add **decorations** the *correct way*:

👉 **Visual formatting WITHOUT mutating the editable DOM structure**

---

# 🧠 Core Idea (Notion-style)

We split each block into **two layers**:

```id="v0n7f2"
BlockWrapper
 ├── DecorationLayer (visual only, not editable)
 └── EditableLayer (plain text, contentEditable)
```

---

# 🔥 Why this works

| Layer      | Responsibility                    |
| ---------- | --------------------------------- |
| Editable   | real text, selection, typing      |
| Decoration | syntax highlighting, bold, italic |

👉 The cursor lives in **plain text**
👉 Decorations NEVER break selection

---

# 🏗️ Step 1 — Block Structure

```tsx id="9q9k3m"
function BlockWrapper({ block, onChange }) {
  const ref = React.useRef<HTMLDivElement>(null);

  return (
    <div style={{ position: "relative" }}>
      
      {/* 🎨 Decoration Layer */}
      <div
        className="decorations"
        aria-hidden
        dangerouslySetInnerHTML={{
          __html: renderDecorations(block.raw),
        }}
      />

      {/* ✍️ Editable Layer */}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        className="editor"
        onInput={() => {
          const text = ref.current!.innerText;
          onChange(block.id, text);
        }}
      />
    </div>
  );
}
```

---

# 🎨 Step 2 — CSS Magic (CRITICAL)

```css id="7w9i3k"
.decorations {
  position: absolute;
  inset: 0;
  pointer-events: none;
  white-space: pre-wrap;
  color: black;
}

.editor {
  position: relative;
  background: transparent;
  color: transparent;           /* 🔥 hide real text */
  caret-color: black;           /* 🔥 keep cursor visible */
  white-space: pre-wrap;
}
```

---

# 🧠 What’s happening

👉 User types in `.editor`
👉 Text is invisible (`color: transparent`)
👉 `.decorations` shows formatted version behind it
👉 Caret still works perfectly

---

# ✨ Step 3 — Decoration Engine

We convert markdown → HTML

```ts id="wh3yso"
function renderDecorations(text: string): string {
  const tokens = tokenize(text);

  return tokens.map((t) => {
    const content = escapeHtml(t.content);

    switch (t.type) {
      case "bold":
        return `<strong>${content}</strong>`;
      case "italic":
        return `<em>${content}</em>`;
      case "code":
        return `<code>${content}</code>`;
      case "syntax":
        return `<span class="syntax">${content}</span>`;
      default:
        return content;
    }
  }).join("");
}
```

---

# 🧩 Step 4 — Tokenizer (simple version)

```ts id="m7m7v6"
function tokenize(text: string) {
  const tokens = [];

  let i = 0;

  while (i < text.length) {
    // bold **text**
    if (text.startsWith("**", i)) {
      const end = text.indexOf("**", i + 2);
      if (end !== -1) {
        tokens.push({
          type: "bold",
          content: text.slice(i + 2, end),
        });
        i = end + 2;
        continue;
      }
    }

    // italic *text*
    if (text[i] === "*") {
      const end = text.indexOf("*", i + 1);
      if (end !== -1) {
        tokens.push({
          type: "italic",
          content: text.slice(i + 1, end),
        });
        i = end + 1;
        continue;
      }
    }

    // inline code `text`
    if (text[i] === "`") {
      const end = text.indexOf("`", i + 1);
      if (end !== -1) {
        tokens.push({
          type: "code",
          content: text.slice(i + 1, end),
        });
        i = end + 1;
        continue;
      }
    }

    // fallback
    tokens.push({
      type: "text",
      content: text[i],
    });

    i++;
  }

  return tokens;
}
```

---

# 🎯 Step 5 — Syntax Highlighting

Add style:

```css id="w3c7i3"
.syntax {
  opacity: 0.4;
}
```

You can emit tokens like:

```ts id="1r7mb2"
{ type: "syntax", content: "**" }
```

---

# 💡 Step 6 — Keep layers in sync

⚠️ IMPORTANT:

Both layers must have identical:

```css id="w1x0q9"
font-family
font-size
line-height
letter-spacing
padding
white-space
```

---

# 🚨 Common Bugs (and fixes)

## ❌ Misaligned text

👉 Fix with:

```css id="j9o0xw"
.decorations, .editor {
  font: inherit;
  line-height: inherit;
}
```

---

## ❌ Cursor offset mismatch

👉 Always use:

```css id="h3m2rk"
white-space: pre-wrap;
```

---

## ❌ Scrolling desync

Wrap both:

```tsx id="mx2j7m"
<div style={{ position: "relative", overflow: "auto" }}>
```
