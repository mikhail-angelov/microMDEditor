# Task Progress for Cursor/Backspace Bug Fix

## Based on patch2.md plan

### Step 1 — Add regression tests for BlockWrapper
- [x] Create `BlockWrapper.test.tsx` with tests for:
  - [x] Backspace inside `**bold**` does not call `onMergeWithPrevious`
  - [x] Backspace at true offset 0 does call merge/delete path
  - [x] Range selection + Backspace does not trigger merge/delete
  - [x] Plugin update preserves caret
  - [x] Normalize preserves caret
  - [x] Round-trip logical caret placement on inline markdown

### Step 2 — Create selection helper module
- [x] Create `selection.ts` with:
  - [x] `getSelectionOffsets` function
  - [x] `restoreSelectionOffsets` function
  - [x] `isCaretAtStart` function
  - [x] `isCaretAtEnd` function
- [x] Create `selection.test.ts` for round-trip placement tests

### Step 3 — Refactor BlockWrapper to use logical selection
- [x] Update `handleKeyDown` to use logical selection
- [x] Update `handleInput` to snapshot/restore logical selection
- [x] Update `applyPluginResult` to use logical selection
- [x] Avoid unnecessary `textContent` rewrites
- [x] Replace simple `delta` arithmetic with offset mapping

### Step 4 — Add integration tests for MicroMDEditor
- [x] Create `MicroMDEditor.test.tsx` or extend existing tests
- [x] Test merge join point offset
- [x] Test focus restoration after merge
- [x] Test raw markdown output stability with inline decorations

### Step 5 — Export new utilities
- [x] Update `index.ts` exports if needed

### Step 6 — Verify all tests pass
- [x] Run existing tests to ensure they still pass
- [x] Run new tests to verify fixes work
