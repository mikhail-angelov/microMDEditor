import { getSelectionOffsets, restoreSelectionOffsets } from './selection';
import { serializeBlockRange, replaceBlockRange } from './clipboard';
import type { BlockRange } from './types';

describe('selection helpers', () => {
  beforeEach(() => {
    // Clear any existing DOM
    document.body.innerHTML = '';
  });

  afterEach(() => {
    // Clean up
    document.body.innerHTML = '';
  });

  it('getSelectionOffsets returns default values when no selection exists', () => {
    // Mock window.getSelection to return null
    Object.defineProperty(window, 'getSelection', {
      writable: true,
      value: jest.fn(() => null),
    });

    const mockRoot = document.createElement('div');
    mockRoot.textContent = 'test text';
    
    const result = getSelectionOffsets(mockRoot);
    
    expect(result).toEqual({
      start: 0,
      end: 0,
      isCollapsed: true,
      isInsideRoot: false,
    });
  });

  it('getSelectionOffsets returns default values when selection is outside root', () => {
    const mockRoot = document.createElement('div');
    mockRoot.textContent = 'test text';
    
    const mockRange = {
      commonAncestorContainer: document.createElement('div'), // Different container
    } as Range;
    
    const mockSelection = {
      rangeCount: 1,
      getRangeAt: jest.fn(() => mockRange),
      isCollapsed: true,
    } as Selection;
    
    Object.defineProperty(window, 'getSelection', {
      writable: true,
      value: jest.fn(() => mockSelection),
    });

    const result = getSelectionOffsets(mockRoot);
    
    expect(result).toEqual({
      start: 0,
      end: 0,
      isCollapsed: true,
      isInsideRoot: false,
    });
  });

  it('restoreSelectionOffsets restores collapsed selection', () => {
    const mockRoot = document.createElement('div');
    mockRoot.textContent = 'test text';
    
    const mockRange = {
      setStart: jest.fn(),
      setEnd: jest.fn(),
      collapse: jest.fn(),
    } as unknown as Range;
    
    const mockSelection = {
      removeAllRanges: jest.fn(),
      addRange: jest.fn(),
    } as unknown as Selection;
    
    Object.defineProperty(window, 'getSelection', {
      writable: true,
      value: jest.fn(() => mockSelection),
    });
    
    // Mock document.createRange
    const originalCreateRange = document.createRange;
    document.createRange = jest.fn(() => mockRange);

    restoreSelectionOffsets(mockRoot, 5);
    
    expect(mockSelection.removeAllRanges).toHaveBeenCalled();
    expect(mockSelection.addRange).toHaveBeenCalled();
    
    // Restore original
    document.createRange = originalCreateRange;
  });

  it('restoreSelectionOffsets clamps offset to text length', () => {
    const mockRoot = document.createElement('div');
    mockRoot.textContent = 'test'; // 4 characters
    
    const mockRange = {
      setStart: jest.fn(),
      setEnd: jest.fn(),
      collapse: jest.fn(),
    } as unknown as Range;
    
    const mockSelection = {
      removeAllRanges: jest.fn(),
      addRange: jest.fn(),
    } as unknown as Selection;
    
    Object.defineProperty(window, 'getSelection', {
      writable: true,
      value: jest.fn(() => mockSelection),
    });
    
    // Mock document.createRange
    const originalCreateRange = document.createRange;
    document.createRange = jest.fn(() => mockRange);

    restoreSelectionOffsets(mockRoot, 10); // Offset beyond text length
    
    expect(mockSelection.removeAllRanges).toHaveBeenCalled();
    expect(mockSelection.addRange).toHaveBeenCalled();
    
    // Restore original
    document.createRange = originalCreateRange;
  });

  it('restoreSelectionOffsets handles negative offset', () => {
    const mockRoot = document.createElement('div');
    mockRoot.textContent = 'test';
    
    const mockRange = {
      setStart: jest.fn(),
      setEnd: jest.fn(),
      collapse: jest.fn(),
    } as unknown as Range;
    
    const mockSelection = {
      removeAllRanges: jest.fn(),
      addRange: jest.fn(),
    } as unknown as Selection;
    
    Object.defineProperty(window, 'getSelection', {
      writable: true,
      value: jest.fn(() => mockSelection),
    });
    
    // Mock document.createRange
    const originalCreateRange = document.createRange;
    document.createRange = jest.fn(() => mockRange);

    restoreSelectionOffsets(mockRoot, -5); // Negative offset
    
    expect(mockSelection.removeAllRanges).toHaveBeenCalled();
    expect(mockSelection.addRange).toHaveBeenCalled();
    
    // Restore original
    document.createRange = originalCreateRange;
  });

  it('restoreSelectionOffsets handles range selection', () => {
    const mockRoot = document.createElement('div');
    mockRoot.textContent = 'test text';
    
    const mockRange = {
      setStart: jest.fn(),
      setEnd: jest.fn(),
      collapse: jest.fn(),
    } as unknown as Range;
    
    const mockSelection = {
      removeAllRanges: jest.fn(),
      addRange: jest.fn(),
    } as unknown as Selection;
    
    Object.defineProperty(window, 'getSelection', {
      writable: true,
      value: jest.fn(() => mockSelection),
    });
    
    // Mock document.createRange
    const originalCreateRange = document.createRange;
    document.createRange = jest.fn(() => mockRange);

    restoreSelectionOffsets(mockRoot, 2, 7);
    
    expect(mockSelection.removeAllRanges).toHaveBeenCalled();
    expect(mockSelection.addRange).toHaveBeenCalled();
    
    // Restore original
    document.createRange = originalCreateRange;
  });

  it('serializes a multi-block range with partial first and last blocks', () => {
    const blocks = [
      { id: 'b1', type: 'paragraph', raw: 'Hello world' },
      { id: 'b2', type: 'paragraph', raw: 'Second line' },
      { id: 'b3', type: 'paragraph', raw: 'Tail end' },
    ];
    const range: BlockRange = {
      start: { blockId: 'b1', offset: 6 },
      end: { blockId: 'b3', offset: 4 },
      isCollapsed: false,
    };

    const serialized = serializeBlockRange(blocks, range);
    expect(serialized).toBe('world\nSecond line\nTail');
  });

  it('replaces a multi-block range and returns a collapsed caret target', () => {
    const blocks = [
      { id: 'b1', type: 'paragraph', raw: 'Hello world' },
      { id: 'b2', type: 'paragraph', raw: 'Second line' },
      { id: 'b3', type: 'paragraph', raw: 'Tail end' },
    ];
    const range: BlockRange = {
      start: { blockId: 'b1', offset: 6 },
      end: { blockId: 'b3', offset: 4 },
      isCollapsed: false,
    };

    const result = replaceBlockRange(blocks, range, 'inserted');

    expect(result.blocks.map((block) => block.raw)).toEqual(['Hello inserted end']);
    expect(result.caret.blockId).toBe(result.blocks[0].id);
    expect(result.caret.offset).toBe('Hello inserted'.length);
  });

  it('replaces part of a single block with multiline paste and keeps unique ids', () => {
    const blocks = [{ id: 'b1', type: 'paragraph', raw: 'Hello world' }];
    const range: BlockRange = {
      start: { blockId: 'b1', offset: 6 },
      end: { blockId: 'b1', offset: 11 },
      isCollapsed: false,
    };

    const result = replaceBlockRange(blocks, range, 'inserted\nsecond\nthird');

    expect(result.blocks.map((block) => block.raw)).toEqual(['Hello inserted', 'second', 'third']);
    expect(result.blocks[0].id).toBe('b1');
    const ids = result.blocks.map((block) => block.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('caret lands on last inserted block after multiline paste', () => {
    const blocks = [{ id: 'b1', type: 'paragraph', raw: 'Hello world' }];
    const range: BlockRange = {
      start: { blockId: 'b1', offset: 6 },
      end: { blockId: 'b1', offset: 11 },
      isCollapsed: false,
    };

    const result = replaceBlockRange(blocks, range, 'inserted\nsecond\nthird');

    expect(result.caret.blockId).toBe(result.blocks[result.blocks.length - 1].id);
    expect(result.caret.offset).toBe('third'.length);
  });

  it('throws when replaceBlockRange receives reversed offsets within the same block', () => {
    const blocks = [{ id: 'b1', type: 'paragraph', raw: 'Hello world' }];
    const range: BlockRange = {
      start: { blockId: 'b1', offset: 8 },
      end: { blockId: 'b1', offset: 4 },
      isCollapsed: false,
    };

    expect(() => replaceBlockRange(blocks, range, 'inserted')).toThrow(
      'Block range offsets are invalid for a single block',
    );
  });
});
