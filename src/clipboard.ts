import type { Block, BlockPoint, BlockRange, ClipboardReplaceResult } from './types';
import { detectType, parseMarkdown } from './utils';

const findBlockIndex = (blocks: Block[], blockId: string): number => {
  const index = blocks.findIndex((block) => block.id === blockId);
  if (index === -1) {
    throw new Error(`Block not found: ${blockId}`);
  }
  return index;
};

const rangeIsValid = (startIndex: number, endIndex: number): boolean => startIndex <= endIndex;

export const serializeBlockRange = (blocks: Block[], range: BlockRange): string => {
  const startIndex = findBlockIndex(blocks, range.start.blockId);
  const endIndex = findBlockIndex(blocks, range.end.blockId);

  if (!rangeIsValid(startIndex, endIndex)) {
    throw new Error('Block range start must not come after the end');
  }

  if (startIndex === endIndex && range.start.offset > range.end.offset) {
    throw new Error('Block range offsets are invalid for a single block');
  }

  const serialized: string[] = [];

  for (let index = startIndex; index <= endIndex; index += 1) {
    const block = blocks[index];
    let slice = block.raw;

    if (index === startIndex) {
      slice = slice.slice(range.start.offset);
    }

    if (index === endIndex) {
      slice = slice.slice(0, range.end.offset);
    }

    serialized.push(slice);
  }

  return serialized.join('\n');
};

export const replaceBlockRange = (
  blocks: Block[],
  range: BlockRange,
  pastedText: string,
): ClipboardReplaceResult => {
  const startIndex = findBlockIndex(blocks, range.start.blockId);
  const endIndex = findBlockIndex(blocks, range.end.blockId);

  if (!rangeIsValid(startIndex, endIndex)) {
    throw new Error('Block range start must not come after the end');
  }

  const startBlock = blocks[startIndex];
  const endBlock = blocks[endIndex];
  const prefix = startBlock.raw.slice(0, range.start.offset);
  const suffix = endBlock.raw.slice(range.end.offset);

  const parsed = parseMarkdown(pastedText);
  if (parsed.length === 0) {
    parsed.push({
      id: startBlock.id,
      raw: `${prefix}${suffix}`,
      type: detectType(`${prefix}${suffix}`),
    } as Block);
  }
  const lastIndex = parsed.length - 1;
  const lastInsertedRawLength = parsed[lastIndex]?.raw.length ?? 0;

  const hasSingleBlock = lastIndex === 0;

  const mergedBlocks: Block[] = hasSingleBlock
    ? [
        {
          ...parsed[0],
          raw: `${prefix}${parsed[0].raw}${suffix}`,
          type: detectType(`${prefix}${parsed[0].raw}${suffix}`),
          id: startBlock.id,
        },
      ]
    : parsed.map((block) => ({ ...block }));

  if (!hasSingleBlock) {
    const firstRaw = `${prefix}${mergedBlocks[0].raw}`;
    mergedBlocks[0] = {
      ...mergedBlocks[0],
      raw: firstRaw,
      type: detectType(firstRaw),
      id: startBlock.id,
    };

    const lastRaw = `${mergedBlocks[lastIndex].raw}${suffix}`;
    mergedBlocks[lastIndex] = {
      ...mergedBlocks[lastIndex],
      raw: lastRaw,
      type: detectType(lastRaw),
      id: endBlock.id,
    };
  }

  const caretOffset = hasSingleBlock ? prefix.length + lastInsertedRawLength : lastInsertedRawLength;
  const caretBlockId = mergedBlocks[mergedBlocks.length - 1].id;

  const updatedBlocks = [
    ...blocks.slice(0, startIndex),
    ...mergedBlocks,
    ...blocks.slice(endIndex + 1),
  ];

  const caret: BlockPoint = {
    blockId: caretBlockId,
    offset: caretOffset,
  };

  return {
    blocks: updatedBlocks,
    caret,
  };
};
