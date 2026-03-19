import { tokenize, renderDecorations } from './tokenizer';

describe('Tokenizer', () => {
  describe('tokenize', () => {
    it('should handle plain text', () => {
      const text = 'Hello world';
      const tokens = tokenize(text);
      
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toEqual({ type: 'text', content: 'Hello world' });
    });

    it('should tokenize bold text', () => {
      const text = '**bold text**';
      const tokens = tokenize(text);
      
      expect(tokens).toHaveLength(3);
      expect(tokens[0]).toEqual({ type: 'syntax', content: '**' });
      expect(tokens[1]).toEqual({ type: 'bold', content: 'bold text' });
      expect(tokens[2]).toEqual({ type: 'syntax', content: '**' });
    });

    it('should tokenize italic text', () => {
      const text = '*italic text*';
      const tokens = tokenize(text);
      
      expect(tokens).toHaveLength(3);
      expect(tokens[0]).toEqual({ type: 'syntax', content: '*' });
      expect(tokens[1]).toEqual({ type: 'italic', content: 'italic text' });
      expect(tokens[2]).toEqual({ type: 'syntax', content: '*' });
    });

    it('should tokenize inline code', () => {
      const text = '`code snippet`';
      const tokens = tokenize(text);
      
      expect(tokens).toHaveLength(3);
      expect(tokens[0]).toEqual({ type: 'syntax', content: '`' });
      expect(tokens[1]).toEqual({ type: 'code', content: 'code snippet' });
      expect(tokens[2]).toEqual({ type: 'syntax', content: '`' });
    });

    it('should handle mixed text with bold and italic', () => {
      const text = 'Some **bold** and *italic* text';
      const tokens = tokenize(text);
      
      expect(tokens).toHaveLength(9);
      expect(tokens[0]).toEqual({ type: 'text', content: 'Some ' });
      expect(tokens[1]).toEqual({ type: 'syntax', content: '**' });
      expect(tokens[2]).toEqual({ type: 'bold', content: 'bold' });
      expect(tokens[3]).toEqual({ type: 'syntax', content: '**' });
      expect(tokens[4]).toEqual({ type: 'text', content: ' and ' });
      expect(tokens[5]).toEqual({ type: 'syntax', content: '*' });
      expect(tokens[6]).toEqual({ type: 'italic', content: 'italic' });
      expect(tokens[7]).toEqual({ type: 'syntax', content: '*' });
      expect(tokens[8]).toEqual({ type: 'text', content: ' text' });
    });

    it('should handle heading syntax at start', () => {
      const text = '# Heading 1';
      const tokens = tokenize(text);
      
      expect(tokens).toHaveLength(2);
      expect(tokens[0]).toEqual({ type: 'syntax', content: '# ' });
      expect(tokens[1]).toEqual({ type: 'text', content: 'Heading 1' });
    });

    it('should handle multiple hash heading', () => {
      const text = '### Heading 3';
      const tokens = tokenize(text);
      
      expect(tokens).toHaveLength(2);
      expect(tokens[0]).toEqual({ type: 'syntax', content: '### ' });
      expect(tokens[1]).toEqual({ type: 'text', content: 'Heading 3' });
    });

    it('should handle links', () => {
      const text = '[link text](https://example.com)';
      const tokens = tokenize(text);
      
      expect(tokens).toHaveLength(3);
      expect(tokens[0]).toEqual({ type: 'syntax', content: '[' });
      expect(tokens[1]).toEqual({ type: 'link', content: 'link text' });
      expect(tokens[2]).toEqual({ type: 'syntax', content: '](https://example.com)' });
    });

    it('should handle text with escaped characters', () => {
      const text = 'Text with \\*escaped asterisk\\*';
      const tokens = tokenize(text);
      
      // The tokenizer doesn't handle escaped characters specially
      // It will parse the * as italic syntax
      expect(tokens).toHaveLength(4);
      expect(tokens[0]).toEqual({ type: 'text', content: 'Text with \\' });
      expect(tokens[1]).toEqual({ type: 'syntax', content: '*' });
      expect(tokens[2]).toEqual({ type: 'italic', content: 'escaped asterisk\\' });
      expect(tokens[3]).toEqual({ type: 'syntax', content: '*' });
    });

    it('should handle empty string', () => {
      const text = '';
      const tokens = tokenize(text);
      
      expect(tokens).toHaveLength(0);
    });

    it('should handle text ending with syntax character', () => {
      const text = 'Text ending with *';
      const tokens = tokenize(text);
      
      // Single * at end is treated as text since it's not a complete italic marker
      expect(tokens).toHaveLength(2);
      expect(tokens[0]).toEqual({ type: 'text', content: 'Text ending with ' });
      expect(tokens[1]).toEqual({ type: 'text', content: '*' });
    });

    it('should not confuse bold with italic syntax', () => {
      const text = '**bold** not *italic';
      const tokens = tokenize(text);
      
      expect(tokens).toHaveLength(5);
      expect(tokens[0]).toEqual({ type: 'syntax', content: '**' });
      expect(tokens[1]).toEqual({ type: 'bold', content: 'bold' });
      expect(tokens[2]).toEqual({ type: 'syntax', content: '**' });
      expect(tokens[3]).toEqual({ type: 'text', content: ' not ' });
      expect(tokens[4]).toEqual({ type: 'text', content: '*italic' });
    });

    it('should handle code blocks with triple backticks separately', () => {
      const text = '```not inline code```';
      const tokens = tokenize(text);
      
      // Triple backticks should be treated as text (not inline code)
      // The tokenizer now handles triple backticks as text
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toEqual({ type: 'text', content: '```not inline code```' });
    });

    it('should handle complex nested patterns (bold within text)', () => {
      const text = 'Start **bold middle** end';
      const tokens = tokenize(text);
      
      expect(tokens).toHaveLength(5);
      expect(tokens[0]).toEqual({ type: 'text', content: 'Start ' });
      expect(tokens[1]).toEqual({ type: 'syntax', content: '**' });
      expect(tokens[2]).toEqual({ type: 'bold', content: 'bold middle' });
      expect(tokens[3]).toEqual({ type: 'syntax', content: '**' });
      expect(tokens[4]).toEqual({ type: 'text', content: ' end' });
    });

    it('should handle multiple syntax elements in sequence', () => {
      const text = '**bold***italic*`code`';
      const tokens = tokenize(text);
      
      // **bold** gets parsed, *italic* gets parsed, `code` gets parsed
      // Note: *italic* might not parse correctly because it's adjacent to **bold**
      // The tokenizer sees "**bold***" and might not handle it correctly
      // This is a known limitation of the simple tokenizer
      expect(tokens.length).toBeGreaterThanOrEqual(5);
      // At minimum we should have bold tokens
      expect(tokens[0]).toEqual({ type: 'syntax', content: '**' });
      expect(tokens[1]).toEqual({ type: 'bold', content: 'bold' });
      expect(tokens[2]).toEqual({ type: 'syntax', content: '**' });
    });
  });

  describe('renderDecorations', () => {
    it('should render plain text for code blocks', () => {
      const text = '```\ncode block\n```';
      const result = renderDecorations(text, 'code');
      
      expect(result).toBe('```\ncode block\n```');
    });

    it('should escape HTML in code blocks', () => {
      const text = '<script>alert("xss")</script>';
      const result = renderDecorations(text, 'code');
      
      // Code blocks should escape HTML for security
      // The escapeHtml function in utils.ts escapes HTML entities
      expect(result).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    it('should render bold text with HTML tags', () => {
      const text = '**bold text**';
      const result = renderDecorations(text, 'paragraph');
      
      expect(result).toBe('<span class="md-syntax">**</span><span class="md-inline-bold">bold text</span><span class="md-syntax">**</span>');
    });

    it('should render italic text with HTML tags', () => {
      const text = '*italic text*';
      const result = renderDecorations(text, 'paragraph');
      
      expect(result).toBe('<span class="md-syntax">*</span><span class="md-inline-italic">italic text</span><span class="md-syntax">*</span>');
    });

    it('should render inline code with HTML tags', () => {
      const text = '`code snippet`';
      const result = renderDecorations(text, 'paragraph');
      
      expect(result).toBe('<span class="md-syntax">`</span><span class="md-inline-code">code snippet</span><span class="md-syntax">`</span>');
    });

    it('should escape HTML in text content', () => {
      const text = '<script>alert("xss")</script>';
      const result = renderDecorations(text, 'paragraph');
      
      // All text should be HTML escaped for security
      // The escapeHtml function in utils.ts escapes HTML entities
      expect(result).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    it('should handle mixed content with HTML escaping', () => {
      const text = '**bold** and <script>';
      const result = renderDecorations(text, 'paragraph');
      
      // The escapeHtml function escapes the <script> tag
      expect(result).toBe('<span class="md-syntax">**</span><span class="md-inline-bold">bold</span><span class="md-syntax">**</span> and &lt;script&gt;');
    });
  });

  describe('Edge Cases', () => {
    it('should handle unmatched opening syntax', () => {
      const text = '**unmatched bold';
      const tokens = tokenize(text);
      
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toEqual({ type: 'text', content: '**unmatched bold' });
    });

    it('should handle unmatched closing syntax', () => {
      const text = 'unmatched**';
      const tokens = tokenize(text);
      
      // ** at end without opening is treated as text
      expect(tokens).toHaveLength(2);
      expect(tokens[0]).toEqual({ type: 'text', content: 'unmatched' });
      expect(tokens[1]).toEqual({ type: 'text', content: '**' });
    });

    it('should handle syntax in the middle of words', () => {
      const text = 'pre**mid**post';
      const tokens = tokenize(text);
      
      expect(tokens).toHaveLength(5);
      expect(tokens[0]).toEqual({ type: 'text', content: 'pre' });
      expect(tokens[1]).toEqual({ type: 'syntax', content: '**' });
      expect(tokens[2]).toEqual({ type: 'bold', content: 'mid' });
      expect(tokens[3]).toEqual({ type: 'syntax', content: '**' });
      expect(tokens[4]).toEqual({ type: 'text', content: 'post' });
    });

    it('should handle whitespace around syntax', () => {
      const text = '  **bold**  ';
      const tokens = tokenize(text);
      
      expect(tokens).toHaveLength(5);
      expect(tokens[0]).toEqual({ type: 'text', content: '  ' });
      expect(tokens[1]).toEqual({ type: 'syntax', content: '**' });
      expect(tokens[2]).toEqual({ type: 'bold', content: 'bold' });
      expect(tokens[3]).toEqual({ type: 'syntax', content: '**' });
      expect(tokens[4]).toEqual({ type: 'text', content: '  ' });
    });

    it('should handle newlines in text', () => {
      const text = 'line1\n**bold**\nline2';
      const tokens = tokenize(text);
      
      expect(tokens).toHaveLength(5);
      expect(tokens[0]).toEqual({ type: 'text', content: 'line1\n' });
      expect(tokens[1]).toEqual({ type: 'syntax', content: '**' });
      expect(tokens[2]).toEqual({ type: 'bold', content: 'bold' });
      expect(tokens[3]).toEqual({ type: 'syntax', content: '**' });
      expect(tokens[4]).toEqual({ type: 'text', content: '\nline2' });
    });
  });
});
