import { describe, test, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { ReactNode } from 'react';
import { useProjectLinks } from './useProjectLinks';
import { DEFAULT_PAGE_SIZE } from '@/shared/constants';

vi.mock('@/api/projects/project-links.api.service', () => {
  return {
    default: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
});

import projectLinksApiService from '@/api/projects/project-links.api.service';

const listMock = projectLinksApiService.list as unknown as ReturnType<typeof vi.fn>;
const createMock = projectLinksApiService.create as unknown as ReturnType<typeof vi.fn>;
const updateMock = projectLinksApiService.update as unknown as ReturnType<typeof vi.fn>;
const deleteMock = projectLinksApiService.delete as unknown as ReturnType<typeof vi.fn>;

const PROJECT_ID = 'test-project';
const SAMPLE_LINK = { id: 'l1', title: 'A', url: 'https://a.com' } as any;

const renderWithStore = (projectId: string, active = true) => {
  const store = configureStore({
    reducer: {
      projectReducer: (state: any = { projectId }, action: any) => {
        if (action.type === 'project/setProjectId') {
          return { ...state, projectId: action.payload };
        }
        return state;
      },
    },
    preloadedState: { projectReducer: { projectId } },
  });

  const wrapper = ({ children }: { children: ReactNode }) => <Provider store={store}>{children}</Provider>;
  return renderHook(() => useProjectLinks(active), { wrapper });
};

beforeEach(() => {
  vi.clearAllMocks();
  listMock.mockResolvedValue({ done: true, body: { data: [SAMPLE_LINK], total: 25 } });
  createMock.mockResolvedValue({ done: true, body: { id: 'l2', title: 'new', url: 'https://b.com' } });
  updateMock.mockResolvedValue({ done: true, body: null });
  deleteMock.mockResolvedValue({ done: true, body: null });
});

describe('useProjectLinks.addLink — single-fetch regression', () => {
  test('addLink while on page > 1 fetches the list exactly once for page 1 (no stale fetch)', async () => {
    const { result } = renderWithStore(PROJECT_ID);

    await waitFor(() => expect(listMock).toHaveBeenCalled());
    act(() => {
      result.current.setPageIndex(3, 10);
    });
    await waitFor(() => expect(listMock).toHaveBeenCalledWith(PROJECT_ID, 3, 10));
    listMock.mockClear();

    let ok = false;
    await act(async () => {
      ok = await result.current.addLink({ title: 'new', url: 'https://b.com' });
    });

    expect(ok).toBe(true);
    expect(listMock).toHaveBeenCalledTimes(1);
    expect(listMock).toHaveBeenCalledWith(PROJECT_ID, 1, 10);
  });

  test('addLink while already on page 1 still fetches exactly once (for page 1)', async () => {
    const { result } = renderWithStore(PROJECT_ID);

    await waitFor(() => expect(listMock).toHaveBeenCalled());
    listMock.mockClear();

    let ok = false;
    await act(async () => {
      ok = await result.current.addLink({ title: 'new', url: 'https://b.com' });
    });

    expect(ok).toBe(true);
    expect(listMock).toHaveBeenCalledTimes(1);
    expect(listMock).toHaveBeenCalledWith(PROJECT_ID, 1, DEFAULT_PAGE_SIZE);
  });
});

describe('useProjectLinks.editLink / removeLink — re-fetch current page once', () => {
  test('editLink re-fetches the current page exactly once', async () => {
    const { result } = renderWithStore(PROJECT_ID);
    await waitFor(() => expect(listMock).toHaveBeenCalled());
    act(() => {
      result.current.setPageIndex(2, 10);
    });
    await waitFor(() => expect(listMock).toHaveBeenCalledWith(PROJECT_ID, 2, 10));
    listMock.mockClear();

    let ok = false;
    await act(async () => {
      ok = await result.current.editLink('l1', { title: 'edited', url: 'https://c.com' });
    });

    expect(ok).toBe(true);
    expect(listMock).toHaveBeenCalledTimes(1);
    expect(listMock).toHaveBeenCalledWith(PROJECT_ID, 2, 10);
  });

  test('removeLink re-fetches the current page exactly once', async () => {
    const { result } = renderWithStore(PROJECT_ID);
    await waitFor(() => expect(listMock).toHaveBeenCalled());
    act(() => {
      result.current.setPageIndex(2, 10);
    });
    await waitFor(() => expect(listMock).toHaveBeenCalledWith(PROJECT_ID, 2, 10));
    listMock.mockClear();

    let ok = false;
    await act(async () => {
      ok = await result.current.removeLink('l1');
    });

    expect(ok).toBe(true);
    expect(listMock).toHaveBeenCalledTimes(1);
    expect(listMock).toHaveBeenCalledWith(PROJECT_ID, 2, 10);
  });
});
