import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

import {
  GroupedProjectRequestParams,
  ProjectRequestParams,
  setGroupedRequestParams,
  setRequestParams,
} from '@/features/projects/projectsSlice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useLatestRef } from '@/hooks/useLatestRef';
import { DEFAULT_PAGE_SIZE } from '@/shared/constants';
import { ProjectViewType } from '@/types/project/project.types';

import {
  PAGE_QUERY_PARAM,
  SEARCH_QUERY_PARAM,
  SIZE_QUERY_PARAM,
  parsePositiveIntegerParam,
} from './project-list.constants';

interface UseProjectListUrlSyncArgs {
  viewMode: ProjectViewType;
  requestParams: ProjectRequestParams;
  groupedRequestParams: GroupedProjectRequestParams;
  buildGroupedParams: (
    overrides?: Partial<GroupedProjectRequestParams>
  ) => GroupedProjectRequestParams;
}

/**
 * Keeps `?search`, `?page` and `?size` and the Redux request params in step so
 * the list is shareable and survives a reload.
 *
 * Hydration runs exactly once on mount — after that Redux is the source of
 * truth and the URL only ever trails it, which avoids the feedback loop of the
 * URL and the store repeatedly correcting each other.
 */
export const useProjectListUrlSync = ({
  viewMode,
  requestParams,
  groupedRequestParams,
  buildGroupedParams,
}: UseProjectListUrlSyncArgs): void => {
  const dispatch = useAppDispatch();
  const [urlSearchParams, setUrlSearchParams] = useSearchParams();

  const hasHydrated = useRef(false);
  const urlSearchParamsRef = useLatestRef(urlSearchParams);

  useEffect(() => {
    if (hasHydrated.current) return;
    hasHydrated.current = true;

    // Read straight from the URL rather than the ref: on the very first commit
    // the ref has not been populated yet.
    const searchFromUrl = (urlSearchParams.get(SEARCH_QUERY_PARAM) || '').trim();
    const pageFromUrl = parsePositiveIntegerParam(urlSearchParams.get(PAGE_QUERY_PARAM));
    const sizeFromUrl = parsePositiveIntegerParam(urlSearchParams.get(SIZE_QUERY_PARAM));

    const listUpdates: Partial<ProjectRequestParams> = {};
    const groupedUpdates: Partial<GroupedProjectRequestParams> = {};

    if (searchFromUrl) {
      if (requestParams.search !== searchFromUrl) {
        listUpdates.search = searchFromUrl;
        listUpdates.index = 1;
      }
      if (groupedRequestParams.search !== searchFromUrl) {
        groupedUpdates.search = searchFromUrl;
        groupedUpdates.index = 1;
      }
    }
    if (pageFromUrl && pageFromUrl !== requestParams.index) {
      listUpdates.index = pageFromUrl;
      groupedUpdates.index = pageFromUrl;
    }
    if (sizeFromUrl && sizeFromUrl !== requestParams.size) {
      listUpdates.size = sizeFromUrl;
      groupedUpdates.size = sizeFromUrl;
    }

    if (Object.keys(listUpdates).length > 0) dispatch(setRequestParams(listUpdates));
    if (Object.keys(groupedUpdates).length > 0)
      dispatch(setGroupedRequestParams(buildGroupedParams(groupedUpdates)));
    // Mount-only by design; every value it reads is captured above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeSearch =
    (viewMode === ProjectViewType.LIST ? requestParams.search : groupedRequestParams.search) || '';
  const activeIndex =
    viewMode === ProjectViewType.LIST ? requestParams.index : groupedRequestParams.index;
  const activeSize =
    viewMode === ProjectViewType.LIST ? requestParams.size : groupedRequestParams.size;

  useEffect(() => {
    const normalizedSearch = activeSearch.trim();
    const desiredPage = (activeIndex || 1).toString();
    const desiredSize = (activeSize || DEFAULT_PAGE_SIZE).toString();

    const current = urlSearchParamsRef.current;
    const searchIsCurrent = (current.get(SEARCH_QUERY_PARAM) || '').trim() === normalizedSearch;
    const pageIsCurrent = (current.get(PAGE_QUERY_PARAM) || '') === desiredPage;
    const sizeIsCurrent = (current.get(SIZE_QUERY_PARAM) || '') === desiredSize;
    if (searchIsCurrent && pageIsCurrent && sizeIsCurrent) return;

    // One history entry per change instead of the two the split search/page
    // effects used to produce.
    setUrlSearchParams(
      previous => {
        const next = new URLSearchParams(previous);
        if (normalizedSearch) next.set(SEARCH_QUERY_PARAM, normalizedSearch);
        else next.delete(SEARCH_QUERY_PARAM);
        next.set(PAGE_QUERY_PARAM, desiredPage);
        next.set(SIZE_QUERY_PARAM, desiredSize);
        return next;
      },
      { replace: true }
    );
  }, [activeSearch, activeIndex, activeSize, setUrlSearchParams, urlSearchParamsRef]);
};
