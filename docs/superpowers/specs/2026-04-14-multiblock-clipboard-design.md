# Multi-Block Clipboard Support Design

## Goal

Add reliable `Cmd/Ctrl+C`, `Cmd/Ctrl+X`, and `Cmd/Ctrl+V` behavior for selections that span multiple editor blocks without replacing the current block-based architecture.

The feature should preserve markdown text exactly, operate on plain-text clipboard data, and keep existing block-local typing behavior intact.

## Current Context

The editor currently uses a Notion-style structure:

- `MicroMDEditor` owns block state and focus orchestration.
- `BlockWrapper` renders one `contentEditable` per block.
- Selection helpers work only within a single block root.
- Plugins handle block-local Enter and Backspace behavior.

This makes single-block editing straightforward, but browser-native clipboard behavior across multiple `contentEditable` roots is not sufficient for predictable editor semantics.

## Scope

In scope:

- Multi-block copy to plain text clipboard
- Multi-block cut with correct range deletion
- Multi-block paste replacing a collapsed or expanded selection
- Selection normalization for forward and backward selections
- Caret restoration after cut and paste
- Test coverage for clipboard-driven range mutations

Out of scope:

- Rich HTML clipboard import or export
- Drag-and-drop text movement
- Cross-editor interoperability beyond `text/plain`
- Reworking block-local plugin behavior outside clipboard-triggered mutations
- Converting the editor to a single unified `contentEditable`

## Requirements

### User-visible behavior

1. A user can select text that starts in one block and ends in another.
2. Copying that selection writes the exact markdown slice to the clipboard as plain text.
3. Cutting that selection writes the same plain text to the clipboard and removes the selected range from editor state.
4. Pasting plain text over a collapsed caret inserts the text at that position.
5. Pasting plain text over an expanded selection replaces the selected range, even when the range spans multiple blocks.
6. If the pasted text contains line breaks or markdown block markers, the inserted content is parsed into blocks using existing parsing rules.
7. After cut or paste, the caret lands at the end of the inserted or surviving content in a deterministic position.

### Preservation rules

1. The clipboard payload uses `text/plain` only.
2. Serialization preserves exact markdown characters from selected blocks, including newlines between blocks.
3. Range replacement preserves the unselected prefix of the first block and unselected suffix of the last block.
4. The editor must always retain at least one block after a cut or paste operation.

## Proposed Approach

Implement editor-level logical range handling while keeping per-block `contentEditable` islands.

The core idea is:

1. Resolve the native DOM selection into logical block endpoints.
2. Normalize those endpoints into a forward logical range.
3. Use block-aware utilities to serialize or replace the selected markdown slice.
4. Restore focus and caret based on the logical insertion result.

This keeps the current architecture intact and limits the new behavior to clipboard-triggered mutations.

## Architecture

### 1. Editor-level logical range model

Add a new logical range shape:

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

This model represents a selection across the ordered block list, independent of DOM node structure.

### 2. DOM-to-logical selection resolution

Add utilities that:

- detect whether the current DOM selection is fully inside the editor
- find which registered block root contains each endpoint
- convert each endpoint to a block-local text offset
- normalize endpoint order for backward selections

These utilities will be editor-level because the selection may span multiple block roots.

### 3. Logical range serialization

Add a utility that converts a `BlockRange` plus the current `blocks` array into a markdown string:

- if start and end are in the same block, return the selected substring
- if the selection spans multiple blocks, concatenate:
  - first block selected suffix
  - full intermediate blocks
  - last block selected prefix
  - `\n` separators between block fragments

The output should match what users would expect from the editor's markdown representation.

### 4. Logical range replacement

Add a utility that replaces the selected range with pasted markdown text.

The replacement algorithm:

1. Split the first selected block into `prefix` and selected remainder.
2. Split the last selected block into selected remainder and `suffix`.
3. Parse pasted markdown with the existing `parseMarkdown`.
4. Merge `prefix` into the first inserted block.
5. Merge `suffix` into the last inserted block.
6. Splice the resulting block sequence into the original block list.
7. If pasted text is empty, collapse to the merged surviving content.
8. If the operation would leave zero blocks, create one empty paragraph block.

This utility should also report where the caret should land after replacement.

### 5. Clipboard event ownership

`MicroMDEditor` should own `onCopy`, `onCut`, and `onPaste` at the editor container level.

Behavior:

- `copy`
  - if selection does not resolve to an editor range, do nothing
  - if selection resolves, write serialized markdown to `event.clipboardData`
  - call `preventDefault()` only when custom clipboard text is written

- `cut`
  - perform `copy` behavior first
  - replace the resolved range with an empty string
  - update state and restore caret

- `paste`
  - read `text/plain` from `event.clipboardData`
  - if unavailable, allow native fallback
  - replace the resolved selection or collapsed caret with pasted text
  - update state and restore caret

### 6. Focus and caret restoration

Extend the existing pending-focus mechanism so clipboard mutations can target:

- block id
- collapsed caret offset within that block

Clipboard operations should always restore a collapsed caret, not a range selection.

## Detailed Behavior

### Copy

- Copying within one block should continue to work and now route through the same logical range serializer.
- Copying across blocks should include newline separators exactly once between block fragments.
- Full-block selections should serialize to the exact block raw text.

### Cut

- Cutting a partial range within one block behaves like text deletion.
- Cutting from the middle of one block to the middle of another merges the surviving prefix and suffix into one resulting block.
- Cutting the full document leaves a single empty paragraph block.

### Paste

- Pasting plain text into one block inserts within that block unless the pasted text parses into multiple blocks.
- Pasting multiline markdown into a collapsed caret may split the host block into prefix and suffix around inserted blocks.
- Pasting over a multi-block selection replaces that full range in one structural update.

### Existing keyboard behavior

Enter, Backspace, ArrowUp, and ArrowDown behavior remain block-local and unchanged unless they operate on the content produced by a prior clipboard mutation.

## Error Handling

- If there is no selection, no clipboard handling occurs.
- If selection endpoints cannot be mapped to known block roots, the editor should fall back to native behavior.
- If clipboard data is unavailable on paste, the editor should fall back to native behavior.
- If a replacement calculation fails unexpectedly, the editor should avoid partial mutation and preserve previous state.

## Testing Plan

Add or update tests for:

1. DOM selection to logical range resolution
2. Range normalization for backward selections
3. Same-block serialization
4. Multi-block serialization with partial first and last blocks
5. Cut across multiple blocks with prefix/suffix merge
6. Paste multiline markdown into collapsed caret
7. Paste over multi-block selection
8. Full-document cut leaving one empty block
9. Caret restoration after paste and cut

Recommended placement:

- selection/range utility tests near `src/selection.test.ts`
- editor clipboard integration tests near `src/MicroMDEditor.test.tsx`

## Risks and Mitigations

### Risk: DOM selection across separate `contentEditable` roots is inconsistent

Mitigation:

- Use explicit block root registration and endpoint containment checks
- Fall back to native behavior if selection cannot be resolved safely

### Risk: Paste may create malformed block merges

Mitigation:

- Centralize replacement logic in one pure utility
- Cover prefix/suffix merge cases with targeted tests

### Risk: Clipboard handlers interfere with native single-block editing

Mitigation:

- Only call `preventDefault()` when custom handling succeeds
- Reuse the same logical path for single-block and multi-block selections to avoid behavior drift

## Implementation Notes

- Prefer pure helper functions for serialization and replacement so they can be tested without DOM integration.
- Keep `BlockWrapper` responsibilities local to block editing; do not move clipboard mutation logic into each block.
- Reuse existing `parseMarkdown`, `blocksToMarkdown`, `detectType`, and caret placement helpers where possible.

## Success Criteria

The feature is complete when:

1. Users can copy, cut, and paste selections spanning multiple blocks using `Cmd/Ctrl+C`, `Cmd/Ctrl+X`, and `Cmd/Ctrl+V`.
2. Clipboard text matches the selected markdown slice exactly.
3. Editor state remains structurally valid after all supported clipboard operations.
4. Existing block-local editing behavior remains unchanged outside clipboard workflows.
5. Automated tests cover the main serialization, replacement, and caret restoration paths.
