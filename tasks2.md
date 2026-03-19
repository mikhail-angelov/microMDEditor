# tasks.md

## Goal

Fix incorrect caret and Backspace behavior in the micro markdown editor when a line contains inline markdown such as `**bold**`, `*italic*`, or `` `code` ``, while preserving the current two-layer architecture.

## Constraints

* Keep the raw `contentEditable` layer and the visual `DecorationLayer` architecture.
* Do not move formatted HTML into the editable DOM.
* Keep public API changes minimal.
* Add tests first for the reported regressions.
* Keep existing tokenizer and plugin tests passing.

---

## Phase 1 — Regression tests first

### Task 1. Add `BlockWrapper` regression test file

Create `BlockWrapper.test.tsx` and wire up the minimum render helpers needed to mount a single editable block.

**Files**

* `BlockWrapper.test.tsx`

**Done when**

* The new test file exists and runs in the current test setup.
* It can render `BlockWrapper` with mocked callbacks.

**Notes**

* Reuse existing test stack and utilities where possible.
* Do not refactor production code in this task.

---

### Task 2. Add failing test: Backspace inside inline markdown must not merge/delete block

Add a test for a block with raw text `hello **bold** world` where the caret is inside the line but not at logical offset `0`, then press Backspace.

**Files**

* `BlockWrapper.test.tsx`

**Done when**

* The test asserts `onMergeWithPrevious` is not called.
* The test asserts `onDelete` is not called.
* The test fails against the current buggy behavior or at minimum protects the intended behavior.

**Notes**

* Use logical caret placement, not DOM-node-specific placement.

---

### Task 3. Add failing test: Backspace at true logical offset 0 still triggers block-level behavior

Add a test for a block like `**bold**` with caret at logical offset `0`, then press Backspace.

**Files**

* `BlockWrapper.test.tsx`

**Done when**

* The test asserts block-start destructive behavior still works.
* It verifies either `onMergeWithPrevious` or `onDelete`, depending on current intended behavior for the scenario.

**Notes**

* This is a safety test to avoid regressions after tightening the guard.

---

### Task 4. Add failing test: range selection + Backspace must not use block-start destructive path

Add a test that selects a range within `**bold** text` and presses Backspace.

**Files**

* `BlockWrapper.test.tsx`

**Done when**

* The test asserts `onMergeWithPrevious` is not called.
* The test asserts `onDelete` is not called.

---

### Task 5. Add failing test: caret round-trip works across inline markdown

Add tests that place the caret at several logical offsets in a string like `a **bold** b *italic* c \`code`` and read the offset back.

**Files**

* `selection.test.ts` or `BlockWrapper.test.tsx`

**Done when**

* For multiple offsets, placing the caret and reading it back returns the same logical offset.

**Notes**

* Cover bold, italic, and inline code.

---

### Task 6. Add failing test: normalization preserves caret after rewrite

Add a test for input that triggers plugin normalization and causes a `textContent` rewrite.

**Files**

* `BlockWrapper.test.tsx`

**Done when**

* The test verifies caret stays at the intended logical offset after normalization.

---

### Task 7. Add failing test: plugin update preserves caret after rewrite

Add a test for a plugin path that returns an update result with `cursorOffset`.

**Files**

* `BlockWrapper.test.tsx`

**Done when**

* The test verifies caret lands at the expected logical offset after the plugin-driven rewrite.

---

## Phase 2 — Selection abstraction

### Task 8. Create a new logical selection helper module

Create `selection.ts` to centralize logical selection operations for the editable root.

**Files**

* `selection.ts`

**Done when**

* The module exports:

  * `getSelectionOffsets(root)`
  * `restoreSelectionOffsets(root, start, end?)`
  * `isCaretAtStart(root)`
  * `isCaretAtEnd(root)`

**Notes**

* Clamp offsets to valid text bounds.
* Handle collapsed and non-collapsed selections.
* Return a safe result when selection is outside the editable root.

---

### Task 9. Add focused unit tests for `selection.ts`

Create `selection.test.ts` and cover plain text plus inline markdown cases.

**Files**

* `selection.test.ts`

**Done when**

* Tests cover:

  * collapsed selection round-trip
  * range selection round-trip
  * out-of-root selection safety
  * offset clamping
  * inline markdown strings with bold, italic, code

---

## Phase 3 — Refactor `BlockWrapper` to use logical selection snapshots

### Task 10. Refactor Backspace block-start guard to use logical selection helper

Update `BlockWrapper` so block-level destructive Backspace behavior only runs when the logical selection is collapsed, inside the editable root, and exactly at offset `0`.

**Files**

* `BlockWrapper.tsx`

**Done when**

* `handleKeyDown` no longer makes block-start decisions directly from a raw DOM selection snapshot.
* Existing intended block-start behavior still passes tests.

---

### Task 11. Snapshot and restore logical selection around every text rewrite

Update `BlockWrapper` paths that rewrite editable text so they capture logical selection before mutation and restore it afterward.

**Files**

* `BlockWrapper.tsx`

**Done when**

* Normalization rewrite path snapshots and restores selection.
* Plugin update rewrite path snapshots and restores selection.
* Tests for caret preservation pass.

---

### Task 12. Avoid unnecessary `textContent` rewrites

Add guards so `BlockWrapper` only writes `editableRef.current.textContent` when the next raw text actually differs.

**Files**

* `BlockWrapper.tsx`

**Done when**

* No-op updates do not rewrite the editable DOM.
* Existing behavior remains unchanged except for reduced selection churn.

---

### Task 13. Introduce a small internal text-mutation helper

Factor the repeated “snapshot selection → write text → restore selection” flow into a small helper inside `BlockWrapper.tsx` or a nearby utility.

**Files**

* `BlockWrapper.tsx`
* optional helper file if clearly justified

**Done when**

* Normalization and plugin update paths use the shared helper.
* Selection restore logic is not duplicated in multiple branches.

---

## Phase 4 — Integration regression coverage in editor

### Task 14. Add `MicroMDEditor` integration test file if missing

Create `MicroMDEditor.test.tsx` or extend existing tests to cover multi-block behavior.

**Files**

* `MicroMDEditor.test.tsx`

**Done when**

* Test file renders the editor and can simulate block merge / focus restoration flows.

---

### Task 15. Add integration test: merge with previous block keeps caret at join point

Test merging a block containing inline markdown into the previous block and verify focus lands at the expected logical join offset.

**Files**

* `MicroMDEditor.test.tsx`

**Done when**

* The test verifies the join-point offset is correct after merge.

---

### Task 16. Add integration test: focus restoration remains correct across inline markdown blocks

Test focus movement or restoration between blocks containing inline markdown.

**Files**

* `MicroMDEditor.test.tsx`

**Done when**

* Focus does not jump to the wrong location after block operations.

---

### Task 17. Add integration test: `onChange` preserves raw markdown

Test that interacting with decorated inline content does not mutate stored markdown into formatted HTML or any non-raw representation.

**Files**

* `MicroMDEditor.test.tsx`

**Done when**

* `onChange` output stays raw markdown.

---

## Phase 5 — Exports and cleanup

### Task 18. Export new selection helpers if needed

Update public exports so test and editor code can import the new logical selection helpers consistently.

**Files**

* `index.ts`

**Done when**

* The new helpers are exported if they are part of the intended module surface.
* No broken imports remain.

---

### Task 19. Run and stabilize full test suite

Run the full suite and fix any regressions introduced by the selection refactor.

**Files**

* any touched files

**Done when**

* New regression tests pass.
* Existing tokenizer tests pass.
* Existing plugin tests pass.
* No unrelated behavior regressions are introduced.

---

## Acceptance checklist

* Backspace inside inline markdown does not accidentally merge/delete the block.
* Backspace at true logical offset `0` still performs intended block-start behavior.
* Range selection Backspace never uses block-start destructive logic.
* Caret round-trip is stable across bold, italic, and inline code.
* Caret is preserved after normalization rewrites.
* Caret is preserved after plugin update rewrites.
* Multi-block merge/focus behavior remains correct.
* `onChange` output remains raw markdown.
* Existing tests stay green.

---

## Suggested execution order for agent loop

1. Task 1
2. Task 2
3. Task 3
4. Task 4
5. Task 5
6. Task 6
7. Task 7
8. Task 8
9. Task 9
10. Task 10
11. Task 11
12. Task 12
13. Task 13
14. Task 14
15. Task 15
16. Task 16
17. Task 17
18. Task 18
19. Task 19
