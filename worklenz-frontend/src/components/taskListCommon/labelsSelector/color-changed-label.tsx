import React from 'react';
import { LabelType } from '../../../types/label.type';
import { Select, Tag, Tooltip } from '@/shared/antd-imports';
import { PhaseColorCodes } from '../../../shared/constants';
import { useTranslation } from 'react-i18next';

const ColorChangedLabel = ({ label }: { label: LabelType | null }) => {
  // localization
  const { t } = useTranslation('labelsSettings');

  // color options for the labels
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
        {label?.labelName}
      </Tag>
    ),
  }));

  return (
    <Tooltip title={t('colorChangeTooltip')}>
      <Select
        key={label?.labelId}
        options={colorsOptions}
        variant="borderless"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyItems: 'center',
          height: 22,
          maxWidth: 160,
        }}
        defaultValue={label?.labelColor}
        suffixIcon={null}
      />
    </Tooltip>
  );
};

export default ColorChangedLabel;
