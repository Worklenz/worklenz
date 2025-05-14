import { CaretDownFilled } from '@ant-design/icons';
import { Flex, Select } from 'antd';
import React from 'react';
import { useSelectedProject } from '../../../../../hooks/useSelectedProject';
import { useAppSelector } from '../../../../../hooks/useAppSelector';
import { useTranslation } from 'react-i18next';

type GroupByFilterDropdownProps = {
  activeGroup: 'status' | 'priority' | 'phases';
  setActiveGroup: (group: 'status' | 'priority' | 'phases') => void;
};

const GroupByFilterDropdown = ({
  activeGroup,
  setActiveGroup,
}: GroupByFilterDropdownProps) => {
  // localization
  const { t } = useTranslation('project-view-finance');

  const handleChange = (value: string) => {
    setActiveGroup(value as 'status' | 'priority' | 'phases');
  };

  // get selected project from useSelectedPro
  const selectedProject = useSelectedProject();

  //get phases details from phases slice
  const phase =
    useAppSelector((state) => state.phaseReducer.phaseList).find(
      (phase) => phase?.projectId === selectedProject?.projectId
    ) || null;

  const groupDropdownMenuItems = [
    { key: 'status', value: 'status', label: t('statusText') },
    { key: 'priority', value: 'priority', label: t('priorityText') },
    {
      key: 'phase',
      value: 'phase',
      label: phase ? phase?.phase : t('phaseText'),
    },
  ];

  return (
    <Flex align="center" gap={4} style={{ marginInlineStart: 12 }}>
      {t('groupByText')}:
      <Select
        defaultValue={'status'}
        options={groupDropdownMenuItems}
        onChange={handleChange}
        suffixIcon={<CaretDownFilled />}
      />
    </Flex>
  );
};

export default GroupByFilterDropdown;
