# Light and Dark Theme Implementation for Micro MD Editor

## Overview
Successfully added comprehensive light and dark theme support to the Micro MD Editor component. The implementation includes three theme modes: `light`, `dark`, and `auto` (which follows the system preference).

## Key Features

### 1. Theme System Architecture
- **CSS Custom Properties (Variables)**: Used CSS variables for all theme colors
- **Two-Layer Approach**: Theme variables control both editor and surrounding app
- **Smooth Transitions**: All theme changes have smooth CSS transitions
- **System Preference Support**: `auto` mode detects and follows OS dark/light mode

### 2. Theme Variables
The editor defines a comprehensive set of CSS custom properties:

#### Light Theme Variables:
```css
--mmd-bg: #ffffff;
--mmd-text: #1a1a1a;
--mmd-border: #e0e0e0;
--mmd-placeholder: #aaa;
--mmd-code-bg: rgba(0, 0, 0, 0.06);
--mmd-code-text: #1a1a1a;
--mmd-link: #0066cc;
--mmd-quote-border: #ddd;
--mmd-quote-text: #555;
--mmd-syntax-opacity: 0.4;
--mmd-selection-bg: rgba(0, 123, 255, 0.2);
```

#### Dark Theme Variables:
```css
--mmd-bg: #1a1a1a;
--mmd-text: #f0f0f0;
--mmd-border: #444;
--mmd-placeholder: #888;
--mmd-code-bg: rgba(255, 255, 255, 0.1);
--mmd-code-text: #f0f0f0;
--mmd-link: #66b3ff;
--mmd-quote-border: #666;
--mmd-quote-text: #ccc;
--mmd-syntax-opacity: 0.6;
--mmd-selection-bg: rgba(100, 181, 246, 0.3);
```

### 3. Implementation Details

#### TypeScript Updates (`src/types.ts`)
- Added `Theme` type: `"light" | "dark" | "auto"`
- Updated `MicroMDEditorProps` to include optional `theme` prop

#### MicroMDEditor Component (`src/MicroMDEditor.tsx`)
- Added theme state management with `useState` and `useEffect`
- `auto` mode listens to `prefers-color-scheme` media queries
- Dynamic CSS with theme-specific variables
- Block-specific styling using data attributes
- Selection styling for better UX in both themes

#### BlockWrapper Component (`src/BlockWrapper.tsx`)
- Updated to use CSS variables instead of hardcoded colors
- Added data attributes for block type and heading level
- Caret color now uses `var(--mmd-text)` for theme compatibility

#### Example App (`example/src/App.tsx`)
- Added theme selector with three buttons (Light, Dark, Auto)
- Entire app responds to theme changes with dark mode styling
- Real-time theme switching with visual feedback

#### Styling (`example/src/App.css`)
- Comprehensive dark mode styles for all app components
- Theme control buttons with active states
- Smooth transitions for theme changes

### 4. Theme-Specific Enhancements

#### Syntax Markers
- Light theme: 40% opacity
- Dark theme: 60% opacity (better visibility on dark backgrounds)

#### Code Blocks
- Light: Light gray background with dark text
- Dark: Dark gray background with light text

#### Links
- Light: Standard blue (#0066cc)
- Dark: Brighter blue (#66b3ff) for better contrast

#### Selection
- Light: Light blue selection
- Dark: Brighter blue selection with higher opacity

#### Blockquotes
- Light: Gray border and text
- Dark: Darker gray border with lighter text

### 5. Usage Example

```tsx
import { MicroMDEditor } from 'micro-md-editor';

function MyComponent() {
  return (
    <MicroMDEditor
      initialMarkdown="# Hello World"
      onChange={(md) => console.log(md)}
      theme="dark" // or "light" or "auto"
    />
  );
}
```

### 6. Testing
The implementation can be tested at: http://localhost:5173/

Test scenarios:
1. Click "☀️ Light" button - see light theme
2. Click "🌙 Dark" button - see dark theme  
3. Click "🔄 Auto" button - follows system preference
4. Switch system dark/light mode while in "auto" - editor updates automatically
5. Test all markdown elements in both themes

### 7. Files Modified
```
src/types.ts              # Added Theme type
src/MicroMDEditor.tsx     # Added theme support with CSS variables
src/BlockWrapper.tsx      # Updated to use theme variables
example/src/App.tsx       # Added theme selector and dark mode
example/src/App.css       # Added theme controls and dark mode styles
```

### 8. Build Status
✅ Successfully builds with Rollup
✅ TypeScript compilation passes
✅ Example app runs with theme switching

The theme implementation maintains the Notion-style architecture while providing a polished, accessible dark mode experience that matches modern application standards.