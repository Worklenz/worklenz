import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import dayjs, { Dayjs } from 'dayjs';
import {
  Button,
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DatePicker,
  DeleteOutlined,
  DownOutlined,
  Dropdown,
  EditOutlined,
  Empty,
  Flex,
  InputNumber,
  MenuProps,
  Modal,
  MoreOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  Popover,
  Select,
  Spin,
  Switch,
  Tag,
  Tooltip,
  Typography,
  message,
  theme,
} from '@/shared/antd-imports';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useSprintActions } from '@/hooks/useSprintActions';
import {
  phasesApiService,
  type SprintSettings,
} from '@/api/taskAttributes/phases/phases.api.service';
import { store } from '@/app/store';
import { mergeProjectData } from '@/features/project/project-drawer.slice';
import { mergeProject } from '@/features/project/project.slice';
import {
  addPhaseWithDates,
  deletePhaseOption,
  fetchPhasesByProjectId,
} from '@/features/projects/singleProject/phase/phases.slice';
import { SprintFormModal } from '@/components/task-management/sprint-form-modal';
import { ITaskPhase } from '@/types/tasks/taskPhase.types';
import { isAnnouncedApiError } from '@/utils/api-errors';
import logger from '@/utils/errorLogger';
import SettingsCard from '../../project-settings-modal/components/settings-card';
import { SectionHeader } from '../components/section-header';

interface SoftwareSprintsSectionProps {
  projectId: string;
  disabled: boolean;
}

/**
 * Sprint (iteration) settings for software projects: Active / Completed lists,
 * one-click "Add sprint" that continues the cadence, and custom start/duration.
 */
export const SoftwareSprintsSection = ({ projectId, disabled }: SoftwareSprintsSectionProps) => {
  const { t } = useTranslation('project-drawer');
  const { token } = theme.useToken();
  const dispatch = useAppDispatch();
  const sprintActions = useSprintActions(projectId);
  const [modal, modalContextHolder] = Modal.useModal();
  const { phaseList, loadingPhases } = useAppSelector(state => state.phaseReducer);
  const project = useAppSelector(state => state.projectDrawerReducer.project);

  const [view, setView] = useState<SprintView>('active');
  const [isAdding, setIsAdding] = useState(false);
  const [isMoreOptionsOpen, setIsMoreOptionsOpen] = useState(false);
  const [customStart, setCustomStart] = useState<Dayjs | null>(null);
  const [customLength, setCustomLength] = useState<number>(2);
  const [customUnit, setCustomUnit] = useState<DurationUnit>('weeks');
  const [editingSprint, setEditingSprint] = useState<ITaskPhase | null>(null);
  const [savingSetting, setSavingSetting] = useState<keyof SprintSettings | null>(null);

  useEffect(() => {
    if (projectId) void dispatch(fetchPhasesByProjectId(projectId));
  }, [dispatch, projectId]);

  const activeSprints = useMemo(
    () =>
      phaseList
        .filter(sprint => sprint.sprint_status !== 'completed')
        .sort((a, b) => {
          if (a.sprint_status === 'active' && b.sprint_status !== 'active') return -1;
          if (b.sprint_status === 'active' && a.sprint_status !== 'active') return 1;
          return compareByStartDate(a, b);
        }),
    [phaseList]
  );
  const completedSprints = useMemo(
    () =>
      phaseList
        .filter(sprint => sprint.sprint_status === 'completed')
        .sort((a, b) => compareByStartDate(b, a)),
    [phaseList]
  );
  const visibleSprints = view === 'active' ? activeSprints : completedSprints;
  const hasActiveSprint = activeSprints.some(sprint => sprint.sprint_status === 'active');

  const nextSprintDefaults = useMemo(() => getNextSprintDefaults(phaseList), [phaseList]);

  const openMoreOptions = (open: boolean) => {
    setIsMoreOptionsOpen(open);
    if (!open) return;
    const { start, lengthDays } = nextSprintDefaults;
    setCustomStart(start);
    if (lengthDays % 7 === 0) {
      setCustomLength(lengthDays / 7);
      setCustomUnit('weeks');
    } else {
      setCustomLength(lengthDays);
      setCustomUnit('days');
    }
  };

  const addSprint = async (start: Dayjs, lengthDays: number) => {
    if (disabled) return;
    const name = getNextSprintName(phaseList, t('softwareSettings.sprintNamePrefix', { defaultValue: 'Sprint' }));
    setIsAdding(true);
    try {
      const response = await dispatch(
        addPhaseWithDates({
          projectId,
          name,
          start_date: start.startOf('day').toISOString(),
          end_date: start.add(lengthDays - 1, 'day').endOf('day').toISOString(),
        })
      ).unwrap();
      if (!response?.done) throw new Error(response?.message);
      message.success(t('softwareSettings.sprintAdded', { defaultValue: '{{name}} added', name }));
      setIsMoreOptionsOpen(false);
      setView('active');
      await sprintActions.refreshSprintData();
    } catch (error) {
      logger.error('Error adding sprint', error);
      if (!isAnnouncedApiError(error)) {
        message.error(t('softwareSettings.sprintAddError', { defaultValue: 'Could not add sprint' }));
      }
    } finally {
      setIsAdding(false);
    }
  };

  const handleQuickAdd = () =>
    addSprint(nextSprintDefaults.start, nextSprintDefaults.lengthDays);

  const handleCustomAdd = () => {
    if (!customStart || !customLength || customLength < 1) return;
    addSprint(customStart, customUnit === 'weeks' ? customLength * 7 : customLength);
  };

  const handleDelete = (sprint: ITaskPhase) => {
    const itemCount = Number(sprint.usage ?? 0);
    modal.confirm({
      title: t('softwareSettings.deleteSprintTitle', {
        defaultValue: 'Delete {{name}}?',
        name: sprint.name,
      }),
      content:
        itemCount > 0
          ? t('softwareSettings.deleteSprintWithItems', {
              defaultValue:
                '{{count}} work item(s) in this sprint will move to the Backlog. This cannot be undone.',
              count: itemCount,
            })
          : t('softwareSettings.deleteSprintEmpty', { defaultValue: 'This cannot be undone.' }),
      okText: t('softwareSettings.deleteSprint', { defaultValue: 'Delete sprint' }),
      okButtonProps: { danger: true },
      cancelText: t('softwareSettings.cancel', { defaultValue: 'Cancel' }),
      onOk: async () => {
        try {
          const response = await dispatch(
            deletePhaseOption({ phaseOptionId: sprint.id, projectId })
          ).unwrap();
          if (!response?.done) throw new Error(response?.message);
          message.success(t('softwareSettings.sprintDeleted', { defaultValue: 'Sprint deleted' }));
          await sprintActions.refreshSprintData();
        } catch (error) {
          logger.error('Error deleting sprint', error);
          if (isAnnouncedApiError(error)) return;
          message.error(
            t('softwareSettings.sprintDeleteError', { defaultValue: 'Could not delete sprint' })
          );
        }
      },
    });
  };

  const handleSettingChange = async (setting: keyof SprintSettings, checked: boolean) => {
    if (disabled) return;
    setSavingSetting(setting);
    try {
      const response = await phasesApiService.updateSprintSettings(projectId, { [setting]: checked });
      if (!response.done) throw new Error(response.message);
      const changes = { [setting]: checked };
      dispatch(mergeProjectData({ projectId, changes }));
      if (store.getState().projectReducer.project?.id === projectId) {
        dispatch(mergeProject(changes));
      }
    } catch (error) {
      logger.error('Error updating sprint settings', error);
      if (!isAnnouncedApiError(error)) {
        message.error(
          t('softwareSettings.sprintSettingsError', { defaultValue: 'Could not update sprint settings' })
        );
      }
    } finally {
      setSavingSetting(null);
    }
  };

  const getSprintMenu = (sprint: ITaskPhase): MenuProps => {
    const items: MenuProps['items'] = [
      {
        key: 'edit',
        icon: <EditOutlined />,
        label: t('softwareSettings.editSprint', { defaultValue: 'Edit sprint' }),
      },
    ];
    if (sprint.sprint_status === 'planned') {
      items.push({
        key: 'start',
        icon: <PlayCircleOutlined />,
        disabled: hasActiveSprint,
        label: hasActiveSprint ? (
          <Tooltip
            title={t('softwareSettings.startSprintBlocked', {
              defaultValue: 'Complete the current sprint first',
            })}
            placement="left"
          >
            {t('softwareSettings.startSprint', { defaultValue: 'Start sprint' })}
          </Tooltip>
        ) : (
          t('softwareSettings.startSprint', { defaultValue: 'Start sprint' })
        ),
      });
    }
    if (sprint.sprint_status === 'active') {
      items.push({
        key: 'complete',
        icon: <CheckCircleOutlined />,
        label: t('softwareSettings.completeSprint', { defaultValue: 'Complete sprint' }),
      });
    }
    items.push(
      { type: 'divider' },
      {
        key: 'delete',
        danger: true,
        icon: <DeleteOutlined />,
        label: t('softwareSettings.deleteSprint', { defaultValue: 'Delete sprint' }),
      }
    );

    return {
      items,
      onClick: ({ key }) => {
        if (key === 'edit') setEditingSprint(sprint);
        if (key === 'start') void sprintActions.startSprint(sprint.id);
        if (key === 'complete') sprintActions.completeSprint(sprint.id);
        if (key === 'delete') handleDelete(sprint);
      },
    };
  };

  const moreOptionsContent = (
    <Flex vertical gap={12} style={{ width: 240 }}>
      <div>
        <Typography.Text style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
          {t('softwareSettings.sprintStartsOn', { defaultValue: 'Starts on' })}
        </Typography.Text>
        <DatePicker
          className="w-full"
          value={customStart}
          onChange={setCustomStart}
          allowClear={false}
          format="MMM D, YYYY"
        />
      </div>
      <div>
        <Typography.Text style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
          {t('softwareSettings.sprintDuration', { defaultValue: 'Duration' })}
        </Typography.Text>
        <Flex gap={8}>
          <InputNumber
            min={1}
            max={customUnit === 'weeks' ? 12 : 90}
            value={customLength}
            onChange={value => setCustomLength(Number(value) || 1)}
            style={{ width: 72 }}
          />
          <Select
            className="flex-1"
            value={customUnit}
            onChange={setCustomUnit}
            options={[
              { value: 'weeks', label: t('softwareSettings.unitWeeks', { defaultValue: 'weeks' }) },
              { value: 'days', label: t('softwareSettings.unitDays', { defaultValue: 'days' }) },
            ]}
          />
        </Flex>
      </div>
      <Flex justify="end" gap={8}>
        <Button size="small" onClick={() => setIsMoreOptionsOpen(false)}>
          {t('softwareSettings.cancel', { defaultValue: 'Cancel' })}
        </Button>
        <Button
          size="small"
          type="primary"
          loading={isAdding}
          disabled={!customStart || !customLength}
          onClick={handleCustomAdd}
        >
          {t('softwareSettings.add', { defaultValue: 'Add' })}
        </Button>
      </Flex>
    </Flex>
  );

  const tabButton = (key: SprintView, icon: ReactNode, label: string) => {
    const isSelected = view === key;
    return (
      <button
        type="button"
        aria-pressed={isSelected}
        onClick={() => setView(key)}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-[13px] transition-colors"
        style={{
          color: isSelected ? token.colorText : token.colorTextSecondary,
          fontWeight: isSelected ? 600 : 400,
          background: isSelected ? token.colorFillSecondary : 'transparent',
          border: 'none',
        }}
      >
        {icon}
        {label}
      </button>
    );
  };

  return (
    <Flex vertical gap={16}>
      {sprintActions.sprintModalContextHolder}
      {modalContextHolder}

      <SectionHeader
        title={t('softwareSettings.sprintsTitle', { defaultValue: 'Sprints' })}
        description={t('softwareSettings.sprintsDescription', {
          defaultValue:
            'Plan, start and complete sprints, and choose what happens to finished work. Changes save automatically.',
        })}
      />

      <div
        style={{
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: 10,
          background: token.colorBgContainer,
          overflow: 'hidden',
        }}
      >
        <Flex
          align="center"
          justify="space-between"
          gap={8}
          wrap="wrap"
          style={{ padding: '8px 12px', borderBottom: `1px solid ${token.colorBorderSecondary}` }}
        >
          <Flex gap={4}>
            {tabButton(
              'active',
              <ClockCircleOutlined />,
              t('softwareSettings.activeSprintsTab', {
                defaultValue: '{{count}} Active',
                count: activeSprints.length,
              })
            )}
            {tabButton(
              'completed',
              <CalendarOutlined />,
              t('softwareSettings.completedSprintsTab', {
                defaultValue: '{{count}} Completed',
                count: completedSprints.length,
              })
            )}
          </Flex>

          {!disabled && (
            <Flex gap={0}>
              <Button
                size="small"
                icon={<PlusOutlined />}
                loading={isAdding && !isMoreOptionsOpen}
                onClick={handleQuickAdd}
                style={{ borderStartEndRadius: 0, borderEndEndRadius: 0 }}
              >
                {t('softwareSettings.addSprint', { defaultValue: 'Add sprint' })}
              </Button>
              <Popover
                trigger="click"
                placement="bottomRight"
                open={isMoreOptionsOpen}
                onOpenChange={openMoreOptions}
                content={moreOptionsContent}
              >
                <Button
                  size="small"
                  style={{ borderStartStartRadius: 0, borderEndStartRadius: 0, marginInlineStart: -1 }}
                >
                  {t('softwareSettings.moreOptions', { defaultValue: 'More options' })}
                  <DownOutlined style={{ fontSize: 10 }} />
                </Button>
              </Popover>
            </Flex>
          )}
        </Flex>

        <Spin spinning={loadingPhases && phaseList.length === 0}>
          {visibleSprints.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              style={{ padding: '24px 0' }}
              description={
                view === 'active'
                  ? t('softwareSettings.noActiveSprints', {
                      defaultValue: 'No upcoming sprints. Add one to start planning.',
                    })
                  : t('softwareSettings.noCompletedSprints', {
                      defaultValue: 'No completed sprints yet.',
                    })
              }
            />
          ) : (
            visibleSprints.map((sprint, index) => (
              <Flex
                key={sprint.id}
                align="center"
                gap={16}
                style={{
                  padding: '12px 16px',
                  borderTop: index === 0 ? 'none' : `1px solid ${token.colorBorderSecondary}`,
                }}
              >
                <div style={{ width: 84, flexShrink: 0 }}>
                  <SprintStateTag sprint={sprint} />
                </div>

                <div className="min-w-0 flex-1">
                  <Typography.Text strong ellipsis style={{ display: 'block', fontSize: 14 }}>
                    {sprint.name}
                  </Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    <SprintTimeline sprint={sprint} />
                    {' · '}
                    {t('softwareSettings.sprintItemCount', {
                      defaultValue: '{{count}} items',
                      count: Number(sprint.usage ?? 0),
                    })}
                  </Typography.Text>
                </div>

                {!disabled && (
                  <Flex gap={4} className="shrink-0">
                    <Tooltip title={t('softwareSettings.deleteSprint', { defaultValue: 'Delete sprint' })}>
                      <Button
                        type="text"
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => handleDelete(sprint)}
                        aria-label={t('softwareSettings.deleteSprintNamed', {
                          defaultValue: 'Delete {{name}}',
                          name: sprint.name,
                        })}
                      />
                    </Tooltip>
                    <Dropdown menu={getSprintMenu(sprint)} trigger={['click']} placement="bottomRight">
                      <Button
                        type="text"
                        size="small"
                        icon={<MoreOutlined />}
                        aria-label={t('softwareSettings.sprintActions', {
                          defaultValue: 'Actions for {{name}}',
                          name: sprint.name,
                        })}
                      />
                    </Dropdown>
                  </Flex>
                )}
              </Flex>
            ))
          )}
        </Spin>
      </div>

      <SettingsCard
        title={t('softwareSettings.autoScheduleTitle', {
          defaultValue: 'Start and complete sprints automatically',
        })}
        description={t('softwareSettings.autoScheduleHint', {
          defaultValue:
            'Planned sprints start on their start date and the current sprint completes after its end date. Unfinished work moves to the next planned sprint, or the Backlog if there is none. Sprints without dates are not affected.',
        })}
        extra={
          <Switch
            size="small"
            checked={project?.auto_start_complete_sprints === true}
            loading={savingSetting === 'auto_start_complete_sprints'}
            disabled={disabled}
            onChange={checked => handleSettingChange('auto_start_complete_sprints', checked)}
          />
        }
      >
        {null}
      </SettingsCard>

      <SettingsCard
        title={t('softwareSettings.autoArchiveTitle', {
          defaultValue: 'Auto-archive done issues when a sprint completes',
        })}
        description={t('softwareSettings.autoArchiveHint', {
          defaultValue:
            'Done issues in the completed sprint are archived automatically. Unfinished issues move to the destination you choose.',
        })}
        extra={
          <Switch
            size="small"
            checked={project?.auto_archive_on_sprint_complete !== false}
            loading={savingSetting === 'auto_archive_on_sprint_complete'}
            disabled={disabled}
            onChange={checked => handleSettingChange('auto_archive_on_sprint_complete', checked)}
          />
        }
      >
        {null}
      </SettingsCard>

      {editingSprint && (
        <SprintFormModal
          open
          mode="edit"
          sprint={editingSprint}
          projectId={projectId}
          issueCount={Number(editingSprint.usage ?? 0)}
          unassignedCount={0}
          onClose={() => setEditingSprint(null)}
        />
      )}
    </Flex>
  );
};

const SprintStateTag = ({ sprint }: { sprint: ITaskPhase }) => {
  const { t } = useTranslation('project-drawer');
  if (sprint.sprint_status === 'active') {
    return (
      <Tag color="processing" bordered={false} style={{ marginInlineEnd: 0 }}>
        {t('softwareSettings.sprintCurrent', { defaultValue: 'Current' })}
      </Tag>
    );
  }
  if (sprint.sprint_status === 'completed') {
    return (
      <Tag color="success" bordered={false} style={{ marginInlineEnd: 0 }}>
        {t('softwareSettings.sprintCompleted', { defaultValue: 'Completed' })}
      </Tag>
    );
  }
  return (
    <Tag bordered={false} style={{ marginInlineEnd: 0 }}>
      {t('softwareSettings.sprintPlanned', { defaultValue: 'Planned' })}
    </Tag>
  );
};

const SprintTimeline = ({ sprint }: { sprint: ITaskPhase }) => {
  const { t } = useTranslation('project-drawer');
  if (!sprint.start_date || !sprint.end_date) {
    return <>{t('softwareSettings.sprintNoDates', { defaultValue: 'No dates' })}</>;
  }
  const start = dayjs(sprint.start_date);
  const end = dayjs(sprint.end_date);
  const lengthDays = end.startOf('day').diff(start.startOf('day'), 'day') + 1;
  const duration =
    lengthDays % 7 === 0
      ? t('softwareSettings.sprintWeeks', { defaultValue: '{{count}} weeks', count: lengthDays / 7 })
      : t('softwareSettings.sprintDays', { defaultValue: '{{count}} days', count: lengthDays });
  const dateFormat = start.year() === end.year() && start.year() === dayjs().year() ? 'MMM D' : 'MMM D, YYYY';

  return (
    <>
      <strong>{duration}</strong> {start.format(dateFormat)} – {end.format(dateFormat)}
    </>
  );
};

const compareByStartDate = (a: ITaskPhase, b: ITaskPhase): number => {
  if (a.start_date && b.start_date) return dayjs(a.start_date).valueOf() - dayjs(b.start_date).valueOf();
  if (a.start_date) return -1;
  if (b.start_date) return 1;
  return (a.sort_index ?? 0) - (b.sort_index ?? 0);
};

/** Next sprint starts the day after the latest sprint ends and keeps its length (2 weeks by default). */
const getNextSprintDefaults = (sprints: ITaskPhase[]): { start: Dayjs; lengthDays: number } => {
  const dated = sprints
    .filter(sprint => sprint.start_date && sprint.end_date)
    .sort((a, b) => dayjs(a.end_date).valueOf() - dayjs(b.end_date).valueOf());
  const latest = dated[dated.length - 1];
  if (!latest) return { start: dayjs().startOf('day'), lengthDays: DEFAULT_SPRINT_LENGTH_DAYS };

  const latestEnd = dayjs(latest.end_date).startOf('day');
  const lengthDays = latestEnd.diff(dayjs(latest.start_date).startOf('day'), 'day') + 1;
  return {
    start: latestEnd.add(1, 'day'),
    lengthDays: lengthDays > 0 ? lengthDays : DEFAULT_SPRINT_LENGTH_DAYS,
  };
};

const getNextSprintName = (sprints: ITaskPhase[], prefix: string): string => {
  const highestNumber = sprints.reduce((highest, sprint) => {
    const match = sprint.name.match(/(\d+)\s*$/);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);
  return `${prefix} ${Math.max(highestNumber, sprints.length) + 1}`;
};

const DEFAULT_SPRINT_LENGTH_DAYS = 14;

type SprintView = 'active' | 'completed';
type DurationUnit = 'weeks' | 'days';

export default SoftwareSprintsSection;
