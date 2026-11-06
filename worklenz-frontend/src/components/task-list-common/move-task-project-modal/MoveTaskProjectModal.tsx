import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Modal,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  Typography,
  message,
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { projectsApiService } from '@/api/projects/projects.api.service';
import { statusApiService } from '@/api/taskAttributes/status/status.api.service';
import { phasesApiService } from '@/api/taskAttributes/phases/phases.api.service';
import { tasksCustomColumnsService } from '@/api/tasks/tasks-custom-columns.service';
import {
  IMoveTasksToProjectResponse,
  tasksApiService,
} from '@/api/tasks/tasks.api.service';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { ITaskStatus } from '@/types/tasks/taskStatus.types';
import { ITaskPhase } from '@/types/tasks/taskPhase.types';
import { ITaskListColumn } from '@/types/tasks/taskList.types';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import {
  evt_project_task_move_project_confirmed,
  evt_project_task_move_project_failed,
  evt_project_task_move_project_opened,
} from '@/shared/worklenz-analytics-events';

interface ProjectOption {
  label: string;
  value: string;
}

interface MoveTaskProjectModalProps {
  open: boolean;
  sourceProjectId: string;
  taskIds: string[];
  selectedTasks: IProjectTask[];
  onCancel: () => void;
  onMoved: (response: IMoveTasksToProjectResponse) => void;
}

interface MoveModalTaskLike extends IProjectTask {
  phase?: string;
}

export const MoveTaskProjectModal = ({
  open,
  sourceProjectId,
  taskIds,
  selectedTasks,
  onCancel,
  onMoved,
}: MoveTaskProjectModalProps) => {
  const { t } = useTranslation('task-list-table');
  const { trackMixpanelEvent } = useMixpanelTracking();

  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingMappings, setLoadingMappings] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasMetadataError, setHasMetadataError] = useState(false);

  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [destinationProjectId, setDestinationProjectId] = useState<string>('');

  const [sourceStatuses, setSourceStatuses] = useState<ITaskStatus[]>([]);
  const [destinationStatuses, setDestinationStatuses] = useState<ITaskStatus[]>([]);

  const [sourcePhases, setSourcePhases] = useState<ITaskPhase[]>([]);
  const [destinationPhases, setDestinationPhases] = useState<ITaskPhase[]>([]);

  const [sourceColumns, setSourceColumns] = useState<ITaskListColumn[]>([]);
  const [destinationColumns, setDestinationColumns] = useState<ITaskListColumn[]>([]);

  const [statusMapping, setStatusMapping] = useState<Record<string, string>>({});
  const [phaseMapping, setPhaseMapping] = useState<Record<string, string>>({});
  const [customFieldMapping, setCustomFieldMapping] = useState<Record<string, string>>({});

  const [moveSubtasks, setMoveSubtasks] = useState(true);
  const [keepAssignees, setKeepAssignees] = useState(true);
  const [keepLabels, setKeepLabels] = useState(true);

  const usedStatusIds = useMemo(() => {
    const ids = new Set<string>();
    const collectFromTask = (task: any) => {
      const statusId = task.status_id || task.status;
      if (statusId) ids.add(statusId);
      if (Array.isArray(task.sub_tasks)) {
        task.sub_tasks.forEach(collectFromTask);
      }
    };
    selectedTasks.forEach(collectFromTask);
    return [...ids];
  }, [selectedTasks]);

  const normalizeToken = (value: string) =>
    value.trim().toLowerCase().replace(/\s+/g, '_');

  const toDisplayLabel = (value: string) =>
    value
      .replace(/_/g, ' ')
      .replace(/\b\w/g, char => char.toUpperCase());

  const getColumnType = (col: ITaskListColumn): string => {
    const colAny = col as any;
    const obj = col.custom_column_obj as any;
    const cfg = col.configuration as any;
    return String(colAny.type || obj?.type || obj?.field_type || cfg?.type || cfg?.field_type || '').toLowerCase();
  };

  const resolvedStatusIds = useMemo(() => {
    const ids = new Set<string>();
    usedStatusIds.forEach(rawStatus => {
      const directMatch = sourceStatuses.find(status => status.id === rawStatus);
      if (directMatch?.id) {
        ids.add(directMatch.id);
        return;
      }

      const normalizedRaw = normalizeToken(rawStatus);
      const byName = sourceStatuses.find(
        status => status.name && normalizeToken(status.name) === normalizedRaw
      );
      if (byName?.id) {
        ids.add(byName.id);
        return;
      }

      ids.add(rawStatus);
    });
    return [...ids];
  }, [usedStatusIds, sourceStatuses]);

  const usedPhaseTokens = useMemo(() => {
    const ids = new Set<string>();
    selectedTasks.forEach(task => {
      const taskLike = task as MoveModalTaskLike;
      const phaseToken = task.phase_id || task.phase_name || taskLike.phase;
      if (phaseToken) ids.add(phaseToken);
    });
    return [...ids];
  }, [selectedTasks]);

  const resolvedPhaseIds = useMemo(() => {
    const ids = new Set<string>();
    usedPhaseTokens.forEach(rawPhase => {
      const directMatch = sourcePhases.find(phase => phase.id === rawPhase);
      if (directMatch?.id) {
        ids.add(directMatch.id);
        return;
      }

      const normalizedRaw = normalizeToken(rawPhase);
      const byName = sourcePhases.find(
        phase => phase.name && normalizeToken(phase.name) === normalizedRaw
      );
      if (byName?.id) {
        ids.add(byName.id);
        return;
      }
    });
    return [...ids];
  }, [usedPhaseTokens, sourcePhases]);

  const usedCustomFieldKeys = useMemo(() => {
    const keys = new Set<string>();
    selectedTasks.forEach(task => {
      Object.keys(task.custom_column_values || {}).forEach(key => keys.add(key));
    });
    return [...keys];
  }, [selectedTasks]);

  useEffect(() => {
    if (!open) return;
    trackMixpanelEvent(evt_project_task_move_project_opened);
    setDestinationProjectId('');
    setProjects([]);
    setStatusMapping({});
    setPhaseMapping({});
    setCustomFieldMapping({});
    let isActive = true;

    const loadProjectsAndSourceMetadata = async () => {
      try {
        setLoadingProjects(true);
        setLoadingMappings(true);
        setHasMetadataError(false);

        const [projectsRes, statusesRes, phasesRes, columnsRes] = await Promise.all([
          projectsApiService.getProjects(1, 200, 'name', 'ASC', '', 0, null, null),
          statusApiService.getStatuses(sourceProjectId),
          phasesApiService.getPhasesByProjectId(sourceProjectId),
          tasksCustomColumnsService.getCustomColumns(sourceProjectId),
        ]);

        if (!isActive) return;
        if (!projectsRes.done || !statusesRes.done || !phasesRes.done || !columnsRes.done) throw new Error('metadata unavailable');
        const availableProjects = (projectsRes.body?.data || [])
          .filter(project => project.id && project.id !== sourceProjectId)
          .map(project => ({ label: project.name || '', value: project.id || '' }))
          .filter(project => !!project.value);

        setProjects(availableProjects);
        setSourceStatuses(statusesRes.body || []);
        setSourcePhases(phasesRes.body || []);
        setSourceColumns((columnsRes.body || []).filter(column => !!column.key));
      } catch (_error) {
        if (isActive) {
          setHasMetadataError(true);
          message.error(t('moveTaskProject.loadFailed', { defaultValue: 'Could not load projects and mappings. Please try again.' }));
        }
      } finally {
        if (isActive) { setLoadingProjects(false); setLoadingMappings(false); }
      }
    };

    void loadProjectsAndSourceMetadata();
    return () => { isActive = false; };
  }, [open, sourceProjectId, t, trackMixpanelEvent]);

  useEffect(() => {
    if (!open || !destinationProjectId) {
      setDestinationStatuses([]);
      setDestinationPhases([]);
      setDestinationColumns([]);
      return;
    }

    let isActive = true;
    const loadDestinationMetadata = async () => {
      try {
        setLoadingMappings(true);
        const [statusesRes, phasesRes, columnsRes] = await Promise.all([
          statusApiService.getStatuses(destinationProjectId),
          phasesApiService.getPhasesByProjectId(destinationProjectId),
          tasksCustomColumnsService.getCustomColumns(destinationProjectId),
        ]);

        if (!isActive) return;
        if (!statusesRes.done || !phasesRes.done || !columnsRes.done) throw new Error('metadata unavailable');
        setHasMetadataError(false);
        const nextDestinationStatuses = statusesRes.body || [];
        const nextDestinationPhases = phasesRes.body || [];
        const nextDestinationColumns = (columnsRes.body || []).filter(column => !!column.key);

        setDestinationStatuses(nextDestinationStatuses);
        setDestinationPhases(nextDestinationPhases);
        setDestinationColumns(nextDestinationColumns);

        const statusByName = new Map(
          nextDestinationStatuses.map(status => [status.name?.trim().toLowerCase() || '', status.id || ''])
        );
        const phaseByName = new Map(
          nextDestinationPhases.map(phase => [phase.name?.trim().toLowerCase() || '', phase.id || ''])
        );
        const columnByName = new Map(
          nextDestinationColumns.map(column => [column.name?.trim().toLowerCase() || '', column.key || ''])
        );

        const nextStatusMapping: Record<string, string> = {};
        resolvedStatusIds.forEach(statusId => {
          const source = sourceStatuses.find(status => status.id === statusId);
          if (!source?.name) return;
          const matched = statusByName.get(source.name.trim().toLowerCase());
          if (matched) nextStatusMapping[statusId] = matched;
        });

        const nextPhaseMapping: Record<string, string> = {};
        resolvedPhaseIds.forEach(phaseId => {
          const source = sourcePhases.find(phase => phase.id === phaseId);
          if (!source?.name) return;
          const matched = phaseByName.get(source.name.trim().toLowerCase());
          if (matched) nextPhaseMapping[phaseId] = matched;
        });

        const nextCustomMapping: Record<string, string> = {};
        usedCustomFieldKeys.forEach(key => {
          const source = sourceColumns.find(column => column.key === key);
          if (!source?.name) return;
          const sourceType = getColumnType(source);
          const matched = nextDestinationColumns.find(column => {
            if (!column.name || column.name.trim().toLowerCase() !== source.name?.trim().toLowerCase()) {
              return false;
            }
            if (!sourceType) return true;
            const destType = getColumnType(column);
            return !destType || destType === sourceType;
          });
          if (matched?.key) nextCustomMapping[key] = matched.key;
        });

        setStatusMapping(previous => ({ ...nextStatusMapping, ...previous }));
        setPhaseMapping(previous => ({ ...nextPhaseMapping, ...previous }));
        setCustomFieldMapping(previous => ({ ...nextCustomMapping, ...previous }));
      } catch (_error) {
        if (isActive) {
          setHasMetadataError(true);
          message.error(t('moveTaskProject.loadFailed', { defaultValue: 'Could not load projects and mappings. Please try again.' }));
        }
      } finally {
        if (isActive) setLoadingMappings(false);
      }
    };

    void loadDestinationMetadata();
    return () => { isActive = false; };
  }, [
    open,
    destinationProjectId,
    sourceStatuses,
    sourcePhases,
    sourceColumns,
    resolvedStatusIds,
    resolvedPhaseIds,
    usedCustomFieldKeys,
    t,
  ]);

  const missingStatusMapping = resolvedStatusIds.some(statusId => !statusMapping[statusId]);
  const missingPhaseMapping = resolvedPhaseIds.some(phaseId => !phaseMapping[phaseId]);
  const missingCustomFieldMapping = usedCustomFieldKeys.some(key => !customFieldMapping[key]);

  const canSubmit =
    !!destinationProjectId &&
    !loadingProjects && !loadingMappings && !hasMetadataError &&
    !missingStatusMapping &&
    taskIds.length > 0;

  const handleMove = async () => {
    if (!canSubmit) return;
    try {
      setSaving(true);
      const response = await tasksApiService.moveTasksToProject({
        task_ids: taskIds,
        source_project_id: sourceProjectId,
        destination_project_id: destinationProjectId,
        mapping: {
          status: statusMapping,
          phase: phaseMapping,
          custom_fields: customFieldMapping,
        },
        options: {
          move_subtasks: moveSubtasks,
          keep_assignees_if_member_exists: keepAssignees,
          keep_labels_by_name: keepLabels,
        },
      });

      if (response.done && response.body) {
        trackMixpanelEvent(evt_project_task_move_project_confirmed);
        if (response.body.warnings.length > 0) {
          message.warning(t('moveTaskProject.completedWithWarnings', {
            defaultValue: 'Tasks moved with {{count}} mapping warnings. Review the destination project.',
            count: response.body.warnings.length,
          }));
        } else {
          message.success(t('moveTaskProject.completed', { defaultValue: 'Tasks moved successfully.' }));
        }
        onMoved(response.body);
      } else {
        message.error(t('moveTaskProject.moveFailed', { defaultValue: 'Could not move tasks. Please try again.' }));
      }
    } catch (_error) {
      message.error(t('moveTaskProject.moveFailed', { defaultValue: 'Could not move tasks. Please try again.' }));
      trackMixpanelEvent(evt_project_task_move_project_failed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      title={t('moveTaskProject.title', { defaultValue: 'Move tasks to another project' })}
      width={780}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          {t('moveTaskProject.actions.cancel', { defaultValue: 'Cancel' })}
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={saving}
          disabled={!canSubmit}
          onClick={handleMove}
        >
          {t('moveTaskProject.actions.move', { defaultValue: 'Move tasks' })}
        </Button>,
      ]}
      destroyOnClose
    >
      {(loadingProjects || loadingMappings) && <Spin className="mb-4" />}

      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Typography.Text strong>
            {t('moveTaskProject.selectedTasksTitle', {
              defaultValue: 'Selected tasks',
            })}
          </Typography.Text>
          <div className="mt-2 flex flex-wrap gap-2">
            {selectedTasks.map(task => (
              <Tag key={task.id}>
                <span className="inline-block max-w-[240px] truncate align-bottom">
                  {task.task_key ? `${task.task_key} - ` : ''}
                  {task.name || task.id}
                </span>
              </Tag>
            ))}
          </div>
        </div>

        <div>
          <Typography.Text strong>
            {t('moveTaskProject.destinationLabel', { defaultValue: 'Destination project' })}
          </Typography.Text>
          <Select
            className="mt-1 w-full"
            placeholder={t('moveTaskProject.destinationPlaceholder', {
              defaultValue: 'Select destination project',
            })}
            value={destinationProjectId || undefined}
            options={projects}
            onChange={value => {
              if (value === destinationProjectId) return;
              setLoadingMappings(true);
              setStatusMapping({});
              setPhaseMapping({});
              setCustomFieldMapping({});
              setDestinationProjectId(value);
            }}
            showSearch
            filterOption={(input, option) =>
              (option?.label || '').toString().toLowerCase().includes(input.toLowerCase())
            }
          />
        </div>

        {destinationProjectId && (
          <>
            <Alert
              type="info"
              showIcon
              message={t('moveTaskProject.mappingInfo', {
                defaultValue: 'Map source fields to destination project fields before moving tasks.',
              })}
            />
            {(missingPhaseMapping || missingCustomFieldMapping) && (
              <Alert
                type="warning"
                showIcon
                message={t('moveTaskProject.partialMappingWarning', {
                  defaultValue:
                    'Some phase or custom field mappings are missing. Tasks will still be moved and unmapped values will be skipped.',
                })}
              />
            )}

            <div>
              <Typography.Text strong>
                {t('moveTaskProject.statusMappingTitle', { defaultValue: 'Status mapping' })}
              </Typography.Text>
              <Space direction="vertical" className="w-full mt-2" size={8}>
                {resolvedStatusIds.map(statusId => {
                  const sourceStatus = sourceStatuses.find(status => status.id === statusId);
                  return (
                    <div key={statusId} className="flex items-center gap-2">
                      <Typography.Text className="min-w-[220px]">
                        {sourceStatus?.name || toDisplayLabel(statusId)}
                      </Typography.Text>
                      <Select
                        className="flex-1"
                        value={statusMapping[statusId]}
                        placeholder={t('moveTaskProject.selectStatus', {
                          defaultValue: 'Select destination status',
                        })}
                        options={destinationStatuses
                          .filter(status => !!status.id)
                          .map(status => ({ label: status.name, value: status.id as string }))}
                        onChange={value =>
                          setStatusMapping(prev => ({ ...prev, [statusId]: value }))
                        }
                      />
                    </div>
                  );
                })}
              </Space>
            </div>

            {resolvedPhaseIds.length > 0 && (
              <div>
                <Typography.Text strong>
                  {t('moveTaskProject.phaseMappingTitle', { defaultValue: 'Phase mapping' })}
                </Typography.Text>
                <Space direction="vertical" className="w-full mt-2" size={8}>
                  {resolvedPhaseIds.map(phaseId => {
                    const sourcePhase = sourcePhases.find(phase => phase.id === phaseId);
                    return (
                      <div key={phaseId} className="flex items-center gap-2">
                        <Typography.Text className="min-w-[220px]">
                          {sourcePhase?.name || phaseId}
                        </Typography.Text>
                        <Select
                          className="flex-1"
                          value={phaseMapping[phaseId]}
                          placeholder={t('moveTaskProject.selectPhase', {
                            defaultValue: 'Select destination phase',
                          })}
                          options={destinationPhases
                            .filter(phase => !!phase.id)
                            .map(phase => ({ label: phase.name, value: phase.id as string }))}
                          onChange={value =>
                            setPhaseMapping(prev => ({ ...prev, [phaseId]: value }))
                          }
                        />
                      </div>
                    );
                  })}
                </Space>
              </div>
            )}

            {usedCustomFieldKeys.length > 0 && (
              <div>
                <Typography.Text strong>
                  {t('moveTaskProject.customFieldMappingTitle', {
                    defaultValue: 'Custom field mapping',
                  })}
                </Typography.Text>
                <Space direction="vertical" className="w-full mt-2" size={8}>
                  {usedCustomFieldKeys.map(sourceKey => {
                    const sourceColumn = sourceColumns.find(column => column.key === sourceKey);
                    const sourceType = sourceColumn ? getColumnType(sourceColumn) : '';
                    const compatibleColumns = destinationColumns.filter(column => {
                      if (!column.key) return false;
                      if (!sourceType) return true;
                      const destType = getColumnType(column);
                      return !destType || destType === sourceType;
                    });

                    return (
                      <div key={sourceKey} className="flex items-center gap-2">
                        <Typography.Text className="min-w-[220px]">
                          {sourceColumn?.name || sourceKey}
                        </Typography.Text>
                        <Select
                          className="flex-1"
                          value={customFieldMapping[sourceKey]}
                          placeholder={t('moveTaskProject.selectCustomField', {
                            defaultValue: 'Select destination custom field',
                          })}
                          options={compatibleColumns.map(column => ({
                            label: column.name,
                            value: column.key as string,
                          }))}
                          onChange={value =>
                            setCustomFieldMapping(prev => ({ ...prev, [sourceKey]: value }))
                          }
                        />
                      </div>
                    );
                  })}
                </Space>
              </div>
            )}

            <div className="pt-2">
              <Space direction="vertical" size={8}>
                <div className="flex items-center gap-2">
                  <Switch checked={moveSubtasks} onChange={setMoveSubtasks} />
                  <Typography.Text>
                    {t('moveTaskProject.options.moveSubtasks', {
                      defaultValue: 'Move subtasks together with selected tasks',
                    })}
                  </Typography.Text>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={keepAssignees} onChange={setKeepAssignees} />
                  <Typography.Text>
                    {t('moveTaskProject.options.keepAssignees', {
                      defaultValue:
                        'Keep assignees if they are members in destination project',
                    })}
                  </Typography.Text>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={keepLabels} onChange={setKeepLabels} />
                  <Typography.Text>
                    {t('moveTaskProject.options.keepLabels', {
                      defaultValue: 'Keep labels',
                    })}
                  </Typography.Text>
                </div>
              </Space>
            </div>
          </>
        )}
      </Space>
    </Modal>
  );
};

export default MoveTaskProjectModal;
