import type { ReactNode } from 'react';
import {
  CheckSquareOutlined,
  CodeOutlined,
  FontSizeOutlined,
  InfoCircleOutlined,
  MinusOutlined,
  OrderedListOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';

const headingIcon = (level: string) => <span className="docs-menu-glyph">{level}</span>;
export const COMMAND_ICONS: Record<string, ReactNode> = {
  paragraph: <FontSizeOutlined />,
  heading1: headingIcon('H1'),
  heading2: headingIcon('H2'),
  heading3: headingIcon('H3'),
  bulletList: <UnorderedListOutlined />,
  numberedList: <OrderedListOutlined />,
  checklist: <CheckSquareOutlined />,
  quote: <span className="docs-menu-glyph">”</span>,
  code: <CodeOutlined />,
  divider: <MinusOutlined />,
  callout: <InfoCircleOutlined />,
};
export const COMMAND_GROUPS: Array<[string, string, string[]]> = [
  ['groupText', 'Text', ['paragraph', 'heading1', 'heading2', 'heading3']],
  ['groupLists', 'Lists', ['bulletList', 'numberedList', 'checklist']],
  ['groupBlocks', 'Blocks', ['quote', 'code', 'divider', 'callout']],
];
