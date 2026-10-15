import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Checkbox, Flex, Popover, Select, Typography } from '@/shared/antd-imports';
import { FilterOutlined } from '@/shared/antd-imports';

export type VelocityMetric = 'story_points' | 'issue_count';

export interface VelocityFilters {
  projectId: string | undefined;
  metric: VelocityMetric;
  sprintCount: number;
  includeSubtasks: boolean;
  showTrend: boolean;
}

export const DEFAULT_VELOCITY_METRIC: VelocityMetric = 'issue_count';
export const DEFAULT_SPRINT_COUNT = 8;

const SPRINT_COUNT_OPTIONS = Array.from({ length: 10 }, (_, index) => index + 3);

interface VelocityFilterPanelProps {
  filters: VelocityFilters;
  projectOptions: { id: string; name: string }[];
  isLoadingProjects: boolean;
  onChange: (patch: Partial<VelocityFilters>) => void;
  onReset: () => void;
}

/** Filter button and popover, matching the Cumulative Flow report's Filter control. */
const VelocityFilterPanel = ({
  filters,
  projectOptions,
  isLoadingProjects,
  onChange,
  onReset,
}: VelocityFilterPanelProps) => {
  const { t } = useTranslation('reporting-flow');
  const [panelOpen, setPanelOpen] = useState(false);
  const { projectId, metric, sprintCount, includeSubtasks, showTrend } = filters;

  // The project always has a value, so it is not counted as an active filter.
  const activeFilterCount = [
    metric !== DEFAULT_VELOCITY_METRIC,
    sprintCount !== DEFAULT_SPRINT_COUNT,
    includeSubtasks,
    showTrend,
  ].filter(Boolean).length;

  const panelContent = (
    <div style={{ width: 'min(420px, calc(100vw - 32px))', padding: '4px 0' }}>
      <Flex align="center" justify="space-between" style={{ marginBottom: 12 }}>
        <Typography.Text strong style={{ fontSize: 14 }}>
          {t('tis.filtersTitle', { defaultValue: 'Filters' })}
        </Typography.Text>
        {activeFilterCount > 0 && (
          <Button type="link" size="small" style={{ padding: 0 }} onClick={onReset}>
            {t('tis.clear', { defaultValue: 'Clear' })}
          </Button>
        )}
      </Flex>

      <Flex vertical gap={12}>
        <Flex vertical gap={4}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {t('project', { defaultValue: 'Project' })}
          </Typography.Text>
          <Select
            showSearch
            optionFilterProp="label"
            loading={isLoadingProjects}
            placeholder={t('selectProject', { defaultValue: 'Select a project' })}
            aria-label={t('project', { defaultValue: 'Project' })}
            value={projectId}
            options={projectOptions.map(project => ({ value: project.id, label: project.name }))}
            onChange={value => onChange({ projectId: value })}
            getPopupContainer={trigger => trigger.parentElement ?? document.body}
          />
        </Flex>
        <Flex gap={12} wrap="wrap">
          <Flex vertical gap={4} style={{ flex: '1 1 180px' }}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {t('velocity.metric', { defaultValue: 'Metric' })}
            </Typography.Text>
            <Select
              aria-label={t('velocity.metric', { defaultValue: 'Metric' })}
              value={metric}
              onChange={value => onChange({ metric: value })}
              options={[
                { value: 'issue_count', label: t('velocity.metricIssuesOption', { defaultValue: 'Tasks' }) },
                { value: 'story_points', label: t('velocity.metricStoryPointsOption', { defaultValue: 'Story points' }) },
              ]}
              getPopupContainer={trigger => trigger.parentElement ?? document.body}
            />
          </Flex>
          <Flex vertical gap={4} style={{ flex: '1 1 180px' }}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {t('velocity.sprintsToShow', { defaultValue: 'Sprints to show' })}
            </Typography.Text>
            <Select
              aria-label={t('velocity.sprintsToShow', { defaultValue: 'Sprints to show' })}
              value={sprintCount}
              onChange={value => onChange({ sprintCount: value })}
              options={SPRINT_COUNT_OPTIONS.map(count => ({
                value: count,
                label: t('velocity.lastSprints', { defaultValue: 'Last {{count}} sprints', count }),
              }))}
              getPopupContainer={trigger => trigger.parentElement ?? document.body}
            />
          </Flex>
        </Flex>

        <Flex gap={16} wrap="wrap">
          <Checkbox checked={includeSubtasks} onChange={event => onChange({ includeSubtasks: event.target.checked })}>
            {t('includeSubtasks', { defaultValue: 'Include sub-tasks' })}
          </Checkbox>
          <Checkbox checked={showTrend} onChange={event => onChange({ showTrend: event.target.checked })}>
            {t('velocity.trendLine', { defaultValue: 'Trend line' })}
          </Checkbox>
        </Flex>
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

export default memo(VelocityFilterPanel);
