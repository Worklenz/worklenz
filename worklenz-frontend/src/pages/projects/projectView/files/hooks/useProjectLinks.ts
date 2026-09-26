import { useCallback, useEffect, useState } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import projectLinksApiService from '@/api/projects/project-links.api.service';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '@/shared/constants';
import logger from '@/utils/errorLogger';
import type { ICreateLinkBody, IProjectLink, IUpdateLinkBody } from '@/types/projects/project-links.types';

export const useProjectLinks = (active: boolean) => {
  const { projectId } = useAppSelector(state => state.projectReducer);

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
  }, [projectId, active, pageIndex, pageSize]);

  useEffect(() => {
    void fetchLinks();
  }, [fetchLinks]);

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
