import React from 'react';
import { Tag, Typography } from '@/shared/antd-imports';
import { colors } from '@/styles/colors';
import { IProjectCategory } from '@/types/project/projectCategory.types';

const CustomColorsCategoryTag = ({ category }: { category: IProjectCategory | null }) => {
  return (
    <Tag key={category?.id} color={category?.color_code}>
      <Typography.Text style={{ fontSize: 12, color: colors.darkGray }}>
        {category?.name}
      </Typography.Text>
    </Tag>
  );
};

export default CustomColorsCategoryTag;
