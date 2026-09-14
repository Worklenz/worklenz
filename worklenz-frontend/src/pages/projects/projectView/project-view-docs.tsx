import DOMPurify from 'dompurify';
import {
  Button,
  Card,
  Empty,
  Flex,
  Input,
  Popconfirm,
  Select,
  Spin,
  Typography,
  message,
} from '@/shared/antd-imports';
import { DeleteOutlined, FileAddOutlined, PlusOutlined } from '@ant-design/icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import RichTextEditor from '@/components/shared/RichTextEditor';
import projectDocsApiService from '@/api/projects/project-docs.api.service';
import { tasksApiService } from '@/api/tasks/tasks.api.service';
import {
  IProjectDoc,
  IProjectDocPayload,
  IProjectDocTask,
} from '@/types/projects/project-docs.types';
import './project-view-docs.css';

const buildTree = (docs: IProjectDoc[], parentId: string | null): IProjectDoc[] =>
  docs.filter(doc => doc.parent_id === parentId);

const getDescendantIds = (docs: IProjectDoc[], docId: string): Set<string> => {
  const descendants = new Set<string>();
  const visit = (parentId: string) => {
    docs.filter(doc => doc.parent_id === parentId).forEach(child => {
      if (descendants.has(child.id)) return;
      descendants.add(child.id);
      visit(child.id);
    });
  };
  visit(docId);
  return descendants;
};

export default function ProjectViewDocs() {
  const { t } = useTranslation('project-view');
  const projectId = useAppSelector(state => state.projectReducer.projectId);
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const [docs, setDocs] = useState<IProjectDoc[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<IProjectDocPayload>({ title: '', content: '', parent_id: null });
  const [linkedTasks, setLinkedTasks] = useState<IProjectDocTask[]>([]);
  const [taskOptions, setTaskOptions] = useState<IProjectDocTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const selectedDoc = useMemo(() => docs.find(doc => doc.id === selectedId), [docs, selectedId]);
  const parentOptions = useMemo(() => {
    if (!selectedId) return docs;
    const excluded = getDescendantIds(docs, selectedId);
    excluded.add(selectedId);
    return docs.filter(doc => !excluded.has(doc.id));
  }, [docs, selectedId]);

  const loadDocs = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const response = await projectDocsApiService.list(projectId);
      if (!response.done) throw new Error(response.message || 'Failed to load documents');
      setDocs(response.body || []);
      setSelectedId(current => current || response.body?.[0]?.id || null);
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('docsLoadError', { defaultValue: 'Unable to load docs' }));
    } finally {
      setLoading(false);
    }
  }, [projectId, t]);

  useEffect(() => {
    void loadDocs();
  }, [loadDocs]);

  useEffect(() => {
    if (!selectedDoc || !projectId) return;
    setDraft({
      title: selectedDoc.title,
      content: selectedDoc.content,
      parent_id: selectedDoc.parent_id,
    });
    const loadLinks = async () => {
      const response = await projectDocsApiService.get(projectId, selectedDoc.id);
      if (response.done) {
        const currentLinks = response.body?.tasks || [];
        setLinkedTasks(currentLinks);
        setTaskOptions(current => {
          const merged = [...current];
          currentLinks.forEach(task => {
            if (!merged.some(option => option.id === task.id)) merged.push(task);
          });
          return merged;
        });
      }
    };
    void loadLinks();
  }, [projectId, selectedDoc]);

  const searchTasks = async (search: string) => {
    const response = await tasksApiService.searchTasks(1, 20, search);
    if (response.done) {
      const searchedTasks = (response.body?.data || []).filter(task => task.project_id === projectId);
      setTaskOptions(current => {
        const merged = [...searchedTasks];
        linkedTasks.forEach(task => {
          if (!merged.some(option => option.id === task.id)) merged.push(task);
        });
        return merged;
      });
    }
  };

  const createDoc = async (parentId: string | null = null) => {
    if (!projectId) return;
    const response = await projectDocsApiService.create(projectId, {
      title: t('newDoc', { defaultValue: 'Untitled doc' }),
      content: '',
      parent_id: parentId,
    });
    if (!response.done || !response.body) {
      message.error(response.message || t('docsCreateError', { defaultValue: 'Unable to create doc' }));
      return;
    }
    setDocs(current => [...current, response.body]);
    setSelectedId(response.body.id);
  };

  const saveDoc = async () => {
    if (!projectId || !selectedId || !draft.title.trim()) return;
    setSaving(true);
    try {
      const response = await projectDocsApiService.update(projectId, selectedId, draft);
      if (!response.done || !response.body) throw new Error(response.message || 'Unable to save doc');
      setDocs(current => current.map(doc => (doc.id === selectedId ? response.body! : doc)));
      await projectDocsApiService.updateTasks(projectId, selectedId, linkedTasks.map(task => task.id));
      message.success(t('docsSaved', { defaultValue: 'Doc saved' }));
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('docsSaveError', { defaultValue: 'Unable to save doc' }));
    } finally {
      setSaving(false);
    }
  };

  const removeDoc = async () => {
    if (!projectId || !selectedId) return;
    const response = await projectDocsApiService.remove(projectId, selectedId);
    if (!response.done) {
      message.error(response.message || t('docsDeleteError', { defaultValue: 'Unable to delete doc' }));
      return;
    }
    const remaining = docs.filter(doc => doc.id !== selectedId);
    setDocs(remaining);
    setSelectedId(remaining[0]?.id || null);
  };

  const renderTree = (parentId: string | null, depth = 0, visited = new Set<string>()) =>
    buildTree(docs, parentId).filter(doc => !visited.has(doc.id)).map(doc => {
      const nextVisited = new Set(visited);
      nextVisited.add(doc.id);
      return (
      <div key={doc.id}>
        <Button
          type={doc.id === selectedId ? 'primary' : 'text'}
          block
          className="project-doc-tree-item"
          style={{ paddingInlineStart: 12 + depth * 16, justifyContent: 'flex-start' }}
          onClick={() => setSelectedId(doc.id)}
        >
          {doc.title}
        </Button>
        {renderTree(doc.id, depth + 1, nextVisited)}
      </div>
      );
    });

  if (!projectId) return <Empty description={t('docsNoProject', { defaultValue: 'Select a project to view docs' })} />;

  return (
    <Card
      className="project-docs-card"
      title={t('docsTitle', { defaultValue: 'Docs' })}
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={() => void createDoc()}>
          {t('newDoc', { defaultValue: 'New doc' })}
        </Button>
      }
    >
      {loading ? (
        <Flex justify="center" style={{ padding: 48 }}>
          <Spin />
        </Flex>
      ) : (
        <Flex gap={24} align="stretch">
          <div className="project-docs-sidebar">
            {docs.length ? renderTree(null) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />}
            {selectedDoc && (
              <Button
                type="dashed"
                block
                icon={<FileAddOutlined />}
                onClick={() => void createDoc(selectedDoc.id)}
              >
                {t('newChildDoc', { defaultValue: 'New child page' })}
              </Button>
            )}
          </div>
          {selectedDoc ? (
            <Flex vertical gap={16} flex={1}>
              <Flex gap={8} align="center">
                <Input
                  value={draft.title}
                  onChange={event => setDraft(current => ({ ...current, title: event.target.value }))}
                  onPressEnter={() => void saveDoc()}
                  placeholder={t('docTitlePlaceholder', { defaultValue: 'Untitled doc' })}
                  size="large"
                />
                <Button type="primary" loading={saving} onClick={() => void saveDoc()}>
                  {t('saveDoc', { defaultValue: 'Save' })}
                </Button>
                <Popconfirm
                  title={t('deleteDocConfirm', { defaultValue: 'Delete this doc and its child pages?' })}
                  onConfirm={() => void removeDoc()}
                >
                  <Button danger icon={<DeleteOutlined />} aria-label={t('deleteDoc', { defaultValue: 'Delete doc' })} />
                </Popconfirm>
              </Flex>
              <RichTextEditor
                value={draft.content}
                onChange={content => setDraft(current => ({ ...current, content }))}
                themeMode={themeMode}
                height={420}
                placeholder={t('docContentPlaceholder', { defaultValue: 'Start writing...' })}
              />
              <Select
                value={draft.parent_id}
                allowClear
                showSearch
                optionFilterProp="label"
                options={parentOptions.map(doc => ({ value: doc.id, label: doc.title }))}
                onChange={value => setDraft(current => ({ ...current, parent_id: value || null }))}
                placeholder={t('docParentPlaceholder', { defaultValue: 'Move page under another page (optional)' })}
              />
              <Select
                mode="multiple"
                value={linkedTasks.map(task => task.id)}
                options={taskOptions.map(task => ({
                  value: task.id,
                  label: `${task.task_key} ${task.name}`,
                }))}
                onSearch={value => void searchTasks(value)}
                onChange={values =>
                  setLinkedTasks(current =>
                    values.map((id: string) => current.find(task => task.id === id) || taskOptions.find(task => task.id === id)).filter(
                      (task): task is IProjectDocTask => Boolean(task)
                    )
                  )
                }
                placeholder={t('linkTasksPlaceholder', { defaultValue: 'Link tasks to this doc' })}
                filterOption={false}
                showSearch
              />
              <Typography.Title level={4}>{t('preview', { defaultValue: 'Preview' })}</Typography.Title>
              <div
                className="project-doc-preview"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(draft.content) }}
              />
            </Flex>
          ) : (
            <div style={{ flex: 1 }}>
              <Empty description={t('docsEmpty', { defaultValue: 'Create a doc to start writing.' })} />
            </div>
          )}
        </Flex>
      )}
    </Card>
  );
}
