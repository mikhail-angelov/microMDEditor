import React from 'react';
import { render } from '@testing-library/react';
import { DecorationLayer } from './DecorationLayer';

function renderText(text: string) {
  return render(<DecorationLayer text={text} blockType="paragraph" />);
}

describe('DecorationLayer', () => {
  it('renders bold with metric-safe span class instead of strong', () => {
    const { container } = renderText('This is **bold** text');

    expect(container.querySelector('strong')).toBeNull();
    expect(container.querySelector('.md-inline-bold')?.textContent).toBe('bold');
  });

  it('renders italic and inline code with metric-safe classes', () => {
    const { container } = renderText('A *lean* `code` sample');

    expect(container.querySelector('em')).toBeNull();
    expect(container.querySelector('code')).toBeNull();
    expect(container.querySelector('.md-inline-italic')?.textContent).toBe('lean');
    expect(container.querySelector('.md-inline-code')?.textContent).toBe('code');
  });

  it('renders strike-through tokens', () => {
    const { container } = renderText('Use ~~old~~ new');
    expect(container.querySelector('.md-inline-strike')?.textContent).toBe('old');
  });

  it('keeps markdown syntax nodes in the DOM so width is preserved', () => {
    const { container } = renderText('**bold**');
    const syntaxNodes = [...container.querySelectorAll('.md-syntax')].map((el) => el.textContent);
    expect(syntaxNodes).toEqual(['**', '**']);
  });
});
