import React, { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Checkbox, Flex, Popover, Typography } from '@/shared/antd-imports';
import { FilterOutlined } from '@/shared/antd-imports';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  fetchReportingCategories,
  fetchReportingProjects,
  fetchReportingTeams,
  setArchived,
  setNoCategory,
  setSelectOrDeselectAllCategories,
  setSelectOrDeselectAllProjects,
  setSelectOrDeselectAllTeams,
  setSelectOrDeselectBillable,
} from '@/features/reporting/time-reports/time-reports-overview.slice';
import Team from '@/components/reporting/time-reports/page-header/Team';
import Categories from '@/components/reporting/time-reports/page-header/Categories';
import Projects from '@/components/reporting/time-reports/page-header/Projects';
import Billable from '@/components/reporting/time-reports/page-header/Billable';

// Options that have not loaded yet count as unfiltered.
const isUnfiltered = (items: Array<{ selected?: boolean }>) => items.every(item => item.selected);

/** Filter popover for the Timesheet report: the team / category / project / billable chips and archived projects. */
const TimeSheetFilterPanel: React.FC = () => {
  const { t } = useTranslation('time-report');
  const dispatch = useAppDispatch();
  const [panelOpen, setPanelOpen] = useState(false);
  const { teams, categories, projects, billable, archived } = useAppSelector(
    state => state.timeReportsOverviewReducer
  );

  // The chips live in the popover, which is unmounted while closed, so the options load here.
  useEffect(() => {
    const loadOptions = async () => {
      await dispatch(fetchReportingTeams());
      await dispatch(fetchReportingCategories());
      await dispatch(fetchReportingProjects());
    };
    loadOptions();
  }, [dispatch]);

  const activeFilterCount = [
    !isUnfiltered(teams),
    !isUnfiltered(categories),
    !isUnfiltered(projects),
    !(billable.billable && billable.nonBillable),
    archived,
  ].filter(Boolean).length;

  const handleClear = async () => {
    dispatch(setSelectOrDeselectAllTeams(true));
    dispatch(setSelectOrDeselectBillable({ billable: true, nonBillable: true }));
    dispatch(setArchived(false));
    dispatch(setNoCategory(false));
    await dispatch(fetchReportingCategories());
    await dispatch(fetchReportingProjects());
    dispatch(setSelectOrDeselectAllCategories(true));
    dispatch(setSelectOrDeselectAllProjects(true));
  };

  const panelContent = (
    <div style={{ width: 'min(520px, calc(100vw - 32px))', padding: '4px 0' }}>
      <Flex align="center" justify="space-between" style={{ marginBottom: 12 }}>
        <Typography.Text strong style={{ fontSize: 14 }}>
          {t('timeLogsFiltersTitle', { defaultValue: 'Filters' })}
        </Typography.Text>
        {activeFilterCount > 0 && (
          <Button type="link" size="small" style={{ padding: 0 }} onClick={handleClear}>
            {t('timeLogsFilterClear', { defaultValue: 'Clear' })}
          </Button>
        )}
      </Flex>

      <Flex gap={8} wrap="wrap" align="center">
        <Team size="middle" />
        <Categories size="middle" />
        <Projects size="middle" />
        <Billable size="middle" />
      </Flex>

      <Flex vertical gap={8} style={{ marginTop: 12 }}>
        <Checkbox checked={archived} onChange={event => dispatch(setArchived(event.target.checked))}>
          {t('includeArchivedProjects', { defaultValue: 'Include Archived Projects' })}
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
      <Button
        icon={<FilterOutlined />}
        type={activeFilterCount > 0 ? 'primary' : 'default'}
        ghost={activeFilterCount > 0}
      >
        {t('timeLogsFilterButton', { defaultValue: 'Filter' })}
        {activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
      </Button>
    </Popover>
  );
};

export default memo(TimeSheetFilterPanel);
