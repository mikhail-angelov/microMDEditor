# Micro MD Editor

<div align="center">

[![npm version](https://img.shields.io/npm/v/micro-md-editor.svg)](https://www.npmjs.com/package/micro-md-editor)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/micro-md-editor)](https://bundlephobia.com/package/micro-md-editor)
[![GitHub Pages](https://img.shields.io/badge/Live_Demo-GitHub_Pages-blue)](https://mikhail-angelov.github.io/microMDEditor/)

A lightweight **Notion-style WYSIWYG Markdown editor** React component built with TypeScript. Edit markdown directly while seeing styled content in real-time!

</div>

## 🚀 Live Demo

**[Try it Live on GitHub Pages →](https://mikhail-angelov.github.io/microMDEditor/)**

### Quick Preview
![Micro MD Editor Demo](demo-preview.gif)

## ✨ Features

| Feature | Description |
|---------|-------------|
| **🎨 Notion-style Editing** | Two-layer rendering: visual decorations over editable text |
| **⚡ Real-time Markdown** | See formatted content while typing markdown syntax |
| **🎯 Block-based Architecture** | Each paragraph/heading/list is a separate block |
| **🌓 Theme Support** | Light, dark, and auto (follows system) themes |
| **⌨️ Keyboard Shortcuts** | Cmd/Ctrl+B for bold, Cmd/Ctrl+I for italic, etc. |
| **📱 Zero Dependencies** | Only React & React DOM as peer dependencies |
| **🔧 TypeScript Ready** | Full TypeScript support with type definitions |

## 📦 Installation

```bash
npm install micro-md-editor
```

```bash
yarn add micro-md-editor
```

```bash
pnpm add micro-md-editor
```

## 🚀 Quick Start

```jsx
import React, { useState } from 'react';
import { MicroMDEditor } from 'micro-md-editor';

function App() {
  const [markdown, setMarkdown] = useState('# Hello World\n\nEdit **bold** and *italic* text!');

  return (
    <div>
      <MicroMDEditor
        initialMarkdown={markdown}
        onChange={setMarkdown}
        theme="light"
      />
      <pre>{markdown}</pre>
    </div>
  );
}
```

### Preact

Use the dedicated Preact entry if your app runs on Preact:

```tsx
import { useState } from 'preact/hooks';
import { MicroMDEditor } from 'micro-md-editor/preact';

function App() {
  const [markdown, setMarkdown] = useState('# Hello Preact');

  return (
    <MicroMDEditor
      initialMarkdown={markdown}
      onChange={setMarkdown}
      theme="light"
    />
  );
}
```

## 🎨 Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `initialMarkdown` | `string` | `''` | Initial markdown content |
| `onChange` | `(markdown: string) => void` | `undefined` | Called when content changes |
| `className` | `string` | `''` | Additional CSS class for the editor container |
| `theme` | `'light' \| 'dark' \| 'auto'` | `'light'` | Editor theme |

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + B` | Toggle bold (`**bold**`) |
| `Cmd/Ctrl + I` | Toggle italic (`*italic*`) |
| `Cmd/Ctrl + \`` | Toggle inline code (`` `code` ``) |
| `Enter` | Split block or create new line |
| `Backspace` at start | Merge with previous block |

## 📝 Markdown Syntax Support

| Syntax | Example | Result |
|--------|---------|--------|
| **Headings** | `# H1` `## H2` `### H3` | Heading levels 1-6 |
| **Bold** | `**bold text**` | **Bold text** |
| **Italic** | `*italic text*` | *Italic text* |
| **Inline Code** | `` `code` `` | `Inline code` |
| **Links** | `[text](https://example.com)` | [Link with syntax display](https://example.com) |
| **Lists** | `- item` `* item` `1. item` | Bullet and numbered lists |
| **Blockquotes** | `> quote` | > Blockquote styling |
| **Code Blocks** | `\`\`\`js\ncode\n\`\`\`` | Multi-line code blocks |

## 🏗️ Architecture

This editor follows a **Notion-inspired two-layer architecture**:

```
┌─────────────────────────────────────────┐
│  Decoration Layer (visual, read-only)   │
│  Shows formatted text (bold, italic)    │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│  Editable Layer (transparent, editable) │
│  Plain text with visible cursor         │
└─────────────────────────────────────────┘
```

### Key Principles:
1. **React controls structure** (blocks)
2. **Browser controls content** (DOM inside blocks)
3. **No forced re-renders** during typing
4. **Selection never breaks** between layers

## 🔧 Development

### Setup
```bash
# Clone repository
git clone git@github.com:mikhail-angelov/microMDEditor.git
cd microMDEditor

# Install dependencies
npm install

# Start development
npm run dev
```

### Build
```bash
# Build library
npm run build

# Run tests
npm test

# Run example app
npm run example
```

### Deployment
```bash
# Deploy to GitHub Pages
npm run deploy

# Or use Makefile
make deploy
```

## 📁 Project Structure

```
micro-md-editor/
├── src/                    # Library source code
│   ├── MicroMDEditor.tsx   # Main component
│   ├── DecorationLayer.tsx # Visual formatting layer
│   ├── BlockWrapper.tsx    # Individual block wrapper
│   ├── tokenizer.ts        # Markdown tokenizer
│   ├── plugins.ts          # Block plugins (quotes, lists, etc.)
│   └── types.ts           # TypeScript definitions
├── example/               # Example React app
│   ├── src/App.tsx       # Demo application
│   └── vite.config.ts    # Build configuration
├── dist/                  # Built library
└── demo/                  # GitHub Pages deployment
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- src/MicroMDEditor.test.tsx
```

## 📚 API Reference

### `MicroMDEditor` Component

```typescript
interface MicroMDEditorProps {
  initialMarkdown: string;
  onChange?: (markdown: string) => void;
  className?: string;
  theme?: 'light' | 'dark' | 'auto';
}
```

### Theme Types
```typescript
type Theme = 'light' | 'dark' | 'auto';
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT © [Mikhail Angelov](https://github.com/mikhail-angelov)

## 🔗 Links

- **[Live Demo](https://mikhail-angelov.github.io/microMDEditor/)** - Try it online
- **[GitHub Repository](https://github.com/mikhail-angelov/microMDEditor)** - Source code
- **[npm Package](https://www.npmjs.com/package/micro-md-editor)** - Install via npm
- **[Issue Tracker](https://github.com/mikhail-angelov/microMDEditor/issues)** - Report bugs or request features

---

<div align="center">

Built with ❤️ using TypeScript, React, and Notion-inspired architecture.

</div>
