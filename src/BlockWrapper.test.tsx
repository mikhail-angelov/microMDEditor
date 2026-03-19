import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { BlockWrapper } from './BlockWrapper';
import { Block } from './types';

// Mock the utils functions
jest.mock('./utils', () => ({
  getCaretOffset: jest.fn(),
  placeCaretAtOffset: jest.fn(),
  placeCaretAtEnd: jest.fn(),
  detectType: jest.fn(() => 'paragraph'),
}));

// Mock selection helpers
jest.mock('./selection', () => {
  const mockGetSelectionOffsets = jest.fn(() => ({
    start: 0,
    end: 0,
    isCollapsed: true,
    isInsideRoot: false,
  }));
  const mockRestoreSelectionOffsets = jest.fn();
  const mockIsCaretAtStart = jest.fn();
  const mockIsCaretAtEnd = jest.fn();

  return {
    getSelectionOffsets: mockGetSelectionOffsets,
    restoreSelectionOffsets: mockRestoreSelectionOffsets,
    isCaretAtStart: mockIsCaretAtStart,
    isCaretAtEnd: mockIsCaretAtEnd,
    __mockGetSelectionOffsets: mockGetSelectionOffsets,
    __mockRestoreSelectionOffsets: mockRestoreSelectionOffsets,
    __mockIsCaretAtStart: mockIsCaretAtStart,
    __mockIsCaretAtEnd: mockIsCaretAtEnd,
  };
});

// Mock DecorationLayer
jest.mock('./DecorationLayer', () => ({
  DecorationLayer: () => <div data-testid="decoration-layer" />,
}));

// Mock plugins
jest.mock('./plugins', () => {
  const mockGetPlugin = jest.fn(() => ({
    type: 'paragraph',
    match: () => true,
    normalize: undefined,
    onEnter: undefined,
    onBackspace: undefined,
  }));

  return {
    getPlugin: mockGetPlugin,
    __mockGetPlugin: mockGetPlugin,
  };
});

function renderBlock(raw: string) {
  const onChange = jest.fn();
  const onSplit = jest.fn();
  const onMergeWithPrevious = jest.fn();
  const onFocusNext = jest.fn();
  const onFocusPrevious = jest.fn();
  const onDelete = jest.fn();
  const registerRef = jest.fn();

  const utils = render(
    <BlockWrapper
      block={{ id: 'b1', type: 'paragraph', raw }}
      onChange={onChange}
      onSplit={onSplit}
      onMergeWithPrevious={onMergeWithPrevious}
      onFocusNext={onFocusNext}
      onFocusPrevious={onFocusPrevious}
      onDelete={onDelete}
      registerRef={registerRef}
    />
  );

  const editable = utils.container.querySelector('.md-editable') as HTMLDivElement;
  editable.textContent = raw;

  return {
    ...utils,
    editable,
    onChange,
    onSplit,
    onMergeWithPrevious,
    onFocusNext,
    onFocusPrevious,
    onDelete,
  };
}

describe('BlockWrapper0', () => {
  it('does not merge block on Backspace when caret is inside inline markdown paragraph', () => {
    const { editable, onMergeWithPrevious, onDelete } = renderBlock(
      'This is a **Notion-style Markdown editor** built with Rea1ct. E'
    );

    fireEvent.keyDown(editable, { key: 'Backspace' });

    expect(onMergeWithPrevious).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('merges block on Backspace only at true logical offset 0', () => {
    const { editable, onMergeWithPrevious } = renderBlock('**bold**');
    
    // Mock getSelectionOffsets to return caret at start (inside root)
    const selectionMock = require('./selection');
    selectionMock.__mockGetSelectionOffsets.mockReturnValue({
      start: 0,
      end: 0,
      isCollapsed: true,
      isInsideRoot: true,
    });

    fireEvent.keyDown(editable, { key: 'Backspace' });

    expect(onMergeWithPrevious).toHaveBeenCalledTimes(1);
  });

  it('does not use block-start Backspace path for non-collapsed selection', () => {
    const { editable, onMergeWithPrevious, onDelete } = renderBlock('**bold** text');
    
    // Mock getSelectionOffsets to return non-collapsed selection
    const selectionMock = require('./selection');
    selectionMock.__mockGetSelectionOffsets.mockReturnValue({
      start: 0,
      end: 4,
      isCollapsed: false,
      isInsideRoot: true,
    });

    fireEvent.keyDown(editable, { key: 'Backspace' });

    expect(onMergeWithPrevious).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
  });
});

describe('BlockWrapper', () => {
  const mockOnChange = jest.fn();
  const mockOnSplit = jest.fn();
  const mockOnMergeWithPrevious = jest.fn();
  const mockOnFocusNext = jest.fn();
  const mockOnFocusPrevious = jest.fn();
  const mockOnDelete = jest.fn();
  const mockRegisterRef = jest.fn();

  const createBlock = (raw: string = ''): Block => ({
    id: 'test-block',
    type: 'paragraph',
    raw,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mocks
    const selectionMock = require('./selection');
    selectionMock.__mockGetSelectionOffsets.mockReset();
    selectionMock.__mockGetSelectionOffsets.mockReturnValue({
      start: 0,
      end: 0,
      isCollapsed: true,
      isInsideRoot: false,
    });
    selectionMock.__mockRestoreSelectionOffsets.mockReset();
    selectionMock.__mockIsCaretAtStart.mockReset();
    selectionMock.__mockIsCaretAtEnd.mockReset();
    
    const pluginsMock = require('./plugins');
    pluginsMock.__mockGetPlugin.mockReset();
    pluginsMock.__mockGetPlugin.mockReturnValue({
      type: 'paragraph',
      match: () => true,
      normalize: undefined,
      onEnter: undefined,
      onBackspace: undefined,
    });
  });

  const renderBlockWrapper = (block: Block) => {
    const result = render(
      <BlockWrapper
        block={block}
        onChange={mockOnChange}
        onSplit={mockOnSplit}
        onMergeWithPrevious={mockOnMergeWithPrevious}
        onFocusNext={mockOnFocusNext}
        onFocusPrevious={mockOnFocusPrevious}
        onDelete={mockOnDelete}
        registerRef={mockRegisterRef}
      />
    );
    
    // Get the editable div by its class
    const editable = result.container.querySelector('.md-editable') as HTMLElement;
    return { ...result, editable };
  };

  describe('Backspace behavior with inline markdown', () => {
    it('should NOT call onMergeWithPrevious when Backspace is pressed inside bold text (not at offset 0)', () => {
      const block = createBlock('hello **bold** world');
      const { editable } = renderBlockWrapper(block);
      
      // Mock getSelectionOffsets to return caret not at start
      const selectionMock = require('./selection');
      selectionMock.__mockGetSelectionOffsets.mockReturnValue({
        start: 5,
        end: 5,
        isCollapsed: true,
        isInsideRoot: true,
      });
      
      fireEvent.keyDown(editable, { key: 'Backspace' });
      
      expect(mockOnMergeWithPrevious).not.toHaveBeenCalled();
      expect(mockOnDelete).not.toHaveBeenCalled();
    });

    it('should call onMergeWithPrevious when Backspace is pressed at true logical offset 0', () => {
      const block = createBlock('**bold**');
      const { editable } = renderBlockWrapper(block);
      
      // Mock getSelectionOffsets to return caret at start
      const selectionMock = require('./selection');
      selectionMock.__mockGetSelectionOffsets.mockReturnValue({
        start: 0,
        end: 0,
        isCollapsed: true,
        isInsideRoot: true,
      });
      
      fireEvent.keyDown(editable, { key: 'Backspace' });
      
      expect(mockOnMergeWithPrevious).toHaveBeenCalledWith('test-block');
      expect(mockOnDelete).not.toHaveBeenCalled();
    });

    it('should call onDelete when Backspace is pressed at offset 0 on empty block', () => {
      const block = createBlock('');
      const { editable } = renderBlockWrapper(block);
      
      // Mock getSelectionOffsets to return caret at start on empty block
      const selectionMock = require('./selection');
      selectionMock.__mockGetSelectionOffsets.mockReturnValue({
        start: 0,
        end: 0,
        isCollapsed: true,
        isInsideRoot: true,
      });
      
      fireEvent.keyDown(editable, { key: 'Backspace' });
      
      expect(mockOnDelete).toHaveBeenCalledWith('test-block');
      expect(mockOnMergeWithPrevious).not.toHaveBeenCalled();
    });

    it('should NOT call onMergeWithPrevious when Backspace is pressed with non-collapsed selection', () => {
      const block = createBlock('**bold** text');
      const { editable } = renderBlockWrapper(block);
      
      // Mock getSelectionOffsets to return non-collapsed selection
      const selectionMock = require('./selection');
      selectionMock.__mockGetSelectionOffsets.mockReturnValue({
        start: 0,
        end: 4,
        isCollapsed: false,
        isInsideRoot: true,
      });
      
      fireEvent.keyDown(editable, { key: 'Backspace' });
      
      expect(mockOnMergeWithPrevious).not.toHaveBeenCalled();
      expect(mockOnDelete).not.toHaveBeenCalled();
    });

    it('should handle Backspace at offset 1 in bold text without triggering merge/delete', () => {
      const block = createBlock('**bold**');
      const { editable } = renderBlockWrapper(block);
      
      // Mock getSelectionOffsets to return caret at offset 1
      const selectionMock = require('./selection');
      selectionMock.__mockGetSelectionOffsets.mockReturnValue({
        start: 1,
        end: 1,
        isCollapsed: true,
        isInsideRoot: true,
      });
      
      fireEvent.keyDown(editable, { key: 'Backspace' });
      
      expect(mockOnMergeWithPrevious).not.toHaveBeenCalled();
      expect(mockOnDelete).not.toHaveBeenCalled();
    });
  });
});