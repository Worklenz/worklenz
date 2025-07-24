import { CaretDownFilled } from '@/shared/antd-imports';
import { ConfigProvider, Flex, Select } from '@/shared/antd-imports';
import React, { useState } from 'react';
import { colors } from '@/styles/colors';
import ConfigPhaseButton from '@features/projects/singleProject/phase/ConfigPhaseButton';
import { useSelectedProject } from '@/hooks/useSelectedProject';
import { useAppSelector } from '@/hooks/useAppSelector';
import CreateStatusButton from '@/components/project-task-filters/create-status-button/create-status-button';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { setGroupBy } from '@features/group-by-filter-dropdown/group-by-filter-dropdown-slice';

const GroupByFilterDropdown = ({ position }: { position: 'list' | 'board' }) => {
  const dispatch = useAppDispatch();

  type GroupTypes = 'status' | 'priority' | 'phase' | 'members' | 'list';

  const [activeGroup, setActiveGroup] = useState<GroupTypes>('status');

  // localization
  const { t } = useTranslation('task-list-filters');

  const handleChange = (value: string) => {
    setActiveGroup(value as GroupTypes);
    dispatch(setGroupBy(value as GroupTypes));
  };

  // get selected project from useSelectedPro
  const selectedProject = useSelectedProject();

  //get phases details from phases slice
  const phase =
    useAppSelector(state => state.phaseReducer.phaseList).find(
      phase => phase.projectId === selectedProject?.id
    ) || null;

  const groupDropdownMenuItems = [
    { key: 'status', value: 'status', label: t('statusText') },
    { key: 'priority', value: 'priority', label: t('priorityText') },
    {
      key: 'phase',
      value: 'phase',
      label: phase ? phase?.phase : t('phaseText'),
    },
    { key: 'members', value: 'members', label: t('memberText') },
    { key: 'list', value: 'list', label: t('listText') },
  ];

  return (
    <Flex align="center" gap={4} style={{ marginInlineStart: 12 }}>
      {t('groupByText')}:
      <Select
        defaultValue={'status'}
        options={groupDropdownMenuItems}
        onChange={handleChange}
        suffixIcon={<CaretDownFilled />}
        dropdownStyle={{ width: 'wrap-content' }}
      />
      {(activeGroup === 'status' || activeGroup === 'phase') && (
        <ConfigProvider wave={{ disabled: true }}>
          {activeGroup === 'phase' && <ConfigPhaseButton color={colors.skyBlue} />}
          {activeGroup === 'status' && <CreateStatusButton />}
        </ConfigProvider>
      )}
    </Flex>
  );
};

export default GroupByFilterDropdown;
