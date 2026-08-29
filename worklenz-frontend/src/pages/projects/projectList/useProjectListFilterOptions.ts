import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useGetClientsLookupQuery } from '@/api/projects/projects.v1.api.service';
import { fetchProjectCategories } from '@/features/projects/lookups/projectCategories/projectCategoriesSlice';
import { fetchProjectHealth } from '@/features/projects/lookups/projectHealth/projectHealthSlice';
import { fetchProjectStatuses } from '@/features/projects/lookups/projectStatuses/projectStatusesSlice';
import { fetchProjectPriorities } from '@/features/projects/priority/projectPrioritySlice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { IClient } from '@/types/client.types';
import { ProjectListFieldKey } from '@/types/project-list-field.types';

import { ColumnFilterOptions, NONE_FILTER_VALUE, toColumnFilterItems } from './project-list.constants';

const EMPTY_CLIENTS: IClient[] = [];

/**
 * Loads every lookup the project list's column filters need and shapes them
 * into antd `ColumnFilterItem` lists.
 *
 * Statuses, categories and priorities are cached in Redux and only fetched when
 * empty, so revisiting the page costs nothing. Clients go through RTK Query for
 * the same reason — a remount reuses the cached result instead of re-fetching.
 *
 * A "No <field>" sentinel item is prepended to the Client, Priority and Category
 * dropdowns so users can filter for projects that have no value assigned. The
 * sentinel value (`NONE_FILTER_VALUE`) is recognised by the backend and converted
 * to an `IS NULL` SQL clause rather than being used as a real UUID.
 */
export const useProjectListFilterOptions = (): ColumnFilterOptions => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('all-project-list');

  const projectStatuses = useAppSelector(state => state.projectStatusesReducer.projectStatuses);
  const projectCategories = useAppSelector(
    state => state.projectCategoriesReducer.projectCategories
  );
  const projectHealths = useAppSelector(state => state.projectHealthReducer.projectHealths);
  const priorities = useAppSelector(state => state.projectPriorityReducer.priorities);

  const { data: clientsResponse } = useGetClientsLookupQuery();
  const clients = clientsResponse?.body || EMPTY_CLIENTS;

  useEffect(() => {
    const requests = [];
    if (projectStatuses.length === 0) requests.push(dispatch(fetchProjectStatuses()));
    if (projectCategories.length === 0) requests.push(dispatch(fetchProjectCategories()));
    // Not a filter itself, but other project surfaces read it straight from the
    // store and rely on the list page having warmed it.
    if (projectHealths.length === 0) requests.push(dispatch(fetchProjectHealth()));
    if (priorities.length === 0) requests.push(dispatch(fetchProjectPriorities()));
    if (requests.length > 0) void Promise.allSettled(requests);
  }, [
    dispatch,
    projectStatuses.length,
    projectCategories.length,
    projectHealths.length,
    priorities.length,
  ]);

  return useMemo(
    () => ({
      [ProjectListFieldKey.STATUS]: toColumnFilterItems(projectStatuses),
      [ProjectListFieldKey.CATEGORY]: [
        { text: t('filter.noCategory'), value: NONE_FILTER_VALUE },
        ...toColumnFilterItems(projectCategories),
      ],
      [ProjectListFieldKey.PRIORITY]: [
        { text: t('filter.noPriority'), value: NONE_FILTER_VALUE },
        ...toColumnFilterItems(priorities),
      ],
      [ProjectListFieldKey.CLIENT]: [
        { text: t('filter.noClient'), value: NONE_FILTER_VALUE },
        ...toColumnFilterItems(clients),
      ],
    }),
    // t is stable across renders (react-i18next guarantee) so it is safe to
    // include it without causing extra memos to fire.
    [t, projectStatuses, projectCategories, priorities, clients]
  );
};
