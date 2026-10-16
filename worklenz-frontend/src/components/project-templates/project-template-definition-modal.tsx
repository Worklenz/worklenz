import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Form,
  Input,
  Button,
  Flex,
  Typography,
  Collapse,
  Select,
  Space,
  Spin,
  Empty,
  theme,
  message,
  InputNumber,
} from '@/shared/antd-imports';
import {
  PlusOutlined,
  DeleteOutlined,
  FolderOutlined,
  FlagOutlined,
  TagsOutlined,
  CheckSquareOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

import { projectTemplatesApiService } from '@/api/project-templates/project-templates.api.service';
import { statusApiService } from '@/api/taskAttributes/status/status.api.service';
import { priorityApiService } from '@/api/taskAttributes/priority/priority.api.service';
import { ITaskStatusCategory } from '@/types/status.types';
import { ITaskPrioritiesGetResponse } from '@/types/tasks/taskPriority.types';
import { IProjectTemplate } from '@/types/project-templates/project-templates.types';
import { decodeHtmlEntities } from '@/utils/html-entities';
import { allocateCopyName } from '@/utils/template-copy-name';
import logger from '@/utils/errorLogger';

import {
  ProjectTemplateDefinitionMode,
  ProjectTemplateDefinitionState,
  EditablePhase,
  EditableStatus,
  EditableLabel,
  EditableTask,
  createEmptyDefinitionState,
  createEmptyPhase,
  createEmptyStatus,
  createEmptyLabel,
  createEmptyTask,
  templateDetailToDefinitionState,
  definitionStateToPayload,
} from './project-template-definition-adapters';

const { Text } = Typography;

export interface ProjectTemplateDefinitionModalProps {
  visible: boolean;
  mode: ProjectTemplateDefinitionMode;
  /** Custom template id when mode === 'edit' */
  customTemplateId?: string | null;
  /** Built-in (worklenz) template id when mode === 'copy-from-builtin' */
  worklenzTemplateId?: string | null;
  /** Display / seed name before detail loads */
  seedName?: string;
  /** Existing custom template names (for default "Copy of" naming) */
  existingCustomNames?: string[];
  onClose: (saved: boolean) => void;
}

export const ProjectTemplateDefinitionModal: React.FC<ProjectTemplateDefinitionModalProps> = ({
  visible,
  mode,
  customTemplateId = null,
  worklenzTemplateId = null,
  seedName = '',
  existingCustomNames = [],
  onClose,
}) => {
  const { t } = useTranslation('projects/templates');
  const { token } = theme.useToken();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState<ProjectTemplateDefinitionState>(createEmptyDefinitionState());
  const [categories, setCategories] = useState<ITaskStatusCategory[]>([]);
  const [priorities, setPriorities] = useState<ITaskPrioritiesGetResponse[]>([]);
  const [nameError, setNameError] = useState('');

  const isCopyMode = mode === 'copy-from-builtin';

  const loadDefinition = useCallback(async () => {
    setLoading(true);
    setNameError('');
    try {
      const [catRes, priRes] = await Promise.all([
        statusApiService.getStatusCategories(),
        priorityApiService.getPriorities(),
      ]);
      const loadedCategories = catRes.done ? catRes.body || [] : [];
      const loadedPriorities = priRes.done ? priRes.body || [] : [];
      setCategories(loadedCategories);
      setPriorities(loadedPriorities);
      const fallbackCategoryId = loadedCategories[0]?.id || '';

      const withStatusCategories = (
        next: ProjectTemplateDefinitionState
      ): ProjectTemplateDefinitionState => ({
        ...next,
        statuses: next.statuses.map(status => ({
          ...status,
          category_id: status.category_id || fallbackCategoryId,
        })),
      });

      if (mode === 'edit' && customTemplateId) {
        const res = await projectTemplatesApiService.getCustomTemplateById(customTemplateId);
        if (res.done && res.body) {
          setState(
            withStatusCategories(
              templateDetailToDefinitionState(
                res.body as IProjectTemplate,
                decodeHtmlEntities(res.body.name || seedName)
              )
            )
          );
        } else {
          message.error(
            t('definitionLoadError', { defaultValue: 'Failed to load template for editing.' })
          );
          onClose(false);
        }
        return;
      }

      if (mode === 'copy-from-builtin' && worklenzTemplateId) {
        const res = await projectTemplatesApiService.getByTemplateId(worklenzTemplateId);
        if (res.done && res.body) {
          const sourceName = decodeHtmlEntities(res.body.name || seedName || 'Template');
          const preferred = allocateCopyName(sourceName, existingCustomNames);
          setState(withStatusCategories(templateDetailToDefinitionState(res.body, preferred)));
        } else {
          message.error(
            t('definitionLoadError', { defaultValue: 'Failed to load template for editing.' })
          );
          onClose(false);
        }
        return;
      }

      setState(createEmptyDefinitionState(decodeHtmlEntities(seedName)));
    } catch (error) {
      logger.error('Failed to load template definition:', error);
      message.error(
        t('definitionLoadError', { defaultValue: 'Failed to load template for editing.' })
      );
      onClose(false);
    } finally {
      setLoading(false);
    }
  }, [
    mode,
    customTemplateId,
    worklenzTemplateId,
    seedName,
    existingCustomNames,
    onClose,
    t,
  ]);

  useEffect(() => {
    if (!visible) {
      setState(createEmptyDefinitionState());
      setNameError('');
      setSaving(false);
      return;
    }
    loadDefinition();
  }, [visible, loadDefinition]);

  const defaultCategoryId = categories[0]?.id || '';
  const defaultPriorityName = priorities[0]?.name || '';
  const defaultStatusName = state.statuses[0]?.name || '';
  const defaultPhaseName = state.phases[0]?.name || '';

  const statusOptions = useMemo(
    () =>
      state.statuses
        .filter(s => s.name.trim())
        .map(s => ({ value: s.name.trim(), label: s.name.trim() })),
    [state.statuses]
  );

  const phaseOptions = useMemo(
    () =>
      state.phases
        .filter(p => p.name.trim())
        .map(p => ({ value: p.name.trim(), label: p.name.trim() })),
    [state.phases]
  );

  const priorityOptions = useMemo(
    () =>
      priorities
        .filter(p => p.name)
        .map(p => ({ value: p.name as string, label: p.name as string })),
    [priorities]
  );

  const categoryOptions = useMemo(
    () =>
      categories
        .filter(c => c.id && c.name)
        .map(c => ({ value: c.id as string, label: c.name as string })),
    [categories]
  );

  const parentTaskOptions = useMemo(
    () =>
      state.tasks
        .filter(task => task.name.trim())
        .map(task => ({ value: task.key, label: task.name.trim() })),
    [state.tasks]
  );

  const handleClose = () => {
    if (saving) return;
    onClose(false);
  };

  const handleSave = async () => {
    const trimmedName = state.name.trim();
    if (!trimmedName) {
      setNameError(
        t('definitionNameRequired', { defaultValue: 'Template name is required.' })
      );
      return;
    }

    const statusesMissingCategory = state.statuses.filter(
      status => status.name.trim() && !status.category_id
    );
    if (statusesMissingCategory.length > 0) {
      message.error(
        t('definitionStatusCategoryRequired', {
          defaultValue: 'Each status needs a category before saving.',
        })
      );
      return;
    }

    setNameError('');
    setSaving(true);

    try {
      const payload = definitionStateToPayload(state);

      if (mode === 'edit') {
        if (!customTemplateId) return;
        const res = await projectTemplatesApiService.updateCustomTemplateDefinition(
          customTemplateId,
          payload
        );
        if (res.done) {
          message.success(
            t('definitionUpdateSuccess', { defaultValue: 'Template updated successfully.' })
          );
          onClose(true);
        } else {
          message.error(
            res.message ||
              t('definitionUpdateError', { defaultValue: 'Failed to update template.' })
          );
        }
        return;
      }

      if (!worklenzTemplateId) return;
      const res = await projectTemplatesApiService.createCustomFromWorklenzTemplate({
        worklenz_template_id: worklenzTemplateId,
        templateName: payload.name,
        ...payload,
      });
      if (res.done) {
        message.success(
          t('definitionCopySuccess', {
            defaultValue: 'Template saved as a copy in Project Templates.',
          })
        );
        onClose(true);
      } else {
        message.error(
          res.message ||
            t('definitionCopyError', { defaultValue: 'Failed to save template copy.' })
        );
      }
    } catch (error) {
      logger.error('Failed to save template definition:', error);
      message.error(
        isCopyMode
          ? t('definitionCopyError', { defaultValue: 'Failed to save template copy.' })
          : t('definitionUpdateError', { defaultValue: 'Failed to update template.' })
      );
    } finally {
      setSaving(false);
    }
  };

  const updatePhase = (key: string, patch: Partial<EditablePhase>) => {
    setState(prev => {
      const current = prev.phases.find(item => item.key === key);
      const phases = prev.phases.map(item =>
        item.key === key ? { ...item, ...patch } : item
      );
      const tasks =
        patch.name !== undefined && current && patch.name !== current.name
          ? prev.tasks.map(task =>
              task.phase_name === current.name
                ? { ...task, phase_name: patch.name || '' }
                : task
            )
          : prev.tasks;
      return { ...prev, phases, tasks };
    });
  };

  const updateStatus = (key: string, patch: Partial<EditableStatus>) => {
    setState(prev => {
      const current = prev.statuses.find(item => item.key === key);
      const statuses = prev.statuses.map(item =>
        item.key === key ? { ...item, ...patch } : item
      );
      const tasks =
        patch.name !== undefined && current && patch.name !== current.name
          ? prev.tasks.map(task =>
              task.status_name === current.name
                ? { ...task, status_name: patch.name || '' }
                : task
            )
          : prev.tasks;
      return { ...prev, statuses, tasks };
    });
  };

  const updateLabel = (key: string, patch: Partial<EditableLabel>) => {
    setState(prev => ({
      ...prev,
      labels: prev.labels.map(item => (item.key === key ? { ...item, ...patch } : item)),
    }));
  };

  const updateTask = (key: string, patch: Partial<EditableTask>) => {
    setState(prev => ({
      ...prev,
      tasks: prev.tasks.map(item => (item.key === key ? { ...item, ...patch } : item)),
    }));
  };

  const handleRemovePhase = (key: string) => {
    setState(prev => {
      const removed = prev.phases.find(p => p.key === key);
      return {
        ...prev,
        phases: prev.phases.filter(p => p.key !== key),
        tasks: prev.tasks.map(task =>
          removed && task.phase_name === removed.name ? { ...task, phase_name: '' } : task
        ),
      };
    });
  };

  const handleRemoveStatus = (key: string) => {
    setState(prev => {
      const removed = prev.statuses.find(s => s.key === key);
      return {
        ...prev,
        statuses: prev.statuses.filter(s => s.key !== key),
        tasks: prev.tasks.map(task =>
          removed && task.status_name === removed.name ? { ...task, status_name: '' } : task
        ),
      };
    });
  };

  const handleRemoveLabel = (key: string) => {
    setState(prev => ({
      ...prev,
      labels: prev.labels.filter(l => l.key !== key),
    }));
  };

  const handleRemoveTask = (key: string) => {
    setState(prev => ({
      ...prev,
      tasks: prev.tasks
        .filter(task => task.key !== key)
        .map(task => (task.parent_key === key ? { ...task, parent_key: null } : task)),
    }));
  };

  const sectionStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  };

  const rowStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    gap: 8,
    alignItems: 'start',
    padding: 8,
    borderRadius: token.borderRadius,
    background: token.colorFillAlter,
    border: `1px solid ${token.colorBorderSecondary}`,
  };

  const title = isCopyMode
    ? t('copyCustomizeTitle', { defaultValue: 'Copy & Customize Template' })
    : t('editProjectTemplateTitle', { defaultValue: 'Edit Project Template' });

  const saveLabel = isCopyMode
    ? t('saveAsCopy', { defaultValue: 'Save as Copy' })
    : t('saveDefinition', { defaultValue: 'Save' });

  const sourceLabel =
    isCopyMode && seedName
      ? t('copyCustomizeSource', {
          defaultValue: 'Based on built-in template “{{name}}”. Saving creates a new Project Template.',
          name: decodeHtmlEntities(seedName),
        })
      : null;

  return (
    <Modal
      title={<span id="project-template-definition-title">{title}</span>}
      open={visible}
      onCancel={handleClose}
      width={840}
      centered
      destroyOnHidden
      maskClosable={!saving}
      keyboard={!saving}
      aria-labelledby="project-template-definition-title"
      footer={
        <Flex justify="flex-end" gap={8}>
          <Button onClick={handleClose} disabled={saving} aria-label={t('cancelText')}>
            {t('cancelText')}
          </Button>
          <Button
            type="primary"
            loading={saving}
            disabled={loading}
            onClick={handleSave}
            aria-label={saveLabel}
          >
            {saveLabel}
          </Button>
        </Flex>
      }
    >
      {loading ? (
        <Flex justify="center" align="center" style={{ minHeight: 240 }}>
          <Spin />
        </Flex>
      ) : (
        <Form layout="vertical" style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: 4 }}>
          {sourceLabel && (
            <Text
              type="secondary"
              style={{ display: 'block', marginBottom: 16, fontSize: 13 }}
            >
              {sourceLabel}
            </Text>
          )}

          <Form.Item
            label={t('definitionTemplateName', { defaultValue: 'Template Name' })}
            required
            validateStatus={nameError ? 'error' : undefined}
            help={nameError || undefined}
          >
            <Input
              value={state.name}
              maxLength={120}
              onChange={e => {
                setNameError('');
                setState(prev => ({ ...prev, name: e.target.value }));
              }}
              aria-label={t('definitionTemplateName', { defaultValue: 'Template Name' })}
              autoFocus
            />
          </Form.Item>

          <Flex gap={12} wrap>
            <Form.Item
              label={t('definitionPhaseLabel', { defaultValue: 'Phase label' })}
              style={{ flex: 1, minWidth: 160 }}
            >
              <Input
                value={state.phase_label}
                onChange={e => setState(prev => ({ ...prev, phase_label: e.target.value }))}
                aria-label={t('definitionPhaseLabel', { defaultValue: 'Phase label' })}
              />
            </Form.Item>
            <Form.Item
              label={t('definitionColor', { defaultValue: 'Color' })}
              style={{ width: 120 }}
            >
              <Input
                type="color"
                value={state.color_code || '#1890ff'}
                onChange={e => setState(prev => ({ ...prev, color_code: e.target.value }))}
                aria-label={t('definitionColor', { defaultValue: 'Color' })}
              />
            </Form.Item>
          </Flex>

          <Form.Item label={t('definitionNotes', { defaultValue: 'Notes' })}>
            <Input.TextArea
              value={state.notes}
              rows={2}
              onChange={e => setState(prev => ({ ...prev, notes: e.target.value }))}
              aria-label={t('definitionNotes', { defaultValue: 'Notes' })}
            />
          </Form.Item>

          <Collapse
            defaultActiveKey={['phases', 'statuses', 'labels', 'tasks']}
            items={[
              {
                key: 'phases',
                label: (
                  <Space>
                    <FolderOutlined />
                    <span>
                      {t('definitionPhases', { defaultValue: 'Phases' })} ({state.phases.length})
                    </span>
                  </Space>
                ),
                children: (
                  <div style={sectionStyle}>
                    {state.phases.length === 0 && (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={t('definitionNoPhases', {
                          defaultValue: 'No phases yet',
                        })}
                      />
                    )}
                    {state.phases.map(phase => (
                      <div key={phase.key} style={rowStyle}>
                        <Flex gap={8} wrap style={{ minWidth: 0 }}>
                          <Input
                            value={phase.name}
                            placeholder={t('definitionPhaseName', {
                              defaultValue: 'Phase name',
                            })}
                            onChange={e => updatePhase(phase.key, { name: e.target.value })}
                            aria-label={t('definitionPhaseName', { defaultValue: 'Phase name' })}
                            style={{ flex: 1, minWidth: 140 }}
                          />
                          <Input
                            type="color"
                            value={phase.color_code || '#722ed1'}
                            onChange={e => updatePhase(phase.key, { color_code: e.target.value })}
                            aria-label={t('definitionColor', { defaultValue: 'Color' })}
                            style={{ width: 48 }}
                          />
                        </Flex>
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => handleRemovePhase(phase.key)}
                          aria-label={t('definitionRemovePhase', {
                            defaultValue: 'Remove phase',
                          })}
                        />
                      </div>
                    ))}
                    <Button
                      type="dashed"
                      icon={<PlusOutlined />}
                      onClick={() =>
                        setState(prev => ({
                          ...prev,
                          phases: [...prev.phases, createEmptyPhase()],
                        }))
                      }
                      aria-label={t('definitionAddPhase', { defaultValue: 'Add phase' })}
                    >
                      {t('definitionAddPhase', { defaultValue: 'Add phase' })}
                    </Button>
                  </div>
                ),
              },
              {
                key: 'statuses',
                label: (
                  <Space>
                    <FlagOutlined />
                    <span>
                      {t('definitionStatuses', { defaultValue: 'Statuses' })} (
                      {state.statuses.length})
                    </span>
                  </Space>
                ),
                children: (
                  <div style={sectionStyle}>
                    {state.statuses.length === 0 && (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={t('definitionNoStatuses', {
                          defaultValue: 'No statuses yet',
                        })}
                      />
                    )}
                    {state.statuses.map(status => (
                      <div key={status.key} style={rowStyle}>
                        <Flex gap={8} wrap style={{ minWidth: 0 }}>
                          <Input
                            value={status.name}
                            placeholder={t('definitionStatusName', {
                              defaultValue: 'Status name',
                            })}
                            onChange={e => updateStatus(status.key, { name: e.target.value })}
                            aria-label={t('definitionStatusName', {
                              defaultValue: 'Status name',
                            })}
                            style={{ flex: 1, minWidth: 140 }}
                          />
                          <Select
                            value={status.category_id || undefined}
                            options={categoryOptions}
                            placeholder={t('definitionStatusCategory', {
                              defaultValue: 'Category',
                            })}
                            onChange={value =>
                              updateStatus(status.key, { category_id: value })
                            }
                            aria-label={t('definitionStatusCategory', {
                              defaultValue: 'Category',
                            })}
                            style={{ minWidth: 140 }}
                          />
                        </Flex>
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => handleRemoveStatus(status.key)}
                          aria-label={t('definitionRemoveStatus', {
                            defaultValue: 'Remove status',
                          })}
                        />
                      </div>
                    ))}
                    <Button
                      type="dashed"
                      icon={<PlusOutlined />}
                      onClick={() =>
                        setState(prev => ({
                          ...prev,
                          statuses: [
                            ...prev.statuses,
                            {
                              ...createEmptyStatus(defaultCategoryId),
                              sort_order: prev.statuses.length,
                            },
                          ],
                        }))
                      }
                      aria-label={t('definitionAddStatus', { defaultValue: 'Add status' })}
                    >
                      {t('definitionAddStatus', { defaultValue: 'Add status' })}
                    </Button>
                  </div>
                ),
              },
              {
                key: 'labels',
                label: (
                  <Space>
                    <TagsOutlined />
                    <span>
                      {t('definitionLabels', { defaultValue: 'Labels' })} ({state.labels.length})
                    </span>
                  </Space>
                ),
                children: (
                  <div style={sectionStyle}>
                    {state.labels.length === 0 && (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={t('definitionNoLabels', {
                          defaultValue: 'No labels yet',
                        })}
                      />
                    )}
                    {state.labels.map(label => (
                      <div key={label.key} style={rowStyle}>
                        <Flex gap={8} wrap style={{ minWidth: 0 }}>
                          <Input
                            value={label.name}
                            placeholder={t('definitionLabelName', {
                              defaultValue: 'Label name',
                            })}
                            onChange={e => updateLabel(label.key, { name: e.target.value })}
                            aria-label={t('definitionLabelName', {
                              defaultValue: 'Label name',
                            })}
                            style={{ flex: 1, minWidth: 140 }}
                          />
                          <Input
                            type="color"
                            value={label.color_code || '#13c2c2'}
                            onChange={e => updateLabel(label.key, { color_code: e.target.value })}
                            aria-label={t('definitionColor', { defaultValue: 'Color' })}
                            style={{ width: 48 }}
                          />
                        </Flex>
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => handleRemoveLabel(label.key)}
                          aria-label={t('definitionRemoveLabel', {
                            defaultValue: 'Remove label',
                          })}
                        />
                      </div>
                    ))}
                    <Button
                      type="dashed"
                      icon={<PlusOutlined />}
                      onClick={() =>
                        setState(prev => ({
                          ...prev,
                          labels: [...prev.labels, createEmptyLabel()],
                        }))
                      }
                      aria-label={t('definitionAddLabel', { defaultValue: 'Add label' })}
                    >
                      {t('definitionAddLabel', { defaultValue: 'Add label' })}
                    </Button>
                  </div>
                ),
              },
              {
                key: 'tasks',
                label: (
                  <Space>
                    <CheckSquareOutlined />
                    <span>
                      {t('definitionTasks', { defaultValue: 'Tasks' })} ({state.tasks.length})
                    </span>
                  </Space>
                ),
                children: (
                  <div style={sectionStyle}>
                    {state.tasks.length === 0 && (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={t('definitionNoTasks', {
                          defaultValue: 'No tasks yet',
                        })}
                      />
                    )}
                    {state.tasks.map(task => (
                      <div key={task.key} style={{ ...rowStyle, gridTemplateColumns: '1fr auto' }}>
                        <Flex vertical gap={8} style={{ minWidth: 0 }}>
                          <Input
                            value={task.name}
                            placeholder={t('definitionTaskName', {
                              defaultValue: 'Task name',
                            })}
                            onChange={e => updateTask(task.key, { name: e.target.value })}
                            aria-label={t('definitionTaskName', { defaultValue: 'Task name' })}
                          />
                          <Flex gap={8} wrap>
                            <Select
                              allowClear
                              value={task.status_name || undefined}
                              options={statusOptions}
                              placeholder={t('definitionTaskStatus', {
                                defaultValue: 'Status',
                              })}
                              onChange={value =>
                                updateTask(task.key, { status_name: value || '' })
                              }
                              style={{ minWidth: 120, flex: 1 }}
                              aria-label={t('definitionTaskStatus', {
                                defaultValue: 'Status',
                              })}
                            />
                            <Select
                              allowClear
                              value={task.priority_name || undefined}
                              options={priorityOptions}
                              placeholder={t('definitionTaskPriority', {
                                defaultValue: 'Priority',
                              })}
                              onChange={value =>
                                updateTask(task.key, { priority_name: value || '' })
                              }
                              style={{ minWidth: 120, flex: 1 }}
                              aria-label={t('definitionTaskPriority', {
                                defaultValue: 'Priority',
                              })}
                            />
                            <Select
                              allowClear
                              value={task.phase_name || undefined}
                              options={phaseOptions}
                              placeholder={t('definitionTaskPhase', {
                                defaultValue: 'Phase',
                              })}
                              onChange={value =>
                                updateTask(task.key, { phase_name: value || '' })
                              }
                              style={{ minWidth: 120, flex: 1 }}
                              aria-label={t('definitionTaskPhase', {
                                defaultValue: 'Phase',
                              })}
                            />
                            <Select
                              allowClear
                              value={task.parent_key || undefined}
                              options={parentTaskOptions.filter(opt => opt.value !== task.key)}
                              placeholder={t('definitionTaskParent', {
                                defaultValue: 'Parent task',
                              })}
                              onChange={value =>
                                updateTask(task.key, { parent_key: value || null })
                              }
                              style={{ minWidth: 140, flex: 1 }}
                              aria-label={t('definitionTaskParent', {
                                defaultValue: 'Parent task',
                              })}
                            />
                            <InputNumber
                              min={0}
                              value={task.total_minutes}
                              onChange={value =>
                                updateTask(task.key, {
                                  total_minutes: typeof value === 'number' ? value : 0,
                                })
                              }
                              addonAfter={t('definitionMinutes', { defaultValue: 'min' })}
                              aria-label={t('definitionTaskEstimate', {
                                defaultValue: 'Estimate (minutes)',
                              })}
                              style={{ width: 140 }}
                            />
                          </Flex>
                        </Flex>
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => handleRemoveTask(task.key)}
                          aria-label={t('definitionRemoveTask', {
                            defaultValue: 'Remove task',
                          })}
                        />
                      </div>
                    ))}
                    <Button
                      type="dashed"
                      icon={<PlusOutlined />}
                      onClick={() =>
                        setState(prev => ({
                          ...prev,
                          tasks: [
                            ...prev.tasks,
                            createEmptyTask({
                              status_name: defaultStatusName,
                              priority_name: defaultPriorityName,
                              phase_name: defaultPhaseName,
                            }),
                          ],
                        }))
                      }
                      aria-label={t('definitionAddTask', { defaultValue: 'Add task' })}
                    >
                      {t('definitionAddTask', { defaultValue: 'Add task' })}
                    </Button>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {t('definitionTasksHint', {
                        defaultValue:
                          'Add, edit, or remove tasks before saving. Subtasks can link to a parent task.',
                      })}
                    </Text>
                  </div>
                ),
              },
            ]}
          />
        </Form>
      )}
    </Modal>
  );
};
