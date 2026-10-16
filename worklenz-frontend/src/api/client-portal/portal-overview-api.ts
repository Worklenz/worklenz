import { clientPortalApi } from './client-portal-api';
import type { ServerEnvelope } from './company-users-api';
import { buildQuery, PORTAL_V2 } from './portal-api-utils';
import type {
  OverviewLayout,
  OverviewLayoutResponse,
  OverviewResponse,
  OverviewWidgetKey,
} from '@/types/client-portal/v2/overview';

export const portalOverviewApi = clientPortalApi.injectEndpoints({
  endpoints: builder => ({
    // One request returns a keyed block per widget. Pass only the visible keys so hidden widgets cost nothing.
    getOverview: builder.query<ServerEnvelope<OverviewResponse>, { widgets: OverviewWidgetKey[] }>({
      query: ({ widgets }) => `${PORTAL_V2}/overview${buildQuery({ widgets: widgets.join(',') })}`,
      // The key set is part of the cache identity, so reordering widgets does not refetch.
      serializeQueryArgs: ({ queryArgs }) => [...queryArgs.widgets].sort().join(','),
      providesTags: ['PortalOverview'],
    }),

    getOverviewLayout: builder.query<ServerEnvelope<OverviewLayoutResponse>, void>({
      query: () => `${PORTAL_V2}/overview/layout`,
      providesTags: ['PortalOverviewLayout'],
    }),

    // Optimistic: the grid already shows the new layout, so the cache follows it and rolls back on failure.
    saveOverviewLayout: builder.mutation<ServerEnvelope<OverviewLayoutResponse>, OverviewLayout>({
      query: layout => ({ url: `${PORTAL_V2}/overview/layout`, method: 'PUT', body: { layout } }),
      async onQueryStarted(layout, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          portalOverviewApi.util.updateQueryData('getOverviewLayout', undefined, draft => {
            draft.body.layout = layout;
          })
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
    }),

    resetOverviewLayout: builder.mutation<ServerEnvelope<OverviewLayoutResponse>, void>({
      query: () => ({ url: `${PORTAL_V2}/overview/layout`, method: 'DELETE' }),
      invalidatesTags: ['PortalOverviewLayout'],
    }),
  }),
});

export const {
  useGetOverviewQuery,
  useGetOverviewLayoutQuery,
  useSaveOverviewLayoutMutation,
  useResetOverviewLayoutMutation,
} = portalOverviewApi;
