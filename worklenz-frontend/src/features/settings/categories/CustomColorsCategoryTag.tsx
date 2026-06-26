import React from 'react';
import { Tag } from '@/shared/antd-imports';
import { IProjectCategory } from '@/types/project/projectCategory.types';
import { getContrastColor } from '@/utils/colorUtils';

const CustomColorsCategoryTag = ({ category }: { category: IProjectCategory | null }) => {
  const bgColor = category?.color_code || '#a9a9a9';
  const textColor = getContrastColor(bgColor);

  return (
    <Tag
      key={category?.id}
      style={{
        backgroundColor: bgColor,
        border: 'none',
      }}
    >
      <span style={{ fontSize: 12, color: textColor }}>{category?.name}</span>
    </Tag>
  );
};

export default CustomColorsCategoryTag;
