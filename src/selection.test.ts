import { getSelectionOffsets, restoreSelectionOffsets } from './selection';

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
});