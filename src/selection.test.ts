import * as selection from './selection';
import { getCaretOffset, placeCaretAtOffset } from './utils';
import { getSelectionOffsets, restoreSelectionOffsets } from './selection';

// Mock the utils functions
jest.mock('./utils', () => ({
  getCaretOffset: jest.fn(),
  placeCaretAtOffset: jest.fn(),
}));

function setRootText(root: HTMLElement, text: string) {
  root.textContent = text;
  document.body.appendChild(root);
}

describe('selection helpers', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    window.getSelection()?.removeAllRanges();
  });

  it('round-trips collapsed offsets through plain text', () => {
    const root = document.createElement('div');
    setRootText(root, 'hello world');

    restoreSelectionOffsets(root, 4);
    const snap = getSelectionOffsets(root);

    expect(snap.isInsideRoot).toBe(true);
    expect(snap.isCollapsed).toBe(true);
    expect(snap.start).toBe(4);
    expect(snap.end).toBe(4);
  });

  it('restores non-collapsed ranges', () => {
    const root = document.createElement('div');
    setRootText(root, 'a **bold** b `code` c ~~ss~~');

    restoreSelectionOffsets(root, 2, 10);
    const snap = getSelectionOffsets(root);

    expect(snap.isInsideRoot).toBe(true);
    expect(snap.isCollapsed).toBe(false);
    expect(snap.start).toBe(2);
    expect(snap.end).toBe(10);
  });

  it('clamps offsets to text bounds', () => {
    const root = document.createElement('div');
    setRootText(root, 'abc');

    restoreSelectionOffsets(root, 999);
    const snap = getSelectionOffsets(root);

    expect(snap.start).toBe(3);
    expect(snap.end).toBe(3);
  });
});

describe('selection utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    const utils = require('./utils');
    utils.getCaretOffset.mockReset();
    utils.placeCaretAtOffset.mockReset();
  });

  describe('getSelectionOffsets', () => {
    it('should return default values when no selection exists', () => {
      // Mock window.getSelection to return null
      Object.defineProperty(window, 'getSelection', {
        writable: true,
        value: jest.fn(() => null),
      });

      const mockRoot = document.createElement('div');
      mockRoot.textContent = 'test text';
      
      const result = selection.getSelectionOffsets(mockRoot);
      
      expect(result).toEqual({
        start: 0,
        end: 0,
        isCollapsed: true,
        isInsideRoot: false,
      });
    });

    it('should return default values when selection is outside root', () => {
      const mockRoot = document.createElement('div');
      mockRoot.textContent = 'test text';
      
      const mockRange = {
        commonAncestorContainer: document.createElement('div'), // Different container
      };
      
      const mockSelection = {
        rangeCount: 1,
        getRangeAt: jest.fn(() => mockRange),
        isCollapsed: true,
      };
      
      Object.defineProperty(window, 'getSelection', {
        writable: true,
        value: jest.fn(() => mockSelection),
      });

      const result = selection.getSelectionOffsets(mockRoot);
      
      expect(result).toEqual({
        start: 0,
        end: 0,
        isCollapsed: true,
        isInsideRoot: false,
      });
    });

    it('should return correct offsets for collapsed selection inside root', () => {
      const mockRoot = document.createElement('div');
      mockRoot.textContent = 'test text';
      
      const mockRange = {
        commonAncestorContainer: mockRoot,
      };
      
      const mockSelection = {
        rangeCount: 1,
        getRangeAt: jest.fn(() => mockRange),
        isCollapsed: true,
      };
      
      Object.defineProperty(window, 'getSelection', {
        writable: true,
        value: jest.fn(() => mockSelection),
      });

      const utils = require('./utils');
      utils.getCaretOffset.mockReturnValue(5);
      
      const result = selection.getSelectionOffsets(mockRoot);
      
      expect(result).toEqual({
        start: 5,
        end: 5,
        isCollapsed: true,
        isInsideRoot: true,
      });
      expect(utils.getCaretOffset).toHaveBeenCalledWith(mockRoot, mockSelection);
    });

    it('should return correct offsets for range selection inside root', () => {
      const mockRoot = document.createElement('div');
      mockRoot.textContent = 'test text';
      
      const mockRange = {
        commonAncestorContainer: mockRoot,
      };
      
      const mockSelection = {
        rangeCount: 1,
        getRangeAt: jest.fn(() => mockRange),
        isCollapsed: false,
      };
      
      Object.defineProperty(window, 'getSelection', {
        writable: true,
        value: jest.fn(() => mockSelection),
      });

      const utils = require('./utils');
      utils.getCaretOffset
        .mockReturnValueOnce(2) // First call for start
        .mockReturnValueOnce(7); // Second call for end
      
      const result = selection.getSelectionOffsets(mockRoot);
      
      expect(result).toEqual({
        start: 2,
        end: 7,
        isCollapsed: false,
        isInsideRoot: true,
      });
      expect(utils.getCaretOffset).toHaveBeenCalledTimes(2);
    });
  });

  describe('restoreSelectionOffsets', () => {
    it('should restore collapsed selection', () => {
      const mockRoot = document.createElement('div');
      mockRoot.textContent = 'test text';
      
      const utils = require('./utils');
      
      selection.restoreSelectionOffsets(mockRoot, 5);
      
      expect(utils.placeCaretAtOffset).toHaveBeenCalledWith(mockRoot, 5);
    });

    it('should clamp offset to text length', () => {
      const mockRoot = document.createElement('div');
      mockRoot.textContent = 'test'; // 4 characters
      
      const utils = require('./utils');
      
      selection.restoreSelectionOffsets(mockRoot, 10); // Offset beyond text length
      
      expect(utils.placeCaretAtOffset).toHaveBeenCalledWith(mockRoot, 4); // Clamped to 4
    });

    it('should handle negative offset', () => {
      const mockRoot = document.createElement('div');
      mockRoot.textContent = 'test';
      
      const utils = require('./utils');
      
      selection.restoreSelectionOffsets(mockRoot, -5); // Negative offset
      
      expect(utils.placeCaretAtOffset).toHaveBeenCalledWith(mockRoot, 0); // Clamped to 0
    });

    it('should handle range selection (currently falls back to collapsed)', () => {
      const mockRoot = document.createElement('div');
      mockRoot.textContent = 'test text';
      
      const utils = require('./utils');
      
      selection.restoreSelectionOffsets(mockRoot, 2, 7);
      
      // Currently falls back to collapsed at start
      expect(utils.placeCaretAtOffset).toHaveBeenCalledWith(mockRoot, 2);
    });
  });

  describe('isCaretAtStart', () => {
    it('should return true when caret is at start', () => {
      const mockRoot = document.createElement('div');
      mockRoot.textContent = 'test text';
      
      // Mock getSelectionOffsets to return caret at start
      const mockSnapshot: selection.LogicalSelectionSnapshot = {
        start: 0,
        end: 0,
        isCollapsed: true,
        isInsideRoot: true,
      };
      
      jest.spyOn(selection, 'getSelectionOffsets').mockReturnValue(mockSnapshot);
      
      const result = selection.isCaretAtStart(mockRoot);
      
      expect(result).toBe(true);
      expect(selection.getSelectionOffsets).toHaveBeenCalledWith(mockRoot);
    });

    it('should return false when caret is not at start', () => {
      const mockRoot = document.createElement('div');
      mockRoot.textContent = 'test text';
      
      // Mock getSelectionOffsets to return caret not at start
      const mockSnapshot: selection.LogicalSelectionSnapshot = {
        start: 5,
        end: 5,
        isCollapsed: true,
        isInsideRoot: true,
      };
      
      jest.spyOn(selection, 'getSelectionOffsets').mockReturnValue(mockSnapshot);
      
      const result = selection.isCaretAtStart(mockRoot);
      
      expect(result).toBe(false);
    });

    it('should return false when selection is not inside root', () => {
      const mockRoot = document.createElement('div');
      mockRoot.textContent = 'test text';
      
      // Mock getSelectionOffsets to return selection outside root
      const mockSnapshot: selection.LogicalSelectionSnapshot = {
        start: 0,
        end: 0,
        isCollapsed: true,
        isInsideRoot: false,
      };
      
      jest.spyOn(selection, 'getSelectionOffsets').mockReturnValue(mockSnapshot);
      
      const result = selection.isCaretAtStart(mockRoot);
      
      expect(result).toBe(false);
    });

    it('should return false when selection is not collapsed', () => {
      const mockRoot = document.createElement('div');
      mockRoot.textContent = 'test text';
      
      // Mock getSelectionOffsets to return range selection
      const mockSnapshot: selection.LogicalSelectionSnapshot = {
        start: 0,
        end: 4,
        isCollapsed: false,
        isInsideRoot: true,
      };
      
      jest.spyOn(selection, 'getSelectionOffsets').mockReturnValue(mockSnapshot);
      
      const result = selection.isCaretAtStart(mockRoot);
      
      expect(result).toBe(false);
    });
  });

  describe('isCaretAtEnd', () => {
    it('should return true when caret is at end', () => {
      const mockRoot = document.createElement('div');
      mockRoot.textContent = 'test'; // 4 characters
      
      // Mock getSelectionOffsets to return caret at end
      const mockSnapshot: selection.LogicalSelectionSnapshot = {
        start: 4,
        end: 4,
        isCollapsed: true,
        isInsideRoot: true,
      };
      
      jest.spyOn(selection, 'getSelectionOffsets').mockReturnValue(mockSnapshot);
      
      const result = selection.isCaretAtEnd(mockRoot);
      
      expect(result).toBe(true);
    });

    it('should return false when caret is not at end', () => {
      const mockRoot = document.createElement('div');
      mockRoot.textContent = 'test text';
      
      // Mock getSelectionOffsets to return caret not at end
      const mockSnapshot: selection.LogicalSelectionSnapshot = {
        start: 5,
        end: 5,
        isCollapsed: true,
        isInsideRoot: true,
      };
      
      jest.spyOn(selection, 'getSelectionOffsets').mockReturnValue(mockSnapshot);
      
      const result = selection.isCaretAtEnd(mockRoot);
      
      expect(result).toBe(false);
    });
  });

  describe('createDeltaTransform', () => {
    it('should create a transform that adds delta to offsets', () => {
      const transform = selection.createDeltaTransform(3);
      
      const result = transform(5, 10);
      
      expect(result).toEqual({
        start: 8, // 5 + 3
        end: 13,  // 10 + 3
      });
    });

    it('should handle negative delta', () => {
      const transform = selection.createDeltaTransform(-2);
      
      const result = transform(5, 10);
      
      expect(result).toEqual({
        start: 3, // 5 - 2
        end: 8,   // 10 - 2
      });
    });

    it('should clamp to zero for negative results', () => {
      const transform = selection.createDeltaTransform(-10);
      
      const result = transform(5, 10);
      
      expect(result).toEqual({
        start: 0, // 5 - 10 = -5, clamped to 0
        end: 0,   // 10 - 10 = 0
      });
    });
  });

  describe('applyTextMutation', () => {
    it('should update text and restore selection', () => {
      const mockRoot = document.createElement('div');
      // Set textContent directly
      Object.defineProperty(mockRoot, 'textContent', {
        writable: true,
        value: 'old text',
      });
      
      // Mock getSelectionOffsets
      const mockSnapshot: selection.LogicalSelectionSnapshot = {
        start: 4,
        end: 4,
        isCollapsed: true,
        isInsideRoot: true,
      };
      
      jest.spyOn(selection, 'getSelectionOffsets').mockReturnValue(mockSnapshot);
      
      // Mock restoreSelectionOffsets
      const mockRestoreSelectionOffsets = jest.fn();
      jest.spyOn(selection, 'restoreSelectionOffsets').mockImplementation(mockRestoreSelectionOffsets);
      
      const transform = selection.createDeltaTransform(2);
      selection.applyTextMutation(mockRoot, 'new longer text', transform);
      
      // Should update textContent
      expect(mockRoot.textContent).toBe('new longer text');
      
      // Should call restoreSelectionOffsets with transformed offsets
      expect(mockRestoreSelectionOffsets).toHaveBeenCalledWith(
        mockRoot,
        6, // 4 + 2
        6  // 4 + 2
      );
    });

    it('should not update text if it didnt change', () => {
      const mockRoot = document.createElement('div');
      const originalText = 'same text';
      mockRoot.textContent = originalText;
      
      // Spy on textContent setter
      let textContentSetterCalled = false;
      const originalTextContent = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'textContent');
      Object.defineProperty(mockRoot, 'textContent', {
        set(value) {
          textContentSetterCalled = true;
        },
        get() {
          return originalText;
        },
        configurable: true,
      });
      
      // Mock getSelectionOffsets
      const mockSnapshot: selection.LogicalSelectionSnapshot = {
        start: 4,
        end: 4,
        isCollapsed: true,
        isInsideRoot: true,
      };
      
      jest.spyOn(selection, 'getSelectionOffsets').mockReturnValue(mockSnapshot);
      
      const transform = selection.createDeltaTransform(0);
      selection.applyTextMutation(mockRoot, originalText, transform);
      
      // Restore original property descriptor
      if (originalTextContent) {
        Object.defineProperty(HTMLElement.prototype, 'textContent', originalTextContent);
      }
      
      // Should not call textContent setter since text didn't change
      expect(textContentSetterCalled).toBe(false);
    });

    it('should not restore selection if it was outside root', () => {
      const mockRoot = document.createElement('div');
      mockRoot.textContent = 'old text';
      
      // Mock getSelectionOffsets to return selection outside root
      const mockSnapshot: selection.LogicalSelectionSnapshot = {
        start: 4,
        end: 4,
        isCollapsed: true,
        isInsideRoot: false,
      };
      
      jest.spyOn(selection, 'getSelectionOffsets').mockReturnValue(mockSnapshot);
      
      // Mock restoreSelectionOffsets
      const mockRestoreSelectionOffsets = jest.fn();
      jest.spyOn(selection, 'restoreSelectionOffsets').mockImplementation(mockRestoreSelectionOffsets);
      
      const transform = selection.createDeltaTransform(2);
      selection.applyTextMutation(mockRoot, 'new text', transform);
      
      // Should update textContent
      expect(mockRoot.textContent).toBe('new text');
      
      // Should NOT call restoreSelectionOffsets since selection was outside root
      expect(mockRestoreSelectionOffsets).not.toHaveBeenCalled();
    });
  });

  describe('Round-trip tests for inline markdown', () => {
    it('should handle round-trip selection with bold text', () => {
      const mockRoot = document.createElement('div');
      mockRoot.textContent = '**bold** text';
      
      const mockRange = {
        commonAncestorContainer: mockRoot,
      };
      
      const mockSelection = {
        rangeCount: 1,
        getRangeAt: jest.fn(() => mockRange),
        isCollapsed: true,
      };
      
      Object.defineProperty(window, 'getSelection', {
        writable: true,
        value: jest.fn(() => mockSelection),
      });

      const utils = require('./utils');
      
      // Test various offsets in text with inline markdown
      const testOffsets = [0, 2, 5, 8, 12];
      
      testOffsets.forEach(offset => {
        utils.getCaretOffset.mockReturnValue(offset);
        
        const snapshot = selection.getSelectionOffsets(mockRoot);
        
        // Clear previous calls
        utils.placeCaretAtOffset.mockClear();
        
        selection.restoreSelectionOffsets(mockRoot, snapshot.start);
        
        // Should call placeCaretAtOffset with the same offset
        expect(utils.placeCaretAtOffset).toHaveBeenCalledWith(mockRoot, offset);
      });
    });

    it('should handle round-trip selection with mixed inline markdown', () => {
      const mockRoot = document.createElement('div');
      mockRoot.textContent = '**bold** and *italic* and `code`';
      
      const mockRange = {
        commonAncestorContainer: mockRoot,
      };
      
      const mockSelection = {
        rangeCount: 1,
        getRangeAt: jest.fn(() => mockRange),
        isCollapsed: true,
      };
      
      Object.defineProperty(window, 'getSelection', {
        writable: true,
        value: jest.fn(() => mockSelection),
      });

      const utils = require('./utils');
      
      // Test offsets at various positions including inside markdown syntax
      const testOffsets = [0, 3, 8, 15, 20, 25, 30];
      
      testOffsets.forEach(offset => {
        utils.getCaretOffset.mockReturnValue(offset);
        
        const snapshot = selection.getSelectionOffsets(mockRoot);
        
        // Clear previous calls
        utils.placeCaretAtOffset.mockClear();
        
        selection.restoreSelectionOffsets(mockRoot, snapshot.start);
        
        // Should call placeCaretAtOffset with the same offset
        expect(utils.placeCaretAtOffset).toHaveBeenCalledWith(mockRoot, offset);
      });
    });
  });
});