import { useEffect, useCallback } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  toggleCustomColumnVisibility,
  setHiddenCustomColumnIds,
} from '@/features/projects/singleProject/task-list-custom-columns/task-list-custom-columns-slice';
import { useAuthService } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';

function storageKey(projectId: string, userId: string): string {
  return `worklenz.customColumns.hidden.${projectId}.${userId}`;
}

export function useCustomColumnVisibility() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const authService = useAuthService();
  const currentSession = authService.getCurrentSession();

  const { project } = useAppSelector(state => state.projectReducer);

  const hiddenIds: string[] = useAppSelector(
    state => state.taskListCustomColumnsReducer.hiddenCustomColumnIds
  );

  const projectId = project?.id ?? 'default';
  const userId = currentSession?.id ?? 'anonymous';
  const key = storageKey(projectId, userId);

  // Load persisted hidden IDs from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed: string[] = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          dispatch(setHiddenCustomColumnIds(parsed));
        }
      }
    } catch {
      // corrupted storage — silently ignore
    }
  }, [key]);

  // Persist to localStorage whenever hiddenIds changes
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(hiddenIds));
    } catch {
      // storage quota exceeded — silently ignore
    }
  }, [hiddenIds, key]);

  const toggleVisibility = useCallback(
    (columnId: string) => {
      dispatch(toggleCustomColumnVisibility(columnId));
    },
    [dispatch]
  );

  const isHidden = useCallback(
    (columnId: string): boolean => hiddenIds.includes(columnId),
    [hiddenIds]
  );

  return { hiddenIds, toggleVisibility, isHidden };
}