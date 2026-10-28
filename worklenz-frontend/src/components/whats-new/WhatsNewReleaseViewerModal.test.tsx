import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDismiss } = vi.hoisted(() => ({ mockDismiss: vi.fn() }));

vi.mock('@/api/whats-new/whats-new.api.service', () => ({
  whatsNewApiService: {
    getCurrent: vi.fn(),
    getLatest: vi.fn(),
    getById: vi.fn(),
    dismiss: mockDismiss,
  },
}));

vi.mock('@/hooks/useAppDispatch', async () => {
  const { useDispatch } = await import('react-redux');
  return { useAppDispatch: () => useDispatch() };
});

vi.mock('@/hooks/useAppSelector', async () => {
  const { useSelector } = await import('react-redux');
  return { useAppSelector: useSelector };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string; title?: string }) =>
      (options?.defaultValue ?? key).replace('{{title}}', options?.title ?? ''),
  }),
}));

import whatsNewReducer from '@/features/whats-new/whatsNewSlice';
import { IWhatsNewRelease } from '@/types/whats-new/whats-new.types';
import WhatsNewReleaseViewerModal from './WhatsNewReleaseViewerModal';

type WhatsNewState = ReturnType<typeof whatsNewReducer>;

const RELEASE: IWhatsNewRelease = {
  id: 'release-a',
  title: 'Release A',
  body_markdown: 'Something **new** shipped.',
  published_at: '2026-09-01',
  changelog_url: null,
  preview_text: 'Something new shipped.',
};

const renderViewer = (overrides: Partial<WhatsNewState>) => {
  const store = configureStore({
    reducer: { whatsNewReducer },
    preloadedState: {
      whatsNewReducer: {
        ...whatsNewReducer(undefined, { type: 'init' }),
        viewedRelease: RELEASE,
        isViewedModalOpen: true,
        ...overrides,
      },
    },
  });

  render(
    <Provider store={store}>
      <WhatsNewReleaseViewerModal />
    </Provider>
  );

  return store;
};

// jsdom does not implement getComputedStyle(elt, pseudoElt), which antd's Modal scroll lock calls.
const realGetComputedStyle = window.getComputedStyle.bind(window);

describe('WhatsNewReleaseViewerModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'getComputedStyle').mockImplementation(elt => realGetComputedStyle(elt));
    mockDismiss.mockResolvedValue({ done: true, body: null });
  });

  it('should render nothing while closed', () => {
    renderViewer({ isViewedModalOpen: false });

    expect(screen.queryByText(/What's New/)).not.toBeInTheDocument();
  });

  it('should show the New badge by default (notification drawer flow)', () => {
    renderViewer({});

    expect(screen.getByText("What's New — Release A")).toBeInTheDocument();
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('should hide the New badge for a release outside the 7-day window', () => {
    renderViewer({ viewedShowNewBadge: false });

    expect(screen.getByText("What's New — Release A")).toBeInTheDocument();
    expect(screen.queryByText('New')).not.toBeInTheDocument();
  });

  it('should dismiss the release on close when it was tag-eligible', async () => {
    const store = renderViewer({ viewedDismissOnClose: true, currentRelease: RELEASE });

    fireEvent.click(screen.getByRole('button', { name: /close/i }));

    await waitFor(() => expect(mockDismiss).toHaveBeenCalledTimes(1));
    expect(mockDismiss).toHaveBeenCalledWith('release-a');
    expect(store.getState().whatsNewReducer.isViewedModalOpen).toBe(false);
    // The optimistic dismissal is what hides the nav tag and notification card.
    expect(store.getState().whatsNewReducer.currentRelease).toBeNull();
  });

  it('should write nothing on close when the release was not tag-eligible', async () => {
    const store = renderViewer({ viewedDismissOnClose: false, currentRelease: RELEASE });

    fireEvent.click(screen.getByRole('button', { name: /close/i }));

    await waitFor(() => expect(store.getState().whatsNewReducer.isViewedModalOpen).toBe(false));
    expect(mockDismiss).not.toHaveBeenCalled();
    expect(store.getState().whatsNewReducer.currentRelease).toEqual(RELEASE);
  });
});
