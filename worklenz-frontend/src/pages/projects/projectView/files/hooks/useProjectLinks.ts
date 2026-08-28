import { useCallback, useEffect, useState } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import projectLinksApiService from '@/api/projects/project-links.api.service';
import { DEFAULT_PAGE_SIZE } from '@/shared/constants';
import logger from '@/utils/errorLogger';
import type { ICreateLinkBody, IProjectLink, IUpdateLinkBody } from '@/types/projects/project-links.types';

export const useProjectLinks = (active: boolean) => {
  const { projectId } = useAppSelector(state => state.projectReducer);

  const [links, setLinks] = useState<IProjectLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [pageIndex, setPageIndex] = useState(1);
  const [pageSize] = useState(DEFAULT_PAGE_SIZE);

  const fetchLinks = useCallback(async () => {
    if (!projectId || !active) return;
    try {
      setLoading(true);
      const res = await projectLinksApiService.list(projectId, pageIndex, pageSize);
      if (res.done && res.body) {
        setLinks(res.body.data || []);
        setTotal(res.body.total || 0);
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

  const addLink = async (body: ICreateLinkBody): Promise<boolean> => {
    if (!projectId) return false;
    try {
      const res = await projectLinksApiService.create(projectId, body);
      if (res.done && res.body) {
        setLinks(prev => [res.body as IProjectLink, ...prev]);
        setTotal(prev => prev + 1);
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
        setLinks(prev =>
          prev.map(l => (l.id === linkId ? { ...l, ...body, updated_at: new Date().toISOString() } : l))
        );
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
        setLinks(prev => prev.filter(l => l.id !== linkId));
        setTotal(prev => Math.max(0, prev - 1));
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
    setPageIndex,
    fetchLinks,
    addLink,
    editLink,
    removeLink,
  };
};
