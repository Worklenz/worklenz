import React from 'react';
import { Flex, Typography, Button, Tag, Tooltip } from '@/shared/antd-imports';
import { RightOutlined, DownOutlined, PlusOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { theme } from 'antd';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { IMyTaskWithLogs, IMyTaskTimeLog, taskTimeLogsApiService } from '@/api/tasks/task-time-logs.api.service';
import { TimeEntriesEntryRow } from './TimeEntriesEntryRow';
import TimeLogForm from '@/components/task-drawer/shared/time-log/time-log-form';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { setShowTaskDrawer, setSelectedTaskId, fetchTask } from '@/features/task-drawer/task-drawer.slice';
import { setProjectId } from '@/features/project/project.slice';
import { fetchPhasesByProjectId } from '@/features/projects/singleProject/phase/phases.slice';

const { Text } = Typography;

const formatSeconds = (seconds: number): string => {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

interface TimeEntriesTaskRowProps {
  task: IMyTaskWithLogs;
  onEntryChange: () => void;
}

export const TimeEntriesTaskRow: React.FC<TimeEntriesTaskRowProps> = ({ task, onEntryChange }) => {
  const { t } = useTranslation('time-entries');
  const { token } = theme.useToken();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [expanded, setExpanded] = React.useState(false);
  const [hovered, setHovered] = React.useState(false);
  const [addingEntry, setAddingEntry] = React.useState(false);
  const [entries, setEntries] = React.useState<IMyTaskTimeLog[]>(task.time_logs);
  const [total, setTotal] = React.useState(task.total_time_spent);

  const openTaskDrawer = (e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch(setProjectId(task.project_id));
    dispatch(fetchPhasesByProjectId(task.project_id));
    dispatch(setSelectedTaskId(task.task_id));
    dispatch(fetchTask({ taskId: task.task_id, projectId: task.project_id }));
    dispatch(setShowTaskDrawer(true));
  };

  const goToProject = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/worklenz/projects/${task.project_id}`);
  };

  const refreshEntries = async () => {
    try {
      const res = await taskTimeLogsApiService.getByTask(task.task_id);
      if (res.done) {
        const logs: IMyTaskTimeLog[] = (res.body as any[]).map((l: any) => ({
          id: l.id,
          time_spent: l.time_spent,
          description: l.description,
          created_at: l.created_at,
          logged_by_timer: l.logged_by_timer,
        }));
        setEntries(logs);
        setTotal(logs.reduce((acc, l) => acc + (l.time_spent || 0), 0));
        onEntryChange();
      }
    } catch {
      // ignore
    }
  };

  const handleDelete = async (entryId: string) => {
    await taskTimeLogsApiService.delete(entryId, task.task_id);
    refreshEntries();
  };

  const dueDateLabel = task.due_date
    ? dayjs(task.due_date).format('MMM D')
    : t('noDueDate', { defaultValue: 'No due date' });

  const isDueOverdue =
    task.due_date && !task.done && dayjs(task.due_date).isBefore(dayjs(), 'day');

  return (
    <div style={{ borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
      {/* Task row */}
      <Flex
        align="center"
        justify="space-between"
        style={{
          padding: '10px 16px',
          cursor: 'pointer',
          background: hovered || expanded ? token.colorFillQuaternary : 'transparent',
          transition: 'background 0.15s ease',
        }}
        onClick={() => setExpanded(e => !e)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <Flex align="center" gap={8} style={{ flex: 1, minWidth: 0 }}>
          <Button
            type="text"
            size="small"
            icon={expanded ? <DownOutlined style={{ fontSize: 10 }} /> : <RightOutlined style={{ fontSize: 10 }} />}
            style={{ flexShrink: 0, padding: 0, width: 20, height: 20 }}
            onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
          />
          <Tooltip title={t('openTaskTooltip', { defaultValue: 'Open task details' })}>
            <Text
              strong
              onClick={openTaskDrawer}
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
                minWidth: 0,
                cursor: 'pointer',
                color: token.colorPrimary,
              }}
            >
              {task.task_name}
            </Text>
          </Tooltip>
        </Flex>

        <Flex align="center" gap={16} style={{ flexShrink: 0 }}>
          <Tooltip title={t('goToProjectTooltip', { defaultValue: 'Go to project' })}>
            <Flex
              align="center"
              justify="flex-end"
              gap={6}
              onClick={goToProject}
              style={{ cursor: 'pointer', width: 140 }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: task.project_color || token.colorPrimary,
                  flexShrink: 0,
                }}
              />
              <Text style={{ fontSize: 12, maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: token.colorTextSecondary }}>
                {task.project_name}
              </Text>
              <ArrowRightOutlined style={{ fontSize: 10, color: token.colorTextTertiary, flexShrink: 0 }} />
            </Flex>
          </Tooltip>

          <Flex justify="center" style={{ minWidth: 60 }}>
            <Tag
              color={isDueOverdue ? 'red' : undefined}
              style={{ fontSize: 11, margin: 0 }}
            >
              {dueDateLabel}
            </Tag>
          </Flex>

          <Text
            style={{
              fontSize: 13,
              fontFamily: 'monospace',
              minWidth: 60,
              textAlign: 'right',
              fontWeight: total > 0 ? 600 : 400,
              color: total > 0 ? token.colorText : token.colorTextTertiary,
            }}
          >
            {formatSeconds(total)}
          </Text>
        </Flex>
      </Flex>

      {/* Expanded entries */}
      {expanded && (
        <>
          {entries.map(entry => (
            <TimeEntriesEntryRow
              key={entry.id}
              entry={entry}
              taskId={task.task_id}
              projectId={task.project_id}
              onDelete={handleDelete}
              onUpdate={refreshEntries}
            />
          ))}

          {addingEntry ? (
            <div
              style={{
                padding: '8px 16px 8px 48px',
                borderTop: `1px solid ${token.colorBorderSecondary}`,
                background: token.colorFillQuaternary,
              }}
            >
              <TimeLogForm
                mode="create"
                taskId={task.task_id}
                projectId={task.project_id}
                onCancel={() => setAddingEntry(false)}
                onSubmitSuccess={() => {
                  setAddingEntry(false);
                  refreshEntries();
                }}
              />
            </div>
          ) : (
            <Flex
              align="center"
              gap={6}
              style={{
                padding: '6px 16px 6px 48px',
                cursor: 'pointer',
                color: token.colorTextSecondary,
                borderTop: `1px solid ${token.colorBorderSecondary}`,
              }}
              onClick={e => { e.stopPropagation(); setAddingEntry(true); }}
            >
              <PlusOutlined style={{ fontSize: 11 }} />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t('addEntry', { defaultValue: 'Add entry' })}
              </Text>
            </Flex>
          )}
        </>
      )}
    </div>
  );
};
