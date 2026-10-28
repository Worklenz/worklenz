import React from 'react';
import { Tag } from '@/shared/antd-imports';
import { IProjectCategory } from '@/types/project/projectCategory.types';
import { getContrastColor } from '@/utils/colorUtils';
import { decodeHtmlEntities } from '@/utils/html-entities';

const CustomColorsCategoryTag = ({ category }: { category: IProjectCategory | null }) => {
  const bgColor = category?.color_code || '#a9a9a9';
  const textColor = getContrastColor(bgColor);
  const decodedName = decodeHtmlEntities(category?.name);

  return (
    <Tag
      key={category?.id}
      style={{
        backgroundColor: bgColor,
        border: 'none',
      }}
    >
      <span style={{ fontSize: 12, color: textColor }}>{decodedName}</span>
    </Tag>
  );
};

export default CustomColorsCategoryTag;
