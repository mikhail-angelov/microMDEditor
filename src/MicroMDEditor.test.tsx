import { fireEvent, render } from "@testing-library/react";
import { MicroMDEditor } from "./MicroMDEditor";
import { createEditorCore } from "./core";
import { ensureEditableRoot, renderBlocks } from "./core/render";
import type { RenderableBlock } from "./core/types";

describe("MicroMDEditor render", () => {
  it("renders one editable root with top-level block nodes", () => {
    const { container } = render(
      <MicroMDEditor initialMarkdown={"# Title\n\n- item\n\nparagraph"} />
    );

    const root = container.querySelector('[contenteditable="true"]');
    expect(root).not.toBeNull();
    expect(container.querySelectorAll('[contenteditable="true"]')).toHaveLength(1);
    expect(root?.children).toHaveLength(3);
    expect(root?.children[0].getAttribute("data-block-id")).not.toBeNull();
    expect(root?.children[0].getAttribute("data-block-type")).toBe("heading");
    expect(root?.children[1].getAttribute("data-block-id")).not.toBeNull();
    expect(root?.children[1].getAttribute("data-block-type")).toBe("unordered-list");
    expect(root?.children[2].getAttribute("data-block-id")).not.toBeNull();
    expect(root?.children[2].getAttribute("data-block-type")).toBe("paragraph");
  });

  it("keeps a single editable root across rerenders", () => {
    const { container, rerender } = render(<MicroMDEditor initialMarkdown={"# Title"} />);

    const initialRoot = container.querySelector('[contenteditable="true"]');
    expect(initialRoot).not.toBeNull();
    expect(container.querySelectorAll('[contenteditable="true"]')).toHaveLength(1);

    rerender(<MicroMDEditor initialMarkdown={"paragraph\n\n- item"} />);

    const updatedRoot = container.querySelector('[contenteditable="true"]');
    expect(updatedRoot).not.toBeNull();
    expect(container.querySelectorAll('[contenteditable="true"]')).toHaveLength(1);
    expect(updatedRoot).toBe(initialRoot);
    expect(updatedRoot?.children).toHaveLength(2);
    expect(updatedRoot?.children[0].getAttribute("data-block-type")).toBe("paragraph");
    expect(updatedRoot?.children[1].getAttribute("data-block-type")).toBe("unordered-list");
  });
});

describe("render helpers", () => {
  it("renders passed blocks without parsing markdown inside the renderer", () => {
    const root = document.createElement("div");
    const blocks: RenderableBlock[] = [
      { id: "block-1", type: "paragraph", raw: "# not a heading block" },
      { id: "block-2", type: "heading", raw: "plain text heading block" },
    ];

    renderBlocks(root, blocks);

    expect(root.children).toHaveLength(2);
    expect(root.children[0].getAttribute("data-block-id")).toBe("block-1");
    expect(root.children[0].getAttribute("data-block-type")).toBe("paragraph");
    expect(root.children[0].textContent).toBe("# not a heading block");
    expect(root.children[1].getAttribute("data-block-id")).toBe("block-2");
    expect(root.children[1].getAttribute("data-block-type")).toBe("heading");
    expect(root.children[1].textContent).toBe("plain text heading block");
  });

  it("owns a direct child editor root instead of reusing a nested descendant", () => {
    const host = document.createElement("div");
    const wrapper = document.createElement("div");
    const nestedRoot = document.createElement("div");
    nestedRoot.setAttribute("data-mmd-editor-root", "true");
    nestedRoot.setAttribute("contenteditable", "true");
    wrapper.appendChild(nestedRoot);
    host.appendChild(wrapper);

    const root = ensureEditableRoot(host);

    expect(root.parentElement).toBe(host);
    expect(root).toBe(host.firstElementChild);
    expect(host.children).toHaveLength(1);
    expect(root.getAttribute("data-mmd-editor-root")).toBe("true");
    expect(root.getAttribute("contenteditable")).toBe("true");
  });

  it("reasserts host shape to a single owned editor root when reusing", () => {
    const host = document.createElement("div");
    const ownedRoot = document.createElement("div");
    const straySibling = document.createElement("div");
    ownedRoot.setAttribute("data-mmd-editor-root", "true");
    ownedRoot.setAttribute("contenteditable", "false");
    host.append(ownedRoot, straySibling);

    const root = ensureEditableRoot(host);

    expect(root).toBe(ownedRoot);
    expect(host.children).toHaveLength(1);
    expect(host.firstElementChild).toBe(ownedRoot);
    expect(root.getAttribute("contenteditable")).toBe("true");
  });
});

describe("MicroMDEditor shell", () => {
  it("emits markdown changes from the imperative core", () => {
    const onChange = jest.fn();
    const { container } = render(
      <MicroMDEditor initialMarkdown={"paragraph"} onChange={onChange} />
    );

    const root = container.querySelector('[contenteditable="true"]') as HTMLElement;
    root.innerHTML = '<div data-block-id="a" data-block-type="heading"># Title</div>';
    root.dispatchEvent(new Event("input", { bubbles: true }));

    expect(onChange).toHaveBeenLastCalledWith("# Title");
  });

  it("emits multiline markdown when edited DOM uses br nodes", () => {
    const onChange = jest.fn();
    const { container } = render(
      <MicroMDEditor initialMarkdown={"paragraph"} onChange={onChange} />
    );

    const root = container.querySelector('[contenteditable="true"]') as HTMLElement;
    root.innerHTML =
      '<div data-block-id="a" data-block-type="paragraph">first line<br>second line</div>';
    root.dispatchEvent(new Event("input", { bubbles: true }));

    expect(onChange).toHaveBeenLastCalledWith("first line\nsecond line");
  });

  it("uses the latest onChange callback after rerender", () => {
    const firstOnChange = jest.fn();
    const secondOnChange = jest.fn();
    const { container, rerender } = render(
      <MicroMDEditor initialMarkdown={"paragraph"} onChange={firstOnChange} />
    );

    rerender(<MicroMDEditor initialMarkdown={"paragraph"} onChange={secondOnChange} />);

    const root = container.querySelector('[contenteditable="true"]') as HTMLElement;
    root.innerHTML = '<div data-block-id="a" data-block-type="heading"># Updated</div>';
    root.dispatchEvent(new Event("input", { bubbles: true }));

    expect(firstOnChange).not.toHaveBeenCalled();
    expect(secondOnChange).toHaveBeenLastCalledWith("# Updated");
  });

  it("uses text/plain paste instead of nested html insertion", () => {
    const onChange = jest.fn();
    const { container } = render(
      <MicroMDEditor initialMarkdown={"Paragraph"} onChange={onChange} />
    );
    const root = container.querySelector('[contenteditable="true"]') as HTMLElement;
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.selectNodeContents(root);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);

    fireEvent.paste(root, {
      clipboardData: {
        getData: (type: string) =>
          type === "text/plain" ? "# Title\nparagraph" : "<h1># Title</h1>",
      },
    });

    expect(onChange).toHaveBeenLastCalledWith("Paragraph\n\n# Title\n\nparagraph");
  });
});

describe("code fence Enter handling", () => {
  it("inserts a newline inside the code fence and keeps the block intact", () => {
    const onChange = jest.fn();
    const { container } = render(
      <MicroMDEditor
        initialMarkdown={"```\nline one\nline two\n```"}
        onChange={onChange}
      />
    );

    const root = container.querySelector('[contenteditable="true"]') as HTMLElement;
    // There must be exactly one block — the code fence
    expect(root.children).toHaveLength(1);
    expect(root.children[0].getAttribute("data-block-type")).toBe("code-fence");

    const fenceBlock = root.children[0] as HTMLElement;
    const textNode = fenceBlock.firstChild as Text;

    // Place cursor after "```\nline one\n" (offset 13)
    const sel = window.getSelection()!;
    const range = document.createRange();
    range.setStart(textNode, 13);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);

    // Press Enter
    fenceBlock.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
    );

    // Still one block — no split
    expect(root.children).toHaveLength(1);
    expect(root.children[0].getAttribute("data-block-type")).toBe("code-fence");

    // Newline inserted at position 13
    expect(onChange).toHaveBeenLastCalledWith("```\nline one\n\nline two\n```");
  });

  it("does not let browser split the code fence div on Enter", () => {
    const { container } = render(
      <MicroMDEditor initialMarkdown={"```\ncode here\n```"} />
    );

    const root = container.querySelector('[contenteditable="true"]') as HTMLElement;
    const fenceBlock = root.children[0] as HTMLElement;
    const textNode = fenceBlock.firstChild as Text;

    const sel = window.getSelection()!;
    const range = document.createRange();
    range.setStart(textNode, 4); // after "```\n"
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);

    const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    fenceBlock.dispatchEvent(event);

    // event.preventDefault() must have been called — browser default suppressed
    expect(event.defaultPrevented).toBe(true);
    // The block is still a single code fence
    expect(root.children).toHaveLength(1);
    expect(root.children[0].getAttribute("data-block-type")).toBe("code-fence");
  });
});

describe("EditorCore teardown", () => {
  it("preserves unrelated host siblings when destroyed", () => {
    const host = document.createElement("div");
    const core = createEditorCore(host, { initialMarkdown: "paragraph" });
    const unrelatedSibling = document.createElement("div");
    unrelatedSibling.setAttribute("data-unrelated", "true");
    unrelatedSibling.textContent = "keep me";
    host.appendChild(unrelatedSibling);

    core.destroy();

    expect(host.querySelector('[data-mmd-editor-root="true"]')).toBeNull();
    expect(host.children).toHaveLength(1);
    expect(host.firstElementChild).toBe(unrelatedSibling);
    expect(host.querySelector('[data-unrelated="true"]')).toBe(unrelatedSibling);
  });
});
