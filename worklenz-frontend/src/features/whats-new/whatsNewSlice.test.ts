import { describe, expect, it, vi } from 'vitest';

import { ILatestWhatsNewRelease, IWhatsNewRelease } from '@/types/whats-new/whats-new.types';

vi.mock('@/api/whats-new/whats-new.api.service', () => ({
  whatsNewApiService: {
    getCurrent: vi.fn(),
    getLatest: vi.fn(),
    getById: vi.fn(),
    dismiss: vi.fn(),
  },
}));

import whatsNewReducer, {
  closeReleaseViewer,
  dismissRelease,
  fetchLatestRelease,
  fetchReleaseById,
  openLatestReleaseViewer,
} from './whatsNewSlice';

const buildRelease = (overrides: Partial<ILatestWhatsNewRelease> = {}): ILatestWhatsNewRelease => ({
  id: 'release-a',
  title: 'Release A',
  body_markdown: '## Notes',
  published_at: '2026-09-01',
  changelog_url: null,
  preview_text: 'Notes',
  is_new: true,
  ...overrides,
});

const initialState = () => whatsNewReducer(undefined, { type: 'unknown' });

describe('whatsNewSlice', () => {
  describe('fetchLatestRelease', () => {
    it('should start idle', () => {
      expect(initialState().latestStatus).toBe('idle');
      expect(initialState().latestRelease).toBeNull();
    });

    it('should track loading, success and failure', () => {
      const release = buildRelease();

      const loading = whatsNewReducer(initialState(), fetchLatestRelease.pending('req', undefined));
      expect(loading.latestStatus).toBe('loading');

      const succeeded = whatsNewReducer(
        loading,
        fetchLatestRelease.fulfilled(release, 'req', undefined)
      );
      expect(succeeded.latestStatus).toBe('succeeded');
      expect(succeeded.latestRelease).toEqual(release);

      const failed = whatsNewReducer(loading, fetchLatestRelease.rejected(null, 'req', undefined));
      expect(failed.latestStatus).toBe('failed');
    });

    it('should record succeeded with a null release when nothing is published', () => {
      const state = whatsNewReducer(
        initialState(),
        fetchLatestRelease.fulfilled(null, 'req', undefined)
      );

      expect(state.latestStatus).toBe('succeeded');
      expect(state.latestRelease).toBeNull();
    });
  });

  describe('openLatestReleaseViewer', () => {
    const withLatest = (
      latest: ILatestWhatsNewRelease | null,
      current: IWhatsNewRelease | null = null
    ) => ({
      ...initialState(),
      latestRelease: latest,
      currentRelease: current,
    });

    it('should open the viewer with the latest release and show the badge for a release inside the window', () => {
      const latest = buildRelease({ is_new: true });

      const state = whatsNewReducer(withLatest(latest), openLatestReleaseViewer());

      expect(state.isViewedModalOpen).toBe(true);
      expect(state.viewedRelease).toEqual(latest);
      expect(state.viewedLoading).toBe(false);
      expect(state.viewedNotFound).toBe(false);
      expect(state.viewedShowNewBadge).toBe(true);
    });

    it('should hide the badge for a release older than the window', () => {
      const state = whatsNewReducer(
        withLatest(buildRelease({ is_new: false })),
        openLatestReleaseViewer()
      );

      expect(state.viewedShowNewBadge).toBe(false);
    });

    it('should dismiss on close only when the nav tag is currently showing this release', () => {
      const latest = buildRelease({ id: 'release-a' });

      const tagShowsIt = whatsNewReducer(withLatest(latest, latest), openLatestReleaseViewer());
      expect(tagShowsIt.viewedDismissOnClose).toBe(true);
    });

    it('should not dismiss when the release is already dismissed or expired (no nav tag)', () => {
      const state = whatsNewReducer(withLatest(buildRelease(), null), openLatestReleaseViewer());

      expect(state.viewedDismissOnClose).toBe(false);
    });

    it('should not dismiss when the nav tag is showing a different release', () => {
      const state = whatsNewReducer(
        withLatest(buildRelease({ id: 'release-a' }), buildRelease({ id: 'release-b' })),
        openLatestReleaseViewer()
      );

      expect(state.viewedDismissOnClose).toBe(false);
    });

    it('should do nothing when no latest release has loaded', () => {
      const state = whatsNewReducer(withLatest(null), openLatestReleaseViewer());

      expect(state.isViewedModalOpen).toBe(false);
      expect(state.viewedRelease).toBeNull();
    });

    it('should leave the nav tag state untouched', () => {
      const current = buildRelease();
      const state = whatsNewReducer(withLatest(current, current), openLatestReleaseViewer());

      expect(state.currentRelease).toEqual(current);
      expect(state.isModalOpen).toBe(false);
    });
  });

  describe('notification drawer flow is unchanged', () => {
    it('should reset the Help-only flags when the drawer opens a release by id', () => {
      const current = buildRelease();
      const openedFromHelp = whatsNewReducer(
        {
          ...initialState(),
          latestRelease: buildRelease({ is_new: false }),
          currentRelease: current,
        },
        openLatestReleaseViewer()
      );
      const openedFromHelpFlagged = {
        ...openedFromHelp,
        viewedShowNewBadge: false,
        viewedDismissOnClose: true,
      };

      const state = whatsNewReducer(
        openedFromHelpFlagged,
        fetchReleaseById.pending('req', 'release-a')
      );

      expect(state.viewedShowNewBadge).toBe(true);
      expect(state.viewedDismissOnClose).toBe(false);
      expect(state.isViewedModalOpen).toBe(true);
    });

    it('should only clear the open flag when the viewer closes', () => {
      const current = buildRelease();
      const open = whatsNewReducer(
        { ...initialState(), latestRelease: current, currentRelease: current },
        openLatestReleaseViewer()
      );

      const closed = whatsNewReducer(open, closeReleaseViewer());

      expect(closed.isViewedModalOpen).toBe(false);
      expect(closed.currentRelease).toEqual(current);
    });
  });

  describe('dismissRelease', () => {
    it('should optimistically clear the nav tag release', () => {
      const current = buildRelease();

      const state = whatsNewReducer(
        { ...initialState(), currentRelease: current, isModalOpen: true },
        dismissRelease.pending('req', current.id)
      );

      expect(state.currentRelease).toBeNull();
      expect(state.isModalOpen).toBe(false);
    });
  });
});
