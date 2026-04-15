# Single-Root Markdown Editor Rebuild Design

## Goal

Replace the current editor architecture with a full-featured markdown editor built around a single top-level `contenteditable` surface, while keeping all markdown syntax visible during editing.

The replacement must support both React and Preact shells over one shared imperative editor core.

## Product Intent

The editor should behave like a markdown-first writing surface, not a hidden-syntax WYSIWYG editor.

Core product expectations:

- all block markdown markers remain visible while editing
- native browser selection, copy, cut, paste, and undo remain primary
- markdown pasted from this editor or any other markdown editor is supported through `text/plain`
- the editable surface is one continuous document, not a set of editing islands
- styling may enhance readability, but raw markdown text stays visible

## Target Platforms

Required from day one:

- desktop Chrome
- desktop Firefox
- desktop Safari
- mobile Chrome
- mobile Safari

## Scope

In scope:

- single editable root architecture
- full block support from the start
- shared imperative editor core
- React wrapper
- Preact wrapper
- native multi-block selection and clipboard behavior
- browser-native undo/redo
- plain-text markdown paste pipeline
- lightweight inline styling where safe
- cross-browser regression coverage for selection, paste, and structural editing

Out of scope for v1:

- rich HTML paste fidelity
- hidden markdown syntax while editing
- collaborative editing
- embedded block widgets
- plugin marketplace
- arbitrary markdown extensions beyond the supported block set

## Supported Markdown Features

The rebuild must support these block types from the start:

- paragraph
- headings `#` through `######`
- unordered list with `- ` and `* `
- ordered list
- task list
- blockquote
- fenced code block
- horizontal rule

Inline markdown:

- raw inline syntax remains visible
- lightweight styling is allowed for emphasis, strong, inline code, links, and similar inline constructs only if it does not destabilize editing behavior
- if inline styling causes selection, composition, or undo problems, raw text wins and styling must degrade gracefully

## User-Visible Behavior Requirements

### Editing model

- the document is edited through one top-level `contenteditable`
- all block syntax is visible while typing and after normalization
- block styling updates live as the visible markdown syntax changes
- structural edits must preserve intuitive caret movement

### Selection

- users can select across any number of blocks natively
- shift-selection, mouse drag selection, keyboard extension, and block-spanning deletion must work within the single editing surface
- selection restoration after normalization must preserve user intent

### Clipboard

- copy and cut should preserve markdown text exactly
- paste should read `text/plain` markdown as the authoritative source
- rich HTML on the clipboard may exist but must not drive the model
- pasting multi-block markdown must create the correct block structure
- the caret after paste must land at the end of the inserted content

### Undo / redo

- browser-native undo/redo is the primary history mechanism
- editor normalization must avoid breaking browser undo where possible
- structural corrections should be applied in ways that minimize undo stack corruption

### Keyboard behavior

- browser-native text editing should remain in control for ordinary character insertion and deletion
- custom logic should be limited to structural markdown behavior the browser cannot express correctly
- the editor must define correct behavior for:
  - Enter
  - Backspace
  - Delete
  - Tab
  - Shift+Tab
  - Arrow navigation at structural boundaries

## Architecture Decision

The final editor should use a shared framework-agnostic imperative core with thin React and Preact shells.

Recommended architecture:

- one single editable root
- DOM-first editing during interaction
- document model as the canonical normalized state
- selective normalization when structure changes
- optional non-editable helper DOM around the editable root

This corresponds to a document-aware single-root editor that preserves native browser editing as much as possible, while taking ownership of markdown structure and normalization.

## Internal Architecture

### 1. Shared imperative core

The core editor must not depend on React or Preact internals.

Responsibilities:

- create and own the editable root
- render block DOM imperatively
- maintain normalized markdown state
- map between DOM selection and logical document positions
- run structural normalization
- handle plain-text markdown paste
- emit change events to the shell

The core should expose an API similar to:

```ts
type EditorCoreOptions = {
  initialMarkdown: string;
  onChange?: (markdown: string) => void;
  debug?: boolean;
};

type EditorCoreHandle = {
  root: HTMLElement;
  update(next: Partial<EditorCoreOptions>): void;
  destroy(): void;
};
```

### 2. Thin shell adapters

React and Preact wrappers should only:

- mount the core into a host element
- pass updated props
- tear down the core on unmount
- expose matching component APIs

The wrappers must not render the editable subtree.

### 3. Document model

The core should maintain:

- canonical markdown string
- ordered block list with stable ids
- block metadata for type and structural state
- optional inline token metadata for lightweight styling

Suggested block shape:

```ts
type BlockType =
  | "paragraph"
  | "heading"
  | "unordered-list"
  | "ordered-list"
  | "task-list"
  | "blockquote"
  | "code-fence"
  | "horizontal-rule";

type Block = {
  id: string;
  type: BlockType;
  raw: string;
  meta?: Record<string, unknown>;
};
```

## DOM Structure

The editable subtree must contain exactly one actual editing host.

Example structure:

```html
<div class="mmd-shell">
  <div class="mmd-helper-layer" aria-hidden="true"></div>
  <div class="mmd-editor-root" contenteditable="true">
    <div data-block-id="..." data-block-type="heading"># Title</div>
    <div data-block-id="..." data-block-type="paragraph">Paragraph</div>
  </div>
</div>
```

Rules:

- only `.mmd-editor-root` is editable
- top-level children inside the root represent blocks
- helper DOM may exist beside or around the root, but not as another editing host
- block DOM should remain simple and predictable

## Parsing And Normalization

### Parser layer

A parser library such as `remark` is allowed and recommended for markdown structure parsing, but it must be isolated behind adapter functions.

The parser must not own rendering or DOM editing.

Allowed parser responsibilities:

- convert markdown text into normalized block structure
- identify block boundaries and metadata
- support inline token extraction for optional styling

### Normalization rules

The editor should not blindly rerender the whole root after every input if the change is local and non-structural.

Preferred strategy:

- keep the live DOM authoritative during active typing
- detect whether the change is structural
- normalize only affected blocks when possible
- allow full-root rerender as a fallback for complex structural edits

Structural changes include:

- block split / merge
- block type transition
- paste replacing multiple blocks
- fenced code block transitions
- list indentation / outdentation

## Selection Model

Selection must be represented in logical document coordinates, not only in DOM node references.

Suggested shape:

```ts
type BlockPoint = {
  blockId: string;
  offset: number;
};

type BlockRange = {
  start: BlockPoint;
  end: BlockPoint;
  isCollapsed: boolean;
};
```

The core must provide:

- DOM selection to logical range mapping
- logical range normalization for backward selections
- logical range to DOM range restoration
- caret targeting after structural edits

Selection mapping is a critical subsystem and must be designed as a standalone module.

## Paste Pipeline

Paste handling must be explicit and markdown-first.

Required flow:

1. intercept paste on the editable root
2. read `text/plain`
3. ignore rich HTML as the source of truth
4. map the current DOM selection into a logical range
5. replace that logical range in the document model with pasted markdown
6. parse the inserted markdown into blocks
7. rerender the affected region
8. place the caret at the end of the inserted content
9. emit the normalized markdown string

This approach is required specifically to avoid browser-specific nested pasted HTML corrupting the structure.

## Keyboard Behavior Layer

The editor should only override browser behavior where the browser does not understand markdown structure well enough.

### Enter

- split current block when appropriate
- continue list items and task list items
- exit list or blockquote where markdown rules require it
- preserve fenced code block semantics

### Backspace / Delete

- merge with previous / next block at structural boundaries
- demote headings when syntax is removed
- convert list items or blockquotes back to paragraph when markers are removed
- preserve native text deletion inside a block where possible

### Tab / Shift+Tab

- indent / outdent list structures where supported
- avoid hijacking browser focus navigation outside intended editor contexts

## Inline Styling Policy

Inline styling is allowed, but it must remain subordinate to editing stability.

Rules:

- inline syntax remains visible
- inline styling should be lightweight and additive
- styling must not require multiple editable roots
- styling must not depend on React rendering token spans into the editable subtree

Preferred order of safety:

1. plain raw inline text
2. helper-layer or decoration-based inline emphasis if selection-safe
3. direct inline DOM decoration only if proven safe across target browsers

If a styling approach causes instability, the implementation must fall back to raw visible markdown.

## Browser Compatibility Constraints

The editor must explicitly account for:

- Safari paste HTML quirks
- mobile selection behavior
- IME / composition handling
- browser differences in root-level and block-level selection endpoints
- browser undo interactions with normalization

Composition handling rule:

- during active IME composition, normalization should be minimal and non-destructive
- structural rewrite should be deferred until composition is complete unless absolutely necessary

## Testing Strategy

The rebuild requires three layers of verification.

### 1. Pure unit tests

- markdown parsing adapters
- block replacement logic
- selection normalization
- caret target computation
- structural keyboard helpers

### 2. DOM integration tests

- single-root selection mapping
- block split / merge
- heading/list demotion on marker removal
- plain-text paste over collapsed and expanded selections
- cross-block replacement
- caret restoration after normalization

### 3. Real browser regression coverage

Record and preserve browser-derived fixtures for:

- Safari nested paste HTML
- mobile Safari block selection quirks
- Chrome / Firefox root endpoint behavior
- composition-sensitive edits

Where automated browser coverage is incomplete, keep reproducible manual test scripts and captured DOM cases in the repo.

## Non-Goals

The rebuild should not attempt these in v1:

- rich HTML import fidelity
- WYSIWYG hidden-syntax editing
- arbitrary markdown plugin ecosystems
- collaborative cursors
- block embed systems
- arbitrary AST-preserving round-trip for unsupported extensions

## Success Criteria

The rebuild is complete when:

1. the editor uses one top-level `contenteditable`
2. React and Preact wrappers both use the same imperative core
3. all required block types are supported from the start
4. all markdown syntax remains visible while editing
5. native cross-block selection, copy, cut, and delete work reliably
6. plain-text markdown paste from this editor and other markdown editors works reliably
7. browser-native undo/redo remains usable and stable
8. desktop Chrome/Firefox/Safari and mobile Chrome/Safari are covered by verification
9. inline styling degrades safely when a browser path is unstable

## Recommended Implementation Order

1. extract a framework-agnostic editor core from the prototype direction
2. define block model, selection model, and parser adapter interfaces
3. implement single-root rendering and selection mapping
4. implement plain-text paste replacement in model space
5. implement structural Enter / Backspace / Delete rules
6. implement full block coverage
7. add React wrapper
8. add Preact wrapper
9. add lightweight inline styling only where stable
10. expand browser regression coverage and remove prototype-only debug paths
