# Micro MD Editor

A lightweight, Notion-style Markdown editor React/Preact component with two-layer rendering: visual decorations over editable text.

> **Note**: This library now has first-class Preact support! Use the `/preact` subpath export for smaller bundle sizes.

## Features

- **Notion-style editing**: Visual formatting overlays on editable text
- **Block-based architecture**: Each paragraph, heading, or list is a separate block
- **Real-time Markdown parsing**: See formatted output as you type
- **Lightweight**: Minimal dependencies, optimized bundle size
- **Framework support**: Works with both React and Preact
- **TypeScript**: Fully typed with TypeScript support
- **Accessible**: Keyboard navigation and screen reader friendly

## Installation

```bash
npm install micro-md-editor
```

### For React projects:
```bash
npm install react react-dom
```

### For Preact projects:
```bash
npm install preact
```

## Usage

### React
```tsx
import { useState } from 'react';
import { MicroMDEditor } from 'micro-md-editor';

function App() {
  const [markdown, setMarkdown] = useState('# Hello World\n\nThis is **bold** text.');

  return (
    <MicroMDEditor
      initialMarkdown={markdown}
      onChange={setMarkdown}
    />
  );
}
```

### Preact
```tsx
import { useState } from 'preact/hooks';
import { MicroMDEditor } from 'micro-md-editor/preact';

function App() {
  const [markdown, setMarkdown] = useState('# Hello World\n\nThis is **bold** text.');

  return (
    <MicroMDEditor
      initialMarkdown={markdown}
      onChange={setMarkdown}
    />
  );
}
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `initialMarkdown` | `string` | Yes | Initial Markdown content |
| `onChange` | `(markdown: string) => void` | No | Callback when content changes |
| `className` | `string` | No | Additional CSS class for the container |
| `theme` | `'light' \| 'dark' \| 'auto'` | No | Theme preference (default: 'light') |

## Supported Markdown Syntax

- **Headings**: `# H1` through `###### H6`
- **Bold**: `**bold text**`
- **Italic**: `*italic text*`
- **Inline code**: `` `code` ``
- **Links**: `[text](https://example.com)`
- **Blockquotes**: `> quote`
- **Lists**: `- item` or `* item` or `1. item`
- **Task lists**: `- [ ] task` or `- [x] completed`
- **Code blocks**: ` ```code block``` `
- **Horizontal rules**: `---` or `***` or `___`

## Architecture

### Dual Framework Support
Micro MD Editor provides separate builds for React and Preact:
- **React build**: Standard export, compatible with React 16.8+
- **Preact build**: `/preact` subpath export, optimized for Preact 10+
- **Optional peer dependencies**: You only need to install the framework you're using

### Two-Layer Rendering
Inspired by Notion's editor:
1. **Decoration Layer**: Shows formatted text (bold, italic, etc.) - read-only
2. **Editable Layer**: Transparent text with visible cursor - captures input

This architecture provides:
- **No forced re-renders during typing**: Browser handles text editing
- **Visual feedback**: See formatting as you type
- **Performance**: Minimal framework updates

## Keyboard Navigation

- **Enter**: Split block or create new line within block (for quotes, code)
- **Backspace at start**: Merge with previous block or exit block type
- **Arrow keys**: Navigate between blocks at boundaries
- **Tab**: Indent list items (coming soon)

## Development

### Setup
```bash
git clone git@github.com:mikhail-angelov/microMDEditor.git
cd micro-md-editor
npm install
```

### Build
```bash
npm run build
```

### Development (watch mode)
```bash
npm run dev
```

### Run Example
```bash
npm run example
```

### Test
```bash
npm test
```

```bash
npm run test:watch
```

## Example App

The project includes a comprehensive example app that demonstrates:
- Light/dark/auto theme switching
- Real-time markdown preview
- Editor feature documentation
- Responsive design

To run the example:
```bash
cd example
npm install
npm run dev
```

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Performance

- Bundle size: ~10KB gzipped (React) / ~8KB gzipped (Preact)
- Zero dependencies on UI frameworks
- Optimized rendering with virtual DOM diffing

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT © Mikhail Angelov

## Acknowledgments

- Inspired by Notion's editor architecture
- Built with TypeScript and modern build tools
- Community feedback and contributions