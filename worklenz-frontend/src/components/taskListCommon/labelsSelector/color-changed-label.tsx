import React from 'react';
import { ITaskLabel } from '@/types/label.type';
import Select from 'antd/es/select';
import Tag from 'antd/es/tag';
import Tooltip from 'antd/es/tooltip';
import { PhaseColorCodes } from '../../../shared/constants';
import { useTranslation } from 'react-i18next';

const ColorChangedLabel = ({ label }: { label: ITaskLabel | null }) => {
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
        {label?.name}
      </Tag>
    ),
  }));

  return (
    <Tooltip title={t('colorChangeTooltip')}>
      <Select
        key={label?.id}
        options={colorsOptions}
        variant="borderless"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyItems: 'center',
          height: 22,
          maxWidth: 160,
        }}
        defaultValue={label?.color_code}
        suffixIcon={null}
      />
    </Tooltip>
  );
};

export default ColorChangedLabel;
