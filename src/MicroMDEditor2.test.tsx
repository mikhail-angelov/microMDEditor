import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import { MicroMDEditor2 } from './MicroMDEditor2';

describe('MicroMDEditor2', () => {
  it('renders markdown into a single editable root and emits markdown changes', () => {
    const onChange = jest.fn();
    const { container } = render(
      <MicroMDEditor2
        initialMarkdown={'# Title\n\nParagraph'}
        onChange={onChange}
      />,
    );

    const root = container.querySelector('[contenteditable="true"]') as HTMLElement | null;
    expect(root).not.toBeNull();
    expect(root?.querySelector('h1')?.textContent).toBe('# Title');
    expect(root?.querySelector('div[data-block-type="paragraph"]')?.textContent).toBe('Paragraph');

    if (!root) {
      throw new Error('Missing editable root');
    }

    root.innerHTML = '<h1 data-block-type="heading1"># Updated</h1><div data-block-type="paragraph">Next</div>';
    fireEvent.input(root);

    expect(onChange).toHaveBeenLastCalledWith('# Updated\n\nNext');
  });

  it('keeps heading markers visible and supports h2 blocks', () => {
    const { container } = render(
      <MicroMDEditor2
        initialMarkdown={'# Title\n\n## Subtitle\n\nParagraph'}
      />,
    );

    const root = container.querySelector('[contenteditable="true"]') as HTMLElement | null;
    expect(root).not.toBeNull();
    expect(root?.querySelector('h1')?.textContent).toBe('# Title');
    expect(root?.querySelector('h2')?.textContent).toBe('## Subtitle');
    expect(root?.querySelector('div[data-block-type="paragraph"]')?.textContent).toBe('Paragraph');
  });

  it('reclassifies heading levels from edited text instead of re-adding removed markers', () => {
    const onChange = jest.fn();
    const { container } = render(
      <MicroMDEditor2
        initialMarkdown={'## Subtitle'}
        onChange={onChange}
      />,
    );

    const root = container.querySelector('[contenteditable="true"]') as HTMLElement | null;
    expect(root).not.toBeNull();

    const block = root?.querySelector('h2') as HTMLElement | null;
    expect(block?.textContent).toBe('## Subtitle');

    if (!root || !block) {
      throw new Error('Missing editable heading');
    }

    block.textContent = '# Subtitle';
    fireEvent.input(root);

    expect(onChange).toHaveBeenLastCalledWith('# Subtitle');
    expect(root.querySelector('h1')?.textContent).toBe('# Subtitle');
    expect(root.querySelector('h2')).toBeNull();
  });

  it('supports visible dash and star list markers', () => {
    const { container } = render(
      <MicroMDEditor2
        initialMarkdown={'- First\n\n* Second\n\nParagraph'}
      />,
    );

    const root = container.querySelector('[contenteditable="true"]') as HTMLElement | null;
    expect(root).not.toBeNull();
    expect(root?.querySelector('div[data-block-type="list-dash"]')?.textContent).toBe('- First');
    expect(root?.querySelector('div[data-block-type="list-star"]')?.textContent).toBe('* Second');
    expect(root?.querySelector('div[data-block-type="paragraph"]')?.textContent).toBe('Paragraph');
  });

  it('reclassifies a list item into a paragraph when the marker is removed', () => {
    const onChange = jest.fn();
    const { container } = render(
      <MicroMDEditor2
        initialMarkdown={'- Item'}
        onChange={onChange}
      />,
    );

    const root = container.querySelector('[contenteditable="true"]') as HTMLElement | null;
    expect(root).not.toBeNull();

    const block = root?.querySelector('div[data-block-type="list-dash"]') as HTMLElement | null;
    expect(block?.textContent).toBe('- Item');

    if (!root || !block) {
      throw new Error('Missing editable list item');
    }

    block.textContent = 'Item';
    fireEvent.input(root);

    expect(onChange).toHaveBeenLastCalledWith('Item');
    expect(root.querySelector('div[data-block-type="paragraph"]')?.textContent).toBe('Item');
    expect(root.querySelector('div[data-block-type="list-dash"]')).toBeNull();
  });

  it('preserves pasted line breaks as separate blocks', () => {
    const onChange = jest.fn();
    const { container } = render(
      <MicroMDEditor2
        initialMarkdown={'Paragraph'}
        onChange={onChange}
      />,
    );

    const root = container.querySelector('[contenteditable="true"]') as HTMLElement | null;
    expect(root).not.toBeNull();

    if (!root) {
      throw new Error('Missing editable root');
    }

    root.innerHTML = '<div data-block-type="paragraph">line 1</div><div data-block-type="paragraph">line 2</div><div data-block-type="paragraph">line 3</div>';
    fireEvent.input(root);

    expect(onChange).toHaveBeenLastCalledWith('line 1\n\nline 2\n\nline 3');
  });

  it('splits multiline text inside one pasted block into separate blocks', () => {
    const onChange = jest.fn();
    const { container } = render(
      <MicroMDEditor2
        initialMarkdown={'Paragraph'}
        onChange={onChange}
      />,
    );

    const root = container.querySelector('[contenteditable="true"]') as HTMLElement | null;
    expect(root).not.toBeNull();

    if (!root) {
      throw new Error('Missing editable root');
    }

    root.innerHTML = '<div data-block-type="paragraph">line 1\nline 2\nline 3</div>';
    fireEvent.input(root);

    expect(onChange).toHaveBeenLastCalledWith('line 1\n\nline 2\n\nline 3');
  });

  it('splits pasted heading-plus-paragraph text into separate block types', () => {
    const onChange = jest.fn();
    const { container } = render(
      <MicroMDEditor2
        initialMarkdown={'Paragraph'}
        onChange={onChange}
      />,
    );

    const root = container.querySelector('[contenteditable="true"]') as HTMLElement | null;
    expect(root).not.toBeNull();

    if (!root) {
      throw new Error('Missing editable root');
    }

    root.innerHTML = '<div data-block-type="paragraph"># title\nparagraph</div>';
    fireEvent.input(root);

    expect(onChange).toHaveBeenLastCalledWith('# title\n\nparagraph');
    expect(root.querySelector('h1')?.textContent).toBe('# title');
    expect(root.querySelector('div[data-block-type="paragraph"]')?.textContent).toBe('paragraph');
  });

  it('preserves line breaks when pasted content uses br nodes', () => {
    const onChange = jest.fn();
    const { container } = render(
      <MicroMDEditor2
        initialMarkdown={'Paragraph'}
        onChange={onChange}
      />,
    );

    const root = container.querySelector('[contenteditable="true"]') as HTMLElement | null;
    expect(root).not.toBeNull();

    if (!root) {
      throw new Error('Missing editable root');
    }

    root.innerHTML = '<div data-block-type="paragraph"># title<br>paragraph</div>';
    fireEvent.input(root);

    expect(onChange).toHaveBeenLastCalledWith('# title\n\nparagraph');
    expect(root.querySelector('h1')?.textContent).toBe('# title');
    expect(root.querySelector('div[data-block-type="paragraph"]')?.textContent).toBe('paragraph');
  });

  it('handles paste via text/plain instead of relying on nested html insertion', () => {
    const onChange = jest.fn();
    const { container } = render(
      <MicroMDEditor2
        initialMarkdown={'Paragraph'}
        onChange={onChange}
      />,
    );

    const root = container.querySelector('[contenteditable="true"]') as HTMLElement | null;
    expect(root).not.toBeNull();

    if (!root) {
      throw new Error('Missing editable root');
    }

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(root);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);

    fireEvent.paste(root, {
      clipboardData: {
        getData: (type: string) => {
          if (type === 'text/plain') {
            return '# Prototype Title\nparagraph';
          }

          if (type === 'text/html') {
            return '<h1># Prototype Title</h1><div>paragraph</div>';
          }

          return '';
        },
      },
    });

    expect(onChange).toHaveBeenLastCalledWith(
      'Paragraph\n\n# Prototype Title\n\nparagraph',
    );
    expect(root.querySelector('h1')?.textContent).toBe('# Prototype Title');
    const paragraphs = root.querySelectorAll('div[data-block-type="paragraph"]');
    expect(paragraphs[0]?.textContent).toBe('Paragraph');
    expect(paragraphs[1]?.textContent).toBe('paragraph');
  });

  it('places the caret at the end of the last pasted block', () => {
    const { container } = render(
      <MicroMDEditor2 initialMarkdown={'Paragraph'} />
    );

    const root = container.querySelector('[contenteditable="true"]') as HTMLElement | null;
    expect(root).not.toBeNull();

    if (!root) {
      throw new Error('Missing editable root');
    }

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(root);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);

    fireEvent.paste(root, {
      clipboardData: {
        getData: (type: string) => {
          if (type === 'text/plain') {
            return '# Title\nparagraph';
          }
          return '';
        },
      },
    });

    const currentSelection = window.getSelection();
    expect(currentSelection?.rangeCount).toBe(1);
    expect(currentSelection?.isCollapsed).toBe(true);
  });
});
