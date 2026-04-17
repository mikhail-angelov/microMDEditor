import {
  extractRootPlainText,
  getLogicalSelection,
  restoreLogicalSelection,
} from "./selection";

describe("selection mapping", () => {
  it("preserves line breaks represented by br nodes", () => {
    document.body.innerHTML = `
      <div id="root" contenteditable="true">
        <div data-block-id="a"># title<br>paragraph</div>
      </div>
    `;
    const root = document.getElementById("root") as HTMLDivElement;
    expect(extractRootPlainText(root)).toBe("# title\nparagraph");
  });

  it("maps and restores a range across two top-level blocks", () => {
    document.body.innerHTML = `
      <div id="root" contenteditable="true">
        <div data-block-id="a"># title</div>
        <div data-block-id="b">paragraph</div>
      </div>
    `;
    const root = document.getElementById("root") as HTMLDivElement;
    const selection = window.getSelection()!;
    const firstText = root.children[0].firstChild!;
    const secondText = root.children[1].firstChild!;
    const range = document.createRange();

    range.setStart(firstText, 2);
    range.setEnd(secondText, 4);
    selection.removeAllRanges();
    selection.addRange(range);

    const logical = getLogicalSelection(root);
    restoreLogicalSelection(root, logical!);

    expect(logical?.start.blockId).toBe("a");
    expect(logical?.start.offset).toBe(2);
    expect(logical?.end.blockId).toBe("b");
    expect(logical?.end.offset).toBe(4);

    const restoredSelection = window.getSelection();
    expect(restoredSelection?.rangeCount).toBe(1);

    const restoredRange = restoredSelection?.getRangeAt(0);
    expect(restoredRange?.startContainer).toBe(firstText);
    expect(restoredRange?.startOffset).toBe(2);
    expect(restoredRange?.endContainer).toBe(secondText);
    expect(restoredRange?.endOffset).toBe(4);
  });

  it("maps and restores a root-boundary caret between top-level blocks", () => {
    document.body.innerHTML = `
      <div id="root" contenteditable="true">
        <div data-block-id="a"># title</div>
        <div data-block-id="b">paragraph</div>
      </div>
    `;
    const root = document.getElementById("root") as HTMLDivElement;
    const selection = window.getSelection()!;
    const secondBlock = root.children[1] as HTMLElement;
    const secondText = root.children[1].firstChild!;
    const beforeSecondBlockOffset = Array.prototype.indexOf.call(root.childNodes, secondBlock);
    const range = document.createRange();

    range.setStart(root, beforeSecondBlockOffset);
    range.setEnd(root, beforeSecondBlockOffset);
    selection.removeAllRanges();
    selection.addRange(range);

    const logical = getLogicalSelection(root);
    expect(logical).toEqual({
      start: { blockId: "b", offset: 0 },
      end: { blockId: "b", offset: 0 },
      isCollapsed: true,
    });

    restoreLogicalSelection(root, logical!);

    const restoredSelection = window.getSelection();
    expect(restoredSelection?.rangeCount).toBe(1);
    const restoredRange = restoredSelection?.getRangeAt(0);
    expect(restoredRange?.startContainer).toBe(secondText);
    expect(restoredRange?.startOffset).toBe(0);
    expect(restoredRange?.endContainer).toBe(secondText);
    expect(restoredRange?.endOffset).toBe(0);
  });

  it("throws when selected top-level block has no data-block-id", () => {
    document.body.innerHTML = `
      <div id="root" contenteditable="true">
        <div># title</div>
        <div data-block-id="b">paragraph</div>
      </div>
    `;
    const root = document.getElementById("root") as HTMLDivElement;
    const selection = window.getSelection()!;
    const firstText = root.children[0].firstChild!;
    const range = document.createRange();

    range.setStart(firstText, 1);
    range.setEnd(firstText, 3);
    selection.removeAllRanges();
    selection.addRange(range);

    expect(() => getLogicalSelection(root)).toThrow("data-block-id");
  });
});
