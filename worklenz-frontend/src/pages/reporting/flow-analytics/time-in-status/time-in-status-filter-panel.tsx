import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Checkbox, Flex, Popover, Typography } from '@/shared/antd-imports';
import { FilterOutlined } from '@/shared/antd-imports';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  resetFilters,
  setIncludeArchived,
  setIncludeSubtasks,
  setSelectedAssignees,
  setSelectedProjects,
  setSelectedStatuses,
} from '@/features/reporting/timeInStatus/time-in-status-slice';
import { useReportOptions } from '../report-shell';
import TimeInStatusMultiSelectFilter from './time-in-status-multi-select-filter';

const TimeInStatusFilterPanel = () => {
  const { t } = useTranslation('reporting-flow');
  const dispatch = useAppDispatch();
  const [panelOpen, setPanelOpen] = useState(false);
  const { selectedProjects, selectedStatuses, selectedAssignees, includeSubtasks, includeArchived } = useAppSelector(
    state => state.timeInStatusReducer
  );
  const { projects, members, statuses, isFetching } = useReportOptions(includeArchived);

  const projectOptions = useMemo(
    () => projects.map(project => ({ id: project.id, name: project.name, color: project.color_code })),
    [projects]
  );
  const statusOptions = useMemo(
    () => statuses.map(status => ({ id: status.name, name: status.name, color: status.color })),
    [statuses]
  );
  const memberOptions = useMemo(() => members.map(member => ({ id: member.id, name: member.name })), [members]);

  const activeFilterCount = [
    selectedProjects.length > 0,
    selectedStatuses.length > 0,
    selectedAssignees.length > 0,
    includeSubtasks,
    includeArchived,
  ].filter(Boolean).length;

  const panelContent = (
    <div style={{ width: 'min(520px, calc(100vw - 32px))', padding: '4px 0' }}>
      <Flex align="center" justify="space-between" style={{ marginBottom: 12 }}>
        <Typography.Text strong style={{ fontSize: 14 }}>
          {t('tis.filtersTitle', { defaultValue: 'Filters' })}
        </Typography.Text>
        {activeFilterCount > 0 && (
          <Button type="link" size="small" style={{ padding: 0 }} onClick={() => dispatch(resetFilters())}>
            {t('tis.clear', { defaultValue: 'Clear' })}
          </Button>
        )}
      </Flex>

      <Typography.Text type="secondary" style={{ fontSize: 12, marginBottom: 8, display: 'block' }}>
        {t('tis.quickFilters', { defaultValue: 'Quick filters' })}
      </Typography.Text>
      <Flex gap={8} wrap="wrap" align="center">
        <TimeInStatusMultiSelectFilter
          label={t('tis.projectsFilter', { defaultValue: 'Projects' })}
          options={projectOptions}
          selected={selectedProjects}
          onChange={ids => dispatch(setSelectedProjects(ids))}
          loading={isFetching}
        />
        <TimeInStatusMultiSelectFilter
          label={t('tis.statusesFilter', { defaultValue: 'Statuses' })}
          options={statusOptions}
          selected={selectedStatuses}
          onChange={ids => dispatch(setSelectedStatuses(ids))}
          loading={isFetching}
        />
        <TimeInStatusMultiSelectFilter
          label={t('tis.assigneesFilter', { defaultValue: 'Assignees' })}
          options={memberOptions}
          selected={selectedAssignees}
          onChange={ids => dispatch(setSelectedAssignees(ids))}
          loading={isFetching}
        />
      </Flex>

      <Flex vertical gap={8} style={{ marginTop: 12 }}>
        <Checkbox checked={includeSubtasks} onChange={event => dispatch(setIncludeSubtasks(event.target.checked))}>
          {t('includeSubtasks', { defaultValue: 'Include sub-tasks' })}
        </Checkbox>
        <Checkbox checked={includeArchived} onChange={event => dispatch(setIncludeArchived(event.target.checked))}>
          {t('includeArchived', { defaultValue: 'Include archived projects' })}
        </Checkbox>
      </Flex>
    </div>
  );

  return (
    <Popover
      content={panelContent}
      trigger="click"
      placement="bottomRight"
      open={panelOpen}
      onOpenChange={setPanelOpen}
      overlayInnerStyle={{ padding: '12px 16px', borderRadius: 8 }}
    >
      <Button icon={<FilterOutlined />} type={activeFilterCount > 0 ? 'primary' : 'default'} ghost={activeFilterCount > 0}>
        {t('tis.filter', { defaultValue: 'Filter' })}
        {activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
      </Button>
    </Popover>
  );
};

export default memo(TimeInStatusFilterPanel);
