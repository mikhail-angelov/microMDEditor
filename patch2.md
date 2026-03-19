Below is a patch plan you can hand directly to Cline.

It is aimed at fixing the cursor / Backspace bug around inline markdown like `**bold**`, while keeping the current two-layer architecture intact: `BlockWrapper` uses a visual `DecorationLayer` plus a raw `contentEditable` layer, and the current risky points are the `textContent` rewrites plus Backspace decisions based on a single DOM selection snapshot.  

---

# Patch plan for Cline

## Goal

Fix incorrect caret behavior and destructive Backspace handling in lines containing inline markdown formatting, especially `**...**`, by introducing a stable logical-selection layer and adding regression tests around `BlockWrapper`.

## Constraints

* Do **not** replace the two-layer editor architecture.
* Do **not** move inline formatting into the editable DOM.
* Keep current public API shape unless necessary.
* Add tests first for the reported regressions.
* Preserve existing plugin behavior for Enter / normalize / block transitions. `BlockWrapper` currently routes Enter and Backspace through plugin handlers and then falls back to split / merge / delete behavior.  

---

## Root cause summary

The likely problem is not the tokenizer or decoration rendering itself. `DecorationLayer` only renders tokens visually, while actual editing happens in the raw editable layer.  

The risky part is that `BlockWrapper`:

* reads selection from the live DOM with `getCaretOffset(...)`
* rewrites `editableRef.current.textContent`
* restores caret heuristically with `placeCaretAtOffset(...)`
* decides “Backspace at start of block” from that live snapshot

That combination is fragile around normalization and inline syntax boundaries.  

---

## Delivery order

### Step 1 — add failing regression tests first

Create new test files:

* `BlockWrapper.test.tsx`
* optionally `selection.test.ts` if you extract helpers into `utils.ts` or a new module

Do **not** start with refactor. First pin the bug.

### Required first tests

#### 1. Backspace inside inline markdown must not trigger merge/delete

Case:

* block raw: `hello **bold** world`
* place caret at logical offset inside the line but not at 0
* press Backspace

Assert:

* `onMergeWithPrevious` not called
* `onDelete` not called
* block remains same
* normal local deletion path occurs or at minimum no block-level destructive action fires

Why this matters:
`BlockWrapper` currently treats Backspace specially when `caretOffset === 0 && sel.isCollapsed`. That must never happen accidentally for mid-line caret positions. 

#### 2. Backspace at true offset 0 still merges/deletes

Case:

* block raw: `**bold**`
* caret at logical offset 0
* press Backspace

Assert:

* if empty block path: `onDelete` fires
* otherwise `onMergeWithPrevious` fires for non-empty block
* no false negatives introduced by new guards

This preserves current intended behavior. 

#### 3. Non-collapsed selection must not use start-of-block Backspace path

Case:

* select a range in `**bold** text`
* press Backspace

Assert:

* `onMergeWithPrevious` not called
* `onDelete` not called because current code only uses destructive block path for collapsed start-of-block selection. 

#### 4. Round-trip logical caret placement on inline markdown

Case:

* render raw: `a **bold** b *italic* c \`code``
* for several offsets:

  * place caret at offset N
  * read offset back

Assert:

* returned offset equals N

This validates `getCaretOffset` / `placeCaretAtOffset` behavior on raw editable text independent of decorations. Those functions are already exported from `utils.ts`.  

#### 5. Caret preserved after normalization rewrite

Case:

* use a plugin normalization example such as quote normalization
* input text that triggers `plugin.normalize`
* verify caret lands at the intended logical offset after `textContent` rewrite

Why:
`handleInput` currently rewrites `textContent` and restores via `caretPos + result.delta`, which is fragile. 

#### 6. Plugin update preserves caret after rewrite

Case:

* trigger `applyPluginResult` with `result.type === "update"` and `cursorOffset`
* assert caret lands at `cursorOffset`

Why:
`applyPluginResult` rewrites `textContent` and uses `requestAnimationFrame` to restore selection. That path needs direct regression coverage. 

---

## Step 2 — extract logical selection helpers

Create a new file:

* `selection.ts`

Move or wrap selection logic currently used through `getCaretOffset` and `placeCaretAtOffset` into higher-level APIs.

### New types

Use or extend your existing `LogicalSelection` type export from `index.ts`. It already appears to exist in your exported types. 

Suggested shape:

```ts
export type LogicalSelectionSnapshot = {
  start: number;
  end: number;
  isCollapsed: boolean;
  isInsideRoot: boolean;
};
```

### New helper functions

```ts
export function getSelectionOffsets(root: HTMLElement): LogicalSelectionSnapshot
export function restoreSelectionOffsets(root: HTMLElement, start: number, end?: number): void
export function isCaretAtStart(root: HTMLElement): boolean
export function isCaretAtEnd(root: HTMLElement): boolean
```

### Behavior requirements

* Only compute offsets if selection is inside `root`
* Collapse invalid/outside-root selections to a safe default
* Support both collapsed and range selections
* Never assume selection is valid after DOM rewrite
* Clamp offsets to `[0, textLength]`

### Important note

Current utils already contain low-level caret helpers and block parsing utilities. Keep them as low-level primitives if desired, but route `BlockWrapper` through the new higher-level logical selection helpers. 

---

## Step 3 — refactor `BlockWrapper` to use logical selection snapshots

Target file:

* `BlockWrapper.tsx`

### Changes to make

#### A. Stop making destructive Backspace decisions from one raw DOM snapshot

Replace this pattern:

```ts
const sel = window.getSelection();
const caretOffset = getCaretOffset(editableRef.current, sel);
if (e.key === "Backspace" && caretOffset === 0 && sel.isCollapsed) ...
```

with:

```ts
const logicalSel = getSelectionOffsets(editableRef.current);
if (
  e.key === "Backspace" &&
  logicalSel.isInsideRoot &&
  logicalSel.isCollapsed &&
  logicalSel.start === 0
) { ... }
```

This makes the “merge/delete block” path much safer. Current behavior is defined in `handleKeyDown`. 

#### B. Snapshot selection before any DOM rewrite

Before:

* normalize rewrite
* plugin update rewrite
* any future transform

Capture:

* `start`
* `end`
* `isCollapsed`

After rewrite:

* restore using logical offsets, not a raw browser selection object captured before DOM mutation

#### C. Replace simple `delta` arithmetic with offset mapping wrapper

Current normalization code does:

```ts
placeCaretAtOffset(editableRef.current, caretPos + result.delta);
```

That is too weak for future inline edge cases. 

Introduce a local transform abstraction:

```ts
type SelectionTransform = (oldStart: number, oldEnd: number) => { start: number; end: number };
```

For now:

* normalization can still use delta internally
* but wrap it in a function so the API supports richer mapping later

#### D. Only rewrite `textContent` when text actually changed

There is already an initial mount guard:

* only set `textContent` if different on mount/id change 

Apply the same discipline to:

* normalization
* plugin updates

Avoid unnecessary DOM rewrites, because every rewrite risks losing or shifting selection.

#### E. Guard plugin callbacks with logical selection

When calling plugin `onEnter` / `onBackspace`, keep passing the actual `selection` and `root` if needed for compatibility, but use logical selection in `BlockWrapper` for block-level decisions. Existing plugin dispatch is done via `getPlugin(...)` and `plugin.onEnter` / `plugin.onBackspace`.  

---

## Step 4 — keep `DecorationLayer` unchanged unless tests prove otherwise

Target file:

* `DecorationLayer.tsx`

No refactor needed initially.

Reason:

* it is visual only
* raw editing still happens in the editable layer
* the reported bug is more likely selection/writeback related than token rendering related 

Only touch this file if tests reveal token output causing layout drift or invisible offset mismatches.

---

## Step 5 — add end-to-end editor regression tests in `MicroMDEditor`

Target file:

* new `MicroMDEditor.test.tsx` or extend if already present

### Required integration cases

#### 1. Merge with previous keeps correct caret after block join

`MicroMDEditor` currently merges blocks by concatenating `previousBlock.raw + currentBlock.raw` and sets pending focus at `previousBlock.raw.length`. 

Add test:

* previous block: `hello `
* current block: `**bold**`
* trigger merge path
* assert focus lands at exact join point

#### 2. Focus navigation across inline markdown blocks

`MicroMDEditor` uses `pendingFocus` with `placeCaretAtOffset` and `placeCaretAtEnd` to restore focus.  

Add test:

* arrow/focus movement between blocks containing inline markdown
* ensure no jump to wrong offset

#### 3. `onChange` markdown output remains raw markdown

Since editor serializes blocks via `blocksToMarkdown`, add a test ensuring visual formatting never mutates stored markdown.  

---

## Step 6 — optional cleanup after green tests

### A. Add a small internal “editor transaction” helper

Create something like:

```ts
function applyTextMutation(
  root: HTMLElement,
  nextText: string,
  mapSelection: SelectionTransform
): void
```

Responsibilities:

* snapshot logical selection
* write `textContent` only if changed
* restore logical selection

Then reuse it in:

* `handleInput`
* `applyPluginResult`

### B. Narrow `requestAnimationFrame` usage

`applyPluginResult` currently restores selection inside `requestAnimationFrame`. 

Keep it if required by DOM timing, but confine it to one helper and document why it is needed.

### C. Export new helpers if useful

`index.ts` currently exports caret helpers from `utils.ts`. If you add `selection.ts`, export the new logical helpers too. 

---

# Concrete task list for Cline

Use these as individual tasks.

## Task 1 — add regression tests for `BlockWrapper`

Create `BlockWrapper.test.tsx` with tests for:

* Backspace inside `**bold**` does not call `onMergeWithPrevious`
* Backspace at true offset 0 does call merge/delete path
* range selection + Backspace does not trigger merge/delete
* plugin update preserves caret
* normalize preserves caret

## Task 2 — add selection helper module

Create `selection.ts` with:

* `getSelectionOffsets`
* `restoreSelectionOffsets`
* `isCaretAtStart`
* `isCaretAtEnd`

Add focused tests in `selection.test.ts` for round-trip placement across:

* plain text
* `**bold**`
* `*italic*`
* `` `code` ``

## Task 3 — refactor `BlockWrapper` to use logical selection

Update:

* `handleKeyDown`
* `handleInput`
* `applyPluginResult`

Requirements:

* block-level destructive Backspace uses logical selection only
* all DOM rewrites snapshot and restore logical selection
* avoid unnecessary `textContent` rewrites

## Task 4 — add integration regression tests for `MicroMDEditor`

Create tests for:

* merge join point offset
* focus restoration after merge
* raw markdown output stability with inline decorations

## Task 5 — export new utilities

Update `index.ts` exports if needed.

---

# Suggested acceptance criteria

Patch is complete when all of the following are true:

1. Backspace inside `hello **bold** world` never merges with previous block unless caret is truly at logical offset 0. `BlockWrapper` currently owns that merge/delete path. 

2. Caret round-trip works for multiple offsets in strings containing:

* bold
* italic
* inline code

3. Normalization no longer causes caret jumps in tested scenarios. Current normalization rewrites `textContent` and shifts by `delta`. 

4. Plugin updates that rewrite text preserve intended cursor position. Current plugin update path sets `textContent` and restores via `cursorOffset` or fallback to end. 

5. `MicroMDEditor` merge behavior still focuses previous block at the join point after concatenation. Current merge logic uses `previousBlock.raw.length` as pending focus offset. 

6. Existing tokenizer/plugin tests continue passing. Those already cover plugin matching and some normalization semantics, so they should stay green. 

---

# Suggested implementation notes for Cline

* Prefer `@testing-library/react` plus jsdom selection helpers.
* Where jsdom selection APIs are weak, add small test utilities to:

  * create a range in the editable root
  * call `placeCaretAtOffset`
  * read back offsets through the new logical helper
* Do not overfit to bold only; cover italic and inline code too because `DecorationLayer` renders all three inline token classes. 
* Keep plugin contracts stable unless a failing test proves they need adjustment. Existing tests already validate plugin selection and normalize behavior. 

---

# Copy-paste prompt for Cline

```text
Review the uploaded micro markdown editor files and implement a safe cursor-selection fix for contentEditable around inline markdown formatting.

Goals:
1. Fix incorrect caret / Backspace behavior in lines containing inline markdown like **bold**, *italic*, and `code`.
2. Preserve the existing two-layer architecture: visual DecorationLayer + raw contentEditable layer.
3. Add regression tests first, then refactor.

Required tasks:
- Add BlockWrapper regression tests:
  - Backspace inside inline markdown must not trigger merge/delete
  - Backspace at true logical offset 0 must still trigger merge/delete
  - Non-collapsed selection + Backspace must not use block merge/delete path
  - plugin update preserves caret
  - normalize preserves caret
- Add a new selection helper module with logical selection APIs:
  - getSelectionOffsets(root)
  - restoreSelectionOffsets(root, start, end?)
  - isCaretAtStart(root)
  - isCaretAtEnd(root)
- Refactor BlockWrapper to use logical selection snapshots instead of making destructive decisions from one raw DOM selection snapshot.
- Snapshot selection before any textContent rewrite and restore after rewrite.
- Avoid unnecessary textContent rewrites when text is unchanged.
- Add MicroMDEditor integration tests for:
  - merge with previous block keeps caret at join point
  - focus restoration remains correct with inline markdown
  - onChange preserves raw markdown
- Keep existing plugin behavior and tokenizer tests green unless a failing regression proves a contract must change.

Important constraints:
- Do not move formatted HTML into contentEditable.
- Do not rewrite the editor architecture.
- Keep public API changes minimal.
- Favor small, isolated helpers and testable behavior.
```
