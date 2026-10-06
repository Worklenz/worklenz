import React from 'react';
import { Tag, Typography } from '@/shared/antd-imports';
import { toSolidTagColor } from '@/utils/colorUtils';

interface TruncatedColoredTagProps {
  label: string;
  color?: string;
  fontSize?: number;
}

// A colored status Tag that ellipsizes a long label to its container width.
// Uses Typography.Text's ellipsis so the hover tooltip only appears when the
// label is actually clipped (matches the pattern in TasksList.tsx).
export const TruncatedColoredTag: React.FC<TruncatedColoredTagProps> = ({
  label,
  color,
  fontSize = 11,
}) => (
  <Tag
    color={toSolidTagColor(color)}
    style={{
      margin: 0,
      fontSize,
      maxWidth: '100%',
      overflow: 'hidden',
      display: 'inline-flex',
      alignItems: 'center',
    }}
  >
    <Typography.Text
      ellipsis={{ tooltip: label }}
      style={{ color: 'inherit', fontSize, maxWidth: '100%' }}
    >
      {label}
    </Typography.Text>
  </Tag>
);
