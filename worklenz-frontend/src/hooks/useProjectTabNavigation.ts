import { useCallback } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import { setProjectView } from '@/features/project/project.slice';

/** Switches the active project view tab while keeping the pinned tab in the URL. */
export const useProjectTabNavigation = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const goToProjectTab = useCallback(
    (tabKey: string) => {
      dispatch(setProjectView(tabKey === 'board' ? 'kanban' : 'list'));
      navigate(
        {
          pathname: location.pathname,
          search: new URLSearchParams({
            tab: tabKey,
            pinned_tab: searchParams.get('pinned_tab') || '',
          }).toString(),
        },
        { replace: true }
      );
    },
    [dispatch, location.pathname, navigate, searchParams]
  );

  return { goToProjectTab };
};
