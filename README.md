# Micro MD Editor

A lightweight WYSIWYG Markdown editor React component built with TypeScript.

## Features

- **Markdown syntax editing** with contentEditable - see and edit markdown tags directly
- **Markdown shortcuts** (e.g., `# ` for headings, `**bold**`, `*italic*`)
- **Keyboard shortcuts** (Cmd/Ctrl+B for bold, Cmd/Ctrl+I for italic)
- **Real-time Markdown parsing and serialization**
- **TypeScript support**
- **Zero dependencies** (except React and React DOM)

## Installation

```bash
npm install micro-md-editor
```

## Usage

```jsx
import React, { useState } from 'react';
import { MicroMDEditor } from 'micro-md-editor';

function App() {
  const [markdown, setMarkdown] = useState('# Hello World');

  return (
    <div>
      <MicroMDEditor
        initialMarkdown={markdown}
        onChange={setMarkdown}
      />
      <pre>{markdown}</pre>
    </div>
  );
}
```

## Props

| Prop | Type | Description |
|------|------|-------------|
| `initialMarkdown` | `string` | Initial markdown content |
| `onChange` | `(markdown: string) => void` | Called when content changes |
| `className` | `string` | Additional CSS class for the editor container |

## Keyboard Shortcuts

- **Cmd/Ctrl + B**: Toggle bold
- **Cmd/Ctrl + I**: Toggle italic
- **Cmd/Ctrl + `**: Toggle inline code

## Markdown Shortcuts

While typing:
- `# ` at start of line: Convert to heading level 1
- `## `: Heading level 2
- `- `: Bullet list
- `\`\`\``: Code block

## Architecture

This editor follows the document model pattern:

```
Markdown ↔ Document Model ↔ Markdown Text (editable)
```

1. **Document Model**: Internal JSON representation of the document structure
2. **Renderer**: Converts document model to markdown text for editing
3. **Parser**: Converts Markdown to document model
4. **Serializer**: Converts document model back to Markdown

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build library
npm run build

# Start dev mode (watch for changes)
npm run dev
```

## License

MIT