import { IGroupBy } from '@/features/board/board-slice';
import { CaretDownFilled } from '@/shared/antd-imports';
import { Flex, Select } from '@/shared/antd-imports';
import React from 'react';
import { useTranslation } from 'react-i18next';

type GroupByFilterProps = {
  setActiveGroup: (group: IGroupBy) => void;
};

const GroupByFilter = ({ setActiveGroup }: GroupByFilterProps) => {
  // localization
  const { t } = useTranslation('reporting-projects-drawer');

  const handleChange = (value: string) => {
    setActiveGroup(value as IGroupBy);
  };

  const groupDropdownMenuItems = [
    { key: 'status', value: 'status', label: t('statusText') },
    { key: 'priority', value: 'priority', label: t('priorityText') },
    {
      key: 'phase',
      value: 'phase',
      label: t('phaseText'),
    },
  ];

  return (
    <Flex align="center" gap={4} style={{ marginInlineStart: 12 }}>
      {t('groupByText')}
      <Select
        defaultValue={'status'}
        options={groupDropdownMenuItems}
        onChange={handleChange}
        suffixIcon={<CaretDownFilled />}
      />
    </Flex>
  );
};

export default GroupByFilter;
