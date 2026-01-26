import { CaretDownFilled } from '@/shared/antd-imports';
import { ConfigProvider, Flex, Select } from '@/shared/antd-imports';
import { useState } from 'react';
import ConfigPhaseButton from '@features/projects/singleProject/phase/ConfigPhaseButton';
import { useSelectedProject } from '@/hooks/useSelectedProject';
import { useAppSelector } from '@/hooks/useAppSelector';
import CreateStatusButton from '@/components/project-task-filters/create-status-button/create-status-button';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { setGroupBy } from '@features/group-by-filter-dropdown/group-by-filter-dropdown-slice';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_project_task_list_search_task } from '@/shared/worklenz-analytics-events';
import { FilterSortEventProps } from '@/types/mixpanel-events.types';

const GroupByFilterDropdown = ({ position }: { position: 'list' | 'board' }) => {
  const dispatch = useAppDispatch();

  type GroupTypes = 'status' | 'priority' | 'phase';

  const [activeGroup, setActiveGroup] = useState<GroupTypes>('status');

  // localization
  const { t } = useTranslation('task-list-filters');
  const { projectId } = useAppSelector(state => state.projectReducer);
  const { trackMixpanelEvent } = useMixpanelTracking();

  const handleChange = (value: string) => {
    setActiveGroup(value as GroupTypes);
    dispatch(setGroupBy(value as GroupTypes));
    const props: FilterSortEventProps = {
      filter_type: 'custom',
      sort_order: 'asc',
      project_id: projectId || undefined,
    };
    trackMixpanelEvent(evt_project_task_list_search_task, props);
  };

  // get selected project from useSelectedProject
  const selectedProject = useSelectedProject();

  // Only show status, priority, and phase for schedule drawer
  const groupDropdownMenuItems = [
    { key: 'status', value: 'status', label: t('statusText', { defaultValue: 'Status' }) },
    { key: 'priority', value: 'priority', label: t('priorityText', { defaultValue: 'Priority' }) },
    {
      key: 'phase',
      value: 'phase',
      label: t('phaseText', { defaultValue: 'Phase' }),
    },
  ];

  return (
    <Flex align="center" gap={4} style={{ marginInlineStart: 12 }}>
      {t('groupByText', { defaultValue: 'Group by' })}:
      <Select
        defaultValue={'status'}
        options={groupDropdownMenuItems}
        onChange={handleChange}
        suffixIcon={<CaretDownFilled />}
        popupMatchSelectWidth={false}
      />
      {(activeGroup === 'status' || activeGroup === 'phase') && (
        <ConfigProvider wave={{ disabled: true }}>
          {activeGroup === 'phase' && <ConfigPhaseButton />}
          {activeGroup === 'status' && <CreateStatusButton />}
        </ConfigProvider>
      )}
    </Flex>
  );
};

export default GroupByFilterDropdown;
