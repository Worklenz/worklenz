import { configureStore } from '@reduxjs/toolkit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reportingMembersApiService } from '@/api/reporting/reporting-members.api.service';
import membersReportsReducer, {
  fetchMembersData,
  setSearchQuery,
} from './membersReportsSlice';

vi.mock('@/api/reporting/reporting-members.api.service', () => ({
  reportingMembersApiService: {
    getMembers: vi.fn(),
  },
}));

type ApiResponse = Awaited<
  ReturnType<typeof reportingMembersApiService.getMembers>
>;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

function response(name: string, total: number): ApiResponse {
  return {
    body: {
      members: [{ id: name.toLowerCase(), name }],
      total,
    },
  } as ApiResponse;
}

function startOverlappingRequests() {
  const store = configureStore({
    reducer: { membersReportsReducer },
  });

  const oldRequest = deferred<ApiResponse>();
  const latestRequest = deferred<ApiResponse>();

  vi.mocked(reportingMembersApiService.getMembers)
    .mockReturnValueOnce(oldRequest.promise)
    .mockReturnValueOnce(latestRequest.promise);

  const args = { duration: '', dateRange: [] as string[] };

  const oldDispatch = store.dispatch(fetchMembersData(args));

  store.dispatch(setSearchQuery('Bob'));

  const latestDispatch = store.dispatch(fetchMembersData(args));

  return {
    store,
    oldRequest,
    latestRequest,
    oldDispatch,
    latestDispatch,
  };
}

describe('membersReports latest request protection', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it.each(['success', 'failure'] as const)(
    'ignores an older %s after the latest request succeeds',
    async outcome => {
      const {
        store,
        oldRequest,
        latestRequest,
        oldDispatch,
        latestDispatch,
      } = startOverlappingRequests();

      latestRequest.resolve(response('Bob', 1));
      await latestDispatch;

      const latestState = store.getState().membersReportsReducer;

      expect(latestState).toMatchObject({
        searchQuery: 'Bob',
        membersList: [{ id: 'bob', name: 'Bob' }],
        total: 1,
        isLoading: false,
        currentRequestId: null,
        error: null,
      });

      if (outcome === 'success') {
        oldRequest.resolve(response('Alice', 99));
      } else {
        oldRequest.reject(new Error('Old request failed'));
      }

      await oldDispatch;

      expect(store.getState().membersReportsReducer).toEqual(latestState);
    }
  );

  it.each(['success', 'failure'] as const)(
    'keeps loading when an older %s finishes before the latest request',
    async outcome => {
      const {
        store,
        oldRequest,
        latestRequest,
        oldDispatch,
        latestDispatch,
      } = startOverlappingRequests();

      const pendingState = store.getState().membersReportsReducer;

      expect(pendingState.isLoading).toBe(true);
      expect(pendingState.currentRequestId).toBe(latestDispatch.requestId);

      if (outcome === 'success') {
        oldRequest.resolve(response('Alice', 99));
      } else {
        oldRequest.reject(new Error('Old request failed'));
      }

      await oldDispatch;

      expect(store.getState().membersReportsReducer).toEqual(pendingState);

      latestRequest.resolve(response('Bob', 1));
      await latestDispatch;

      expect(store.getState().membersReportsReducer).toMatchObject({
        membersList: [{ id: 'bob', name: 'Bob' }],
        total: 1,
        isLoading: false,
        currentRequestId: null,
        error: null,
      });
    }
  );

  it.each(['success', 'failure'] as const)(
    'preserves the latest failure when an older %s arrives afterward',
    async outcome => {
      const {
        store,
        oldRequest,
        latestRequest,
        oldDispatch,
        latestDispatch,
      } = startOverlappingRequests();

      latestRequest.reject(new Error('Latest request failed'));
      await latestDispatch;

      const failedState = store.getState().membersReportsReducer;

      expect(failedState).toMatchObject({
        searchQuery: 'Bob',
        isLoading: false,
        currentRequestId: null,
        error: 'Latest request failed',
      });

      if (outcome === 'success') {
        oldRequest.resolve(response('Alice', 99));
      } else {
        oldRequest.reject(new Error('Old request failed'));
      }

      await oldDispatch;

      expect(store.getState().membersReportsReducer).toEqual(failedState);
    }
  );
});