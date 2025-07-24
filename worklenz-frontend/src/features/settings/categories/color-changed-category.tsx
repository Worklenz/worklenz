import React from 'react';
import { Select, Tag, Tooltip } from '@/shared/antd-imports';
import { CategoryType } from '../../../types/categories.types';
import { useTranslation } from 'react-i18next';
import { PhaseColorCodes } from '../../../shared/constants';

const ColorChangedCategory = ({ category }: { category: CategoryType | null }) => {
  // localization
  const { t } = useTranslation('categoriesSettings');

  // color options for the categories
  const colorsOptions = PhaseColorCodes.map(color => ({
    key: color,
    value: color,
    label: (
      <Tag
        color={color}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyItems: 'center',
          height: 22,
          width: 'fit-content',
        }}
      >
        {category?.categoryName}
      </Tag>
    ),
  }));

  return (
    <Tooltip title={t('colorChangeTooltip')}>
      <Select
        key={category?.categoryId}
        options={colorsOptions}
        variant="borderless"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyItems: 'center',
          height: 22,
          maxWidth: 160,
        }}
        defaultValue={category?.categoryColor}
        suffixIcon={null}
      />
    </Tooltip>
  );
};

export default ColorChangedCategory;
