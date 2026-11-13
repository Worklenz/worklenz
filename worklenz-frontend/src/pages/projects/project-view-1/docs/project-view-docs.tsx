import { Alert, Button, Empty, Flex, Modal, message, theme } from '@/shared/antd-imports';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router-dom';

import { projectDocumentsApiService } from '@/api/projects/docs/project-documents.api.service';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { fetchTask, setSelectedTaskId, setShowTaskDrawer } from '@/features/task-drawer/task-drawer.slice';
import { ITaskListStatusChangeResponse } from '@/types/tasks/task-list-status.types';
import {
  EMPTY_DOCUMENT,
  EMPTY_MENTIONS,
  ISectionDocument,
  IProjectDocument,
  IProjectDocumentSearchResult,
  IProjectDocumentSummary,
} from '@/types/project/project-documents.types';

import DocsEditor from './DocsEditor';
import DocsSidebar from './docs-sidebar';
import { mentionStore } from './mention-store';
import { useDocsFavorites } from './use-docs-favorites';
import { useDocsAutosave } from './use-docs-autosave';
import { useDocsSearchReplace } from './docs-search-guard';

const ProjectViewDocs = () => {
  const { t } = useTranslation('project-view-docs');
  const { token } = theme.useToken();
  const { projectId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const replaceDocsSearch = useDocsSearchReplace(setSearchParams);
  const dispatch = useAppDispatch();
  const { socket } = useSocket();
  const refreshTimestamp = useAppSelector(state => state.projectReducer.refreshTimestamp);

  const favorites = useDocsFavorites(projectId);
  const handleToggleFavorite = (id: string) => {
    void favorites.toggle(id).then(success => {
      if (success === false) message.error(t('favoriteFailed', { defaultValue: "Couldn't update your favorites. Try again." }));
    });
  };

  const [pages, setPages] = useState<IProjectDocumentSummary[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState(false);
  const [active, setActive] = useState<IProjectDocument | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState<ISectionDocument>(EMPTY_DOCUMENT);
  const [conflictDocument, setConflictDocument] = useState<IProjectDocument | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<IProjectDocumentSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);

  const activeRef = useRef<IProjectDocument | null>(null);
  const contentRef = useRef(content);
  const titleRef = useRef(title);
  const searchParamsRef = useRef(searchParams);
  activeRef.current = active;
  contentRef.current = content;
  titleRef.current = title;
  searchParamsRef.current = searchParams;

  const applyDocument = useCallback((document: IProjectDocument, mark: (document: IProjectDocument) => void) => {
    setActive(document);
    setTitle(document.title);
    setContent(document.content || EMPTY_DOCUMENT);
    setConflictDocument(null);
    mentionStore.set(document.mentions || EMPTY_MENTIONS);
    mark(document);
    setPages(current =>
      current.map(page =>
        page.id === document.id
          ? {
              ...page,
              title: document.title,
              updated_at: document.updated_at,
              updated_by_name: document.updated_by_name,
            }
          : page
      )
    );
  }, []);

  const handleSaved = useCallback((document: IProjectDocument) => {
    // Update the ref synchronously so a rename right after a save sees the new timestamp.
    const currentActive = activeRef.current;
    if (currentActive && currentActive.id === document.id) {
      const next = { ...currentActive, ...document };
      activeRef.current = next;
      setActive(next);
    }
    mentionStore.merge(document.mentions || EMPTY_MENTIONS);
    setPages(current =>
      current.some(page => page.id === document.id)
        ? current.map(page =>
            page.id === document.id
              ? { ...page, title: document.title, updated_at: document.updated_at, updated_by_name: document.updated_by_name }
              : page
          )
        : current
    );
  }, []);

  const handleConflict = useCallback((document: IProjectDocument) => {
    setConflictDocument(document);
  }, []);

  const { saveState, schedule, flush, retry, markClean, touchSaved } = useDocsAutosave(handleSaved, handleConflict);
  const markCleanRef = useRef(markClean);
  markCleanRef.current = markClean;

  useEffect(() => () => {
    void flush();
  }, [flush]);

  const writeDocParam = useCallback(
    (documentId: string | null) => {
      const next = new URLSearchParams(searchParams);
      next.set('tab', 'docs');
      if (documentId) next.set('doc', documentId);
      else next.delete('doc');
      replaceDocsSearch(next);
    },
    [searchParams, replaceDocsSearch]
  );

  const openDocument = useCallback(
    async (documentId: string) => {
      if (documentId === activeRef.current?.id) return;
      const flushed = await flush();
      if (flushed === 'error' || flushed === 'conflict') return;
      try {
        const response = await projectDocumentsApiService.getById(documentId);
        if (!response.done || !response.body) {
          message.error(t('loadError', { defaultValue: "Couldn't load this page" }));
          return;
        }
        applyDocument(response.body, markCleanRef.current);
        setReloadToken(token => token + 1);
        writeDocParam(response.body.id);
      } catch {
        message.error(t('loadError', { defaultValue: "Couldn't load this page" }));
      }
    },
    [applyDocument, flush, t, writeDocParam]
  );

  const loadPages = useCallback(async () => {
    if (!projectId) return;
    setListLoading(true);
    setListError(false);
    try {
      const response = await projectDocumentsApiService.list(projectId);
      if (!response.done) {
        setListError(true);
        return;
      }
      const nextPages = response.body || [];
      setPages(nextPages);
      const requested = searchParamsRef.current.get('doc');
      const currentId = activeRef.current?.id;
      const target =
        (requested && nextPages.some(page => page.id === requested) && requested) ||
        (currentId && nextPages.some(page => page.id === currentId) && currentId) ||
        nextPages[0]?.id ||
        null;
      if (!target) {
        setActive(null);
        mentionStore.set(EMPTY_MENTIONS);
        return;
      }
      if (target !== currentId) {
        const documentResponse = await projectDocumentsApiService.getById(target);
        if (documentResponse.done && documentResponse.body) {
          applyDocument(documentResponse.body, markCleanRef.current);
          setReloadToken(value => value + 1);
          const next = new URLSearchParams(searchParamsRef.current);
          next.set('tab', 'docs');
          next.set('doc', documentResponse.body.id);
          replaceDocsSearch(next);
        }
      }
    } catch {
      setListError(true);
    } finally {
      setListLoading(false);
    }
  }, [applyDocument, projectId, replaceDocsSearch]);

  useEffect(() => {
    void loadPages();
  }, [loadPages, refreshTimestamp]);

  useEffect(() => {
    mentionStore.openTask = taskId => {
      if (!projectId) return;
      dispatch(setSelectedTaskId(taskId));
      dispatch(setShowTaskDrawer(true));
      dispatch(fetchTask({ taskId, projectId }));
    };
  }, [dispatch, projectId]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (!projectId || query.length < 2) {
      setSearchResults(null);
      setSearching(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setSearching(true);
      void projectDocumentsApiService
        .search(projectId, query)
        .then(response => {
          setSearchResults(response.done ? response.body || [] : []);
        })
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [projectId, searchQuery]);

  useEffect(() => {
    if (!socket) return;
    const handleStatus = (response: ITaskListStatusChangeResponse) => {
      if (!response?.id || response.completed_deps === false || response.phase_guard_blocked) return;
      const current = mentionStore.get();
      const task = current.tasks[response.id];
      if (!task) return;
      mentionStore.set({
        ...current,
        tasks: {
          ...current.tasks,
          [response.id]: {
            ...task,
            status_name: response.status_name || task.status_name,
            status_color: response.color_code || task.status_color,
            unavailable: false,
          },
        },
      });
    };
    socket.on(SocketEvents.TASK_STATUS_CHANGE.toString(), handleStatus);
    return () => {
      socket.off(SocketEvents.TASK_STATUS_CHANGE.toString(), handleStatus);
    };
  }, [socket]);

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (!active || conflictDocument) return;
    schedule(active.id, value, contentRef.current);
  };

  const handleContentChange = (value: ISectionDocument) => {
    setContent(value);
    if (!active || conflictDocument) return;
    schedule(active.id, titleRef.current, value);
  };

  const handleCreate = async (parentId: string | null) => {
    if (!projectId) return;
    const flushed = await flush();
    if (flushed === 'conflict' || flushed === 'error') return;
    try {
      const response = await projectDocumentsApiService.create(
        projectId,
        t('untitled', { defaultValue: 'Untitled' }),
        parentId
      );
      if (!response.done || !response.body) {
        message.error(response.message || t('actionFailed', { defaultValue: "Couldn't create the page" }));
        return;
      }
      setPages(current => [
        ...current,
        {
          id: response.body.id,
          project_id: response.body.project_id,
          parent_id: response.body.parent_id,
          title: response.body.title,
          position: response.body.position,
          updated_at: response.body.updated_at,
          updated_by_name: response.body.updated_by_name,
        },
      ]);
      applyDocument(response.body, markClean);
      setReloadToken(value => value + 1);
      writeDocParam(response.body.id);
      setSearchQuery('');
    } catch {
      message.error(t('actionFailed', { defaultValue: "Couldn't create the page" }));
    }
  };

  const handleRename = async (id: string, nextTitle: string) => {
    const flushed = await flush();
    if (flushed === 'conflict' || flushed === 'error') return;
    const page = pages.find(item => item.id === id);
    const expected = activeRef.current?.id === id ? activeRef.current.updated_at : page?.updated_at;
    if (!expected) return;
    try {
      const result = await projectDocumentsApiService.update(id, {
        expected_updated_at: expected,
        title: nextTitle,
      });
      if (result.status === 'conflict') {
        setConflictDocument(result.document);
        return;
      }
      setPages(current =>
        current.map(item =>
          item.id === id
            ? { ...item, title: result.document.title, updated_at: result.document.updated_at, updated_by_name: result.document.updated_by_name }
            : item
        )
      );
      if (activeRef.current?.id === id) {
        setActive(current =>
          current
            ? { ...current, title: result.document.title, updated_at: result.document.updated_at, updated_by_name: result.document.updated_by_name }
            : current
        );
        setTitle(result.document.title);
        touchSaved(result.document.updated_at, result.document.title);
      }
    } catch {
      message.error(t('actionFailed', { defaultValue: "Couldn't rename the page" }));
    }
  };

  const handleDuplicate = async (id: string) => {
    const flushed = await flush();
    if (flushed === 'conflict' || flushed === 'error') return;
    const page = pages.find(item => item.id === id);
    if (!page) return;
    const copyTitle = `${page.title} ${t('copySuffix', { defaultValue: 'copy' })}`.slice(0, 500);
    try {
      const response = await projectDocumentsApiService.duplicate(id, copyTitle);
      if (!response.done || !response.body) return;
      setPages(current => [
        ...current,
        {
          id: response.body.id,
          project_id: response.body.project_id,
          parent_id: response.body.parent_id,
          title: response.body.title,
          position: response.body.position,
          updated_at: response.body.updated_at,
          updated_by_name: response.body.updated_by_name,
        },
      ]);
      applyDocument(response.body, markClean);
      setReloadToken(value => value + 1);
      writeDocParam(response.body.id);
    } catch {
      message.error(t('actionFailed', { defaultValue: "Couldn't duplicate the page" }));
    }
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: t('deleteConfirm', { defaultValue: 'Delete this page?' }),
      content: t('deleteConfirmDescription', { defaultValue: 'Subpages are deleted with it.' }),
      okText: t('delete', { defaultValue: 'Delete' }),
      cancelText: t('cancel', { defaultValue: 'Cancel' }),
      okButtonProps: { danger: true },
      onOk: async () => {
        const response = await projectDocumentsApiService.remove(id);
        if (!response.done || !response.body) return;
        const deleted = new Set(response.body.deleted_ids || [id]);
        const remaining = pages.filter(page => !deleted.has(page.id));
        setPages(remaining);
        if (active && deleted.has(active.id)) {
          // Confirmed deletion discards this draft and cancels its pending autosave.
          markClean(active);
          const next = remaining[0];
          if (next) {
            await openDocument(next.id);
          } else {
            setActive(null);
            mentionStore.set(EMPTY_MENTIONS);
            writeDocParam(null);
          }
        }
      },
    });
  };

  const handleReloadConflict = () => {
    if (!conflictDocument) return;
    applyDocument(conflictDocument, markClean);
    setReloadToken(value => value + 1);
  };

  return (
    <Flex
      className="min-h-[calc(100vh-220px)] flex-col md:h-[calc(100vh-220px)] md:flex-row md:overflow-hidden"
      style={{ background: token.colorBgContainer, color: token.colorText }}
    >
      <DocsSidebar
        pages={pages}
        favoriteIds={favorites.ids}
        favoriteLoading={favorites.loading}
        favoriteError={favorites.hasError}
        onRetryFavorites={favorites.retry}
        onToggleFavorite={handleToggleFavorite}
        favoritePending={favorites.pending}
        activeId={active?.id || null}
        loading={listLoading}
        searchQuery={searchQuery}
        searchResults={searchResults}
        searching={searching}
        onSearch={setSearchQuery}
        onSelect={id => {
          setSearchQuery('');
          void openDocument(id);
        }}
        onCreate={parentId => {
          void handleCreate(parentId);
        }}
        onRename={(id, nextTitle) => {
          void handleRename(id, nextTitle);
        }}
        onDuplicate={id => {
          void handleDuplicate(id);
        }}
        onDelete={handleDelete}
        onReorder={items => {
          if (!projectId) return;
          // Apply the move immediately so the row doesn't snap back while the request runs.
          const previous = pages;
          const moves = new Map(items.map(item => [item.id, item]));
          setPages(current =>
            current.map(page => {
              const move = moves.get(page.id);
              return move ? { ...page, parent_id: move.parent_id, position: move.position } : page;
            })
          );
          void projectDocumentsApiService.reorder(projectId, items).then(response => {
            if (response.done && response.body) setPages(response.body);
            else setPages(previous);
          }).catch(() => {
            setPages(previous);
            message.error(t('actionFailed', { defaultValue: "Couldn't reorder pages" }));
          });
        }}
      />
      <Flex vertical flex={1} className="min-h-0 min-w-0">
        {listError ? (
          <div className="p-6">
            <Alert
              type="error"
              showIcon
              message={t('loadError', { defaultValue: "Couldn't load pages" })}
              action={
                <Button size="small" onClick={() => void loadPages()}>
                  {t('retry', { defaultValue: 'Retry' })}
                </Button>
              }
            />
          </div>
        ) : !listLoading && !active ? (
          <Flex align="center" justify="center" className="flex-1 p-8">
            <Empty description={t('emptyDescription', { defaultValue: 'Create a page for specs, notes, and decisions.' })}>
              <Button type="primary" onClick={() => void handleCreate(null)}>
                {t('createPage', { defaultValue: 'Create page' })}
              </Button>
            </Empty>
          </Flex>
        ) : active ? (
          <DocsEditor
            key={`${active.id}:${reloadToken}`}
            documentId={active.id}
            pages={pages}
            onSelectPage={id => { void openDocument(id); }}
            isFavorite={favorites.ids.has(active.id)}
            isFavoriteDisabled={favorites.loading || favorites.hasError || favorites.pending.has(active.id)}
            onToggleFavorite={() => handleToggleFavorite(active.id)}
            projectId={projectId}
            title={title}
            content={content}
            saveState={conflictDocument ? 'conflict' : saveState}
            updatedByName={active.updated_by_name}
            conflictByName={conflictDocument?.updated_by_name || null}
            onTitleChange={handleTitleChange}
            onContentChange={handleContentChange}
            onReload={handleReloadConflict}
            onRetry={retry}
          />
        ) : null}
      </Flex>
    </Flex>
  );
};

export default ProjectViewDocs;
