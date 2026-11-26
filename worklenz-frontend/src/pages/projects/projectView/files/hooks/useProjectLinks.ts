import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import projectLinksApiService from '@/api/projects/project-links.api.service';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '@/shared/constants';
import { SocketEvents } from '@/shared/socket-events';
import { useSocket } from '@/socket/socketContext';
import logger from '@/utils/errorLogger';
import type { ICreateLinkBody, IProjectLink, IUpdateLinkBody } from '@/types/projects/project-links.types';

export const useProjectLinks = (active: boolean) => {
  const { projectId, refreshTimestamp } = useAppSelector(state => state.projectReducer);
  const { socket } = useSocket();

  const [links, setLinks] = useState<IProjectLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [pageIndex, setPageIndex] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const fetchLinks = useCallback(async () => {
    if (!projectId || !active) return;
    try {
      setLoading(true);
      const res = await projectLinksApiService.list(projectId, pageIndex, pageSize);
      if (res.done && res.body) {
        const rows = res.body.data || [];
        setLinks(rows);
        setTotal(res.body.total || 0);
        // If the current page is now empty (e.g. after deletions), fall back to the last valid page.
        if (rows.length === 0 && pageIndex > 1) {
          const lastPage = Math.max(1, Math.ceil((res.body.total || 0) / pageSize));
          setPageIndex(lastPage);
        }
      }
    } catch (e) {
      logger.error('Error fetching project links', e);
    } finally {
      setLoading(false);
    }
  }, [projectId, active, pageIndex, pageSize, refreshTimestamp]);

  const fetchLinksRef = useRef(fetchLinks);
  fetchLinksRef.current = fetchLinks;

  useEffect(() => {
    void fetchLinks();
  }, [fetchLinks]);

  // Keep the Links tab in sync when another team member creates, edits, or deletes a link.
  // refreshTimestamp is also bumped from project-view for the same events (covers remounts).
  useEffect(() => {
    if (!socket || !projectId || !active) return;

    const handleProjectLinksUpdated = (data?: string | { project_id?: string }) => {
      const updatedProjectId = typeof data === 'string' ? data : data?.project_id;
      // Event is room-scoped; refresh unless it clearly belongs to another project.
      if (updatedProjectId && updatedProjectId !== projectId) return;
      void fetchLinksRef.current();
    };

    const numericEvent = SocketEvents.PROJECT_LINKS_UPDATED.toString();
    socket.on(numericEvent, handleProjectLinksUpdated);
    socket.on('PROJECT_LINKS_UPDATED', handleProjectLinksUpdated);
    return () => {
      socket.off(numericEvent, handleProjectLinksUpdated);
      socket.off('PROJECT_LINKS_UPDATED', handleProjectLinksUpdated);
    };
  }, [socket, projectId, active]);

  const goToPage = useCallback(
    (page: number, size: number = pageSize) => {
      if (size !== pageSize) {
        setPageSize(size);
      }
      setPageIndex(page);
    },
    [pageSize]
  );

  const addLink = async (body: ICreateLinkBody): Promise<boolean> => {
    if (!projectId) return false;
    try {
      const res = await projectLinksApiService.create(projectId, body);
      if (res.done && res.body) {
        // New links are ordered by created_at DESC, so show them on the first page.
        // If we're already on page 1 the effect won't re-trigger, so fetch manually;
        // otherwise let the page change drive the refetch to avoid a stale-closure fetch.
        // Set loading here so the table shows a spinner immediately (no stale frame
        // before the effect-driven fetch starts).
        if (pageIndex === 1) {
          await fetchLinks();
        } else {
          setLoading(true);
          setPageIndex(1);
        }
        return true;
      }
    } catch (e) {
      logger.error('Error adding project link', e);
    }
    return false;
  };

  const editLink = async (linkId: string, body: IUpdateLinkBody): Promise<boolean> => {
    if (!projectId) return false;
    try {
      const res = await projectLinksApiService.update(projectId, linkId, body);
      if (res.done) {
        await fetchLinks();
        return true;
      }
    } catch (e) {
      logger.error('Error editing project link', e);
    }
    return false;
  };

  const removeLink = async (linkId: string): Promise<boolean> => {
    if (!projectId) return false;
    try {
      const res = await projectLinksApiService.delete(projectId, linkId);
      if (res.done) {
        await fetchLinks();
        return true;
      }
    } catch (e) {
      logger.error('Error deleting project link', e);
    }
    return false;
  };

  return {
    links,
    loading,
    total,
    pageIndex,
    pageSize,
    setPageIndex: goToPage,
    setPageSize,
    fetchLinks,
    addLink,
    editLink,
    removeLink,
    pageSizeOptions: PAGE_SIZE_OPTIONS,
  };
};
