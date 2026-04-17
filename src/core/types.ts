export type BlockType =
  | "paragraph"
  | "heading"
  | "unordered-list"
  | "ordered-list"
  | "task-list"
  | "blockquote"
  | "code-fence"
  | "horizontal-rule";

export type Block = {
  id: string;
  type: BlockType;
  raw: string;
  meta?: {
    level?: number;
    marker?: string;
    checked?: boolean;
    order?: number;
  };
};

export type RenderableBlock = Pick<Block, "id" | "type" | "raw">;

export type BlockPoint = {
  blockId: string;
  offset: number;
};

export type BlockRange = {
  start: BlockPoint;
  end: BlockPoint;
  isCollapsed: boolean;
};
