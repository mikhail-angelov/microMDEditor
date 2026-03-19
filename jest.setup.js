require('@testing-library/jest-dom');

// Mock window.getSelection for contenteditable tests
Object.defineProperty(window, 'getSelection', {
  writable: true,
  value: jest.fn(() => {
    const range = document.createRange();
    return {
      removeAllRanges: jest.fn(),
      addRange: jest.fn(),
      anchorNode: null,
      anchorOffset: 0,
      focusNode: null,
      focusOffset: 0,
      isCollapsed: true,
      rangeCount: 1,
      toString: jest.fn(() => ''),
      getRangeAt: jest.fn(() => range),
    };
  }),
});

// Mock document.createRange
document.createRange = jest.fn(() => {
  // Use real Range constructor if available
  const RangeConstructor = global.Range || function Range() {};
  const range = new RangeConstructor();

  // Mock methods
  range.setStart = jest.fn();
  range.setEnd = jest.fn();
  range.setStartAfter = jest.fn();
  range.setEndAfter = jest.fn();
  range.collapse = jest.fn();
  range.selectNodeContents = jest.fn();
  range.deleteContents = jest.fn();
  range.insertNode = jest.fn();
  range.cloneContents = jest.fn();
  range.extractContents = jest.fn();
  range.cloneRange = jest.fn(() => range);
  range.toString = jest.fn(() => '');
  range.startContainer = document.createTextNode('');
  range.startOffset = 0;
  range.endContainer = document.createTextNode('');
  range.endOffset = 0;
  range.collapsed = true;
  range.commonAncestorContainer = document.body;

  return range;
});

// Ensure Range constructor exists
if (typeof Range === 'undefined') {
  global.Range = class Range {
    constructor() {
      this.setStart = jest.fn();
      this.setEnd = jest.fn();
      this.setStartAfter = jest.fn();
      this.setEndAfter = jest.fn();
      this.collapse = jest.fn();
      this.selectNodeContents = jest.fn();
      this.deleteContents = jest.fn();
      this.insertNode = jest.fn();
      this.cloneContents = jest.fn();
      this.extractContents = jest.fn();
      this.cloneRange = jest.fn(() => this);
      this.toString = jest.fn(() => '');
      this.startContainer = document.createTextNode('');
      this.startOffset = 0;
      this.endContainer = document.createTextNode('');
      this.endOffset = 0;
      this.collapsed = true;
      this.commonAncestorContainer = document.body;
    }
  };
}

// Mock document.execCommand
document.execCommand = jest.fn();

// Mock HTMLElement contentEditable support
Object.defineProperty(HTMLElement.prototype, 'contentEditable', {
  configurable: true,
  value: 'true',
});