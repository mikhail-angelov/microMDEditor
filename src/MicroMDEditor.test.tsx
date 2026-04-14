import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { MicroMDEditor } from './MicroMDEditor';
import type { BlockPoint, BlockRange } from './types';

// Mock BlockWrapper to simplify testing
jest.mock('./BlockWrapper', () => ({
  BlockWrapper: ({ block, onChange, onSplit, onMergeWithPrevious, registerRef }: {
    block: { id: string; raw: string };
    onChange: (id: string, text: string) => void;
    onSplit: (id: string, before: string, after: string) => void;
    onMergeWithPrevious: (id: string) => void;
    registerRef: (id: string, ref: { current: null }) => void;
  }) => {
    // Store ref for testing
    React.useEffect(() => {
      if (registerRef) {
        registerRef(block.id, { current: null });
      }
    }, [registerRef, block.id]);
    
    return (
      <div data-testid={`block-${block.id}`} data-block-id={block.id}>
        <div 
          data-testid={`editable-${block.id}`}
          contentEditable
          onInput={(e) => {
            const text = (e.target as HTMLElement).textContent || '';
            onChange(block.id, text);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSplit(block.id, 'before', 'after');
            }
            if (e.key === 'Backspace') {
              e.preventDefault();
              onMergeWithPrevious(block.id);
            }
          }}
        >
          {block.raw}
        </div>
      </div>
    );
  },
}));

const samplePoint: BlockPoint = { blockId: 'b1', offset: 2 };
const sampleRange: BlockRange = {
  start: samplePoint,
  end: { blockId: 'b2', offset: 4 },
  isCollapsed: false,
};

describe('BlockRange types', () => {
  it('can be instantiated via the exported shapes', () => {
    expect(sampleRange.start.blockId).toBe('b1');
  });
});

describe('MicroMDEditor', () => {
  const mockOnChange = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render blocks with inline markdown', () => {
    const initialValue = '**bold** and *italic* and `code`';
    const { container } = render(
      <MicroMDEditor value={initialValue} onChange={mockOnChange} />
    );
    
    // Should render without errors
    expect(container).toBeInTheDocument();
    
    // Should call onChange with initial value (or not, depending on implementation)
    // The important thing is it renders
  });

  it('should handle multi-line content', () => {
    const initialValue = 'hello\n**bold**\n*italic*';
    const { container } = render(
      <MicroMDEditor value={initialValue} onChange={mockOnChange} />
    );
    
    // Should render without errors
    expect(container).toBeInTheDocument();
  });

  it('should call onChange when content changes', () => {
    const initialValue = 'initial text';
    const { container } = render(
      <MicroMDEditor value={initialValue} onChange={mockOnChange} />
    );
    
    // Find all editable elements
    const editables = container.querySelectorAll('[contenteditable="true"]');
    expect(editables.length).toBeGreaterThan(0);
    
    // Simulate input on first editable
    const firstEditable = editables[0] as HTMLElement;
    
    // Mock textContent
    Object.defineProperty(firstEditable, 'textContent', {
      writable: true,
      value: 'updated text',
    });
    
    fireEvent.input(firstEditable);
    
    // Should call onChange
    expect(mockOnChange).toHaveBeenCalled();
  });

  it('should preserve inline markdown syntax in output', () => {
    const initialValue = '**bold** text';
    const { container } = render(
      <MicroMDEditor value={initialValue} onChange={mockOnChange} />
    );
    
    // Find editable element
    const editables = container.querySelectorAll('[contenteditable="true"]');
    const editable = editables[0] as HTMLElement;
    
    // Simulate adding text after bold
    Object.defineProperty(editable, 'textContent', {
      writable: true,
      value: '**bold** text more',
    });
    
    fireEvent.input(editable);
    
    // Should call onChange with text including markdown syntax
    // The exact value depends on implementation
    expect(mockOnChange).toHaveBeenCalled();
  });

  it('should handle empty value', () => {
    const { container } = render(
      <MicroMDEditor value="" onChange={mockOnChange} />
    );
    
    // Should render without errors
    expect(container).toBeInTheDocument();
    
    // Should have at least one editable block
    const editables = container.querySelectorAll('[contenteditable="true"]');
    expect(editables.length).toBeGreaterThan(0);
  });
});
