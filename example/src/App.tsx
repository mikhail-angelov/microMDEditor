import { useState } from 'preact/hooks';
import { MicroMDEditor } from 'micro-md-editor/preact';
// import {MicroMDEditor2} from '../../src/MicroMDEditor2'
import './App.css';

type Theme = 'light' | 'dark' | 'auto';

function App() {
  const [markdown, setMarkdown] = useState(`# Welcome to Micro MD Editor

This is a **Notion-style Markdown editor** built with Preact. Edit markdown directly while seeing styled content!

## Features

- **Bold text** and *italic text* supported
- Inline \`code\` rendering
- Block-based editing
- **Light & Dark themes**
- [Link support](https://example.com) with full syntax display

## Try It Out

> This is a blockquote
> You can add multiple lines

- List item one
- List item two
- List item three

\`\`\`
// Code blocks preserve formatting
function hello() {
  console.log("Hello, World!");
}
\`\`\`

### How It Works

1. Each line is a separate block
2. Press Enter to create new blocks
3. Backspace at start merges with previous
4. Arrow keys navigate between blocks

The editor shows **syntax markers** with reduced opacity while rendering styled content! Try editing this [example link](https://github.com) to see how links work.
`);

  const [theme, setTheme] = useState<Theme>('light');

  // Determine if we should apply dark mode to the entire app
  const isDarkMode = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <div className={`App ${isDarkMode ? 'dark-mode' : ''}`}>
      <header>
        <h1>Micro MD Editor Demo</h1>
        <p>
          A Notion-style Markdown editor with two-layer rendering: visual decorations over editable text.
        </p>
      </header>

      <main>
        <section className="theme-controls">
          <h2>Theme</h2>
          <div className="theme-buttons">
            <button 
              className={theme === 'light' ? 'active' : ''}
              onClick={() => setTheme('light')}
            >
              ☀️ Light
            </button>
            <button 
              className={theme === 'dark' ? 'active' : ''}
              onClick={() => setTheme('dark')}
            >
              🌙 Dark
            </button>
            <button 
              className={theme === 'auto' ? 'active' : ''}
              onClick={() => setTheme('auto')}
            >
              🔄 Auto (Follow System)
            </button>
          </div>
        </section>

        <section className="editor-section">
          <h2>Editor</h2>
          <div className="editor-container">
            <MicroMDEditor
              initialMarkdown={markdown}
              onChange={setMarkdown}
              // className="demo-editor"
              // theme={theme}
            />
          </div>
        </section>

        <section className="output-section">
          <h2>Raw Markdown Output</h2>
          <div className="output-container">
            <pre>{markdown}</pre>
          </div>
        </section>

        <section className="instructions">
          <h2>Editor Features</h2>
          <ul>
            <li><strong>Block-based editing</strong>: Each paragraph/heading/list is a separate block</li>
            <li><strong>Enter</strong>: Split block or create new line within block (for quotes, code)</li>
            <li><strong>Backspace at start</strong>: Merge with previous block or exit block type</li>
            <li><strong>Arrow keys</strong>: Navigate between blocks at boundaries</li>
          </ul>

          <h2>Markdown Syntax</h2>
          <ul>
            <li><code># Heading</code> through <code>###### Heading</code></li>
            <li><code>**bold**</code> and <code>*italic*</code></li>
            <li><code>`inline code`</code></li>
            <li><code>[links](https://example.com)</code></li>
            <li><code> Blockquote</code></li>
            <li><code>- List item</code> or <code>* List item</code></li>
            <li><code>1. Numbered list</code></li>
            <li><code>```code block```</code></li>
          </ul>

          <h2>Architecture</h2>
          <p>This editor uses a two-layer approach inspired by Notion:</p>
          <ul>
            <li><strong>Decoration Layer</strong>: Shows formatted text (bold, italic, etc.) - read-only</li>
            <li><strong>Editable Layer</strong>: Transparent text with visible cursor - captures input</li>
          </ul>
          <p>Preact controls block structure, browser handles text editing. No forced re-renders during typing!</p>
        </section>
      </main>

      <footer>
        <p>
          Built with TypeScript • Notion-style Architecture •{' '}
          <a href="https://github.com/yourusername/micro-md-editor" target="_blank" rel="noopener noreferrer">
            View on GitHub
          </a>
        </p>
      </footer>
    </div>
  );
}

export default App;
