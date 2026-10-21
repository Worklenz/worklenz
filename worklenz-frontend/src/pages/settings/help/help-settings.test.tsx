import userEvent from '@testing-library/user-event';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Same instance the page uses (it imports antd via this re-export, which
// resolves 'antd/es'); spying on `antd`'s own `message` would miss it.
import { ConfigProvider, message, theme } from '@/shared/antd-imports';

const { mockGetLatest, mockTrack, mockEnv } = vi.hoisted(() => ({
  mockGetLatest: vi.fn(),
  mockTrack: vi.fn(),
  mockEnv: { version: null as string | null },
}));

vi.mock('@/api/whats-new/whats-new.api.service', () => ({
  whatsNewApiService: {
    getCurrent: vi.fn(),
    getLatest: mockGetLatest,
    getById: vi.fn(),
    dismiss: vi.fn(),
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

vi.mock('@/hooks/useMixpanelTracking', () => ({
  useMixpanelTracking: () => ({ trackMixpanelEvent: mockTrack }),
}));

vi.mock('@/hooks/useDoumentTItle', () => ({ useDocumentTitle: vi.fn() }));

vi.mock('@/config/env', () => ({ getAppVersion: () => mockEnv.version }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

import whatsNewReducer from '@/features/whats-new/whatsNewSlice';
import { ILatestWhatsNewRelease } from '@/types/whats-new/whats-new.types';
import {
  evt_settings_help_item_click,
  evt_settings_help_visit,
} from '@/shared/worklenz-analytics-events';
import * as helpLinks from '@/shared/help-links-constants';
import HelpSettings from './help-settings';

type WhatsNewState = ReturnType<typeof whatsNewReducer>;

const RELEASE: ILatestWhatsNewRelease = {
  id: 'release-a',
  title: 'Release A',
  body_markdown: 'Notes',
  published_at: '2026-09-01',
  changelog_url: null,
  preview_text: 'Notes',
  is_new: true,
};

const renderHelp = (overrides: Partial<WhatsNewState> = {}, isDarkTheme = false) => {
  const store = configureStore({
    reducer: {
      whatsNewReducer,
      localesReducer: (state: { lng: string } = { lng: 'en' }) => state,
    },
    preloadedState: {
      whatsNewReducer: { ...whatsNewReducer(undefined, { type: 'init' }), ...overrides },
      localesReducer: { lng: 'en' },
    },
  });

  render(
    <Provider store={store}>
      <ConfigProvider theme={{ algorithm: isDarkTheme ? theme.darkAlgorithm : theme.defaultAlgorithm }}>
        <HelpSettings />
      </ConfigProvider>
    </Provider>
  );

  return store;
};

const succeeded = (latestRelease: ILatestWhatsNewRelease | null): Partial<WhatsNewState> => ({
  latestStatus: 'succeeded',
  latestRelease,
});

// Clicking a target=_blank link makes jsdom try to navigate; swallow it.
const clickWithoutNavigating = (element: HTMLElement) => {
  element.addEventListener('click', event => event.preventDefault());
  fireEvent.click(element);
};

const EXTERNAL_LINKS: Array<[label: string, url: string]> = [
  ['Documentation', helpLinks.WORKLENZ_DOCS_URL],
  ['Changelog', helpLinks.WORKLENZ_CHANGELOG_URL],
  ['YouTube', helpLinks.WORKLENZ_YOUTUBE_URL],
  ['Discord', helpLinks.WORKLENZ_DISCORD_URL],
  ['GitHub', helpLinks.WORKLENZ_GITHUB_URL],
  ['Facebook', helpLinks.WORKLENZ_FACEBOOK_URL],
  ['LinkedIn', helpLinks.WORKLENZ_LINKEDIN_URL],
  ['X', helpLinks.WORKLENZ_X_URL],
  ['Privacy policy', helpLinks.WORKLENZ_PRIVACY_POLICY_URL],
];

describe('HelpSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.version = null;
    mockGetLatest.mockResolvedValue({ done: true, body: RELEASE });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('layout', () => {
    it('should list every item in the spec order, in three groups split by dividers', () => {
      renderHelp(succeeded(RELEASE));

      const labels = [
        'Documentation',
        'Release notes',
        'Changelog',
        'Email support',
        'YouTube',
        'Discord',
        'GitHub',
        'Facebook',
        'LinkedIn',
        'X',
        'Privacy policy',
        'About',
      ];
      const elements = labels.map(label => screen.getByText(label));

      elements.slice(1).forEach((element, index) => {
        const previous = elements[index];
        expect(
          previous.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
      });
      expect(screen.getAllByRole('separator')).toHaveLength(2);
      expect(screen.getAllByRole('list')).toHaveLength(3);
    });

    it('should track a page visit', () => {
      renderHelp(succeeded(RELEASE));

      expect(mockTrack).toHaveBeenCalledWith(evt_settings_help_visit);
    });
  });

  describe.each([false, true])('theme and keyboard access (dark: %s)', isDarkTheme => {
    it('opens release notes using the keyboard', async () => {
      const user = userEvent.setup();
      const store = renderHelp(succeeded(RELEASE), isDarkTheme);

      await user.tab();
      expect(screen.getByRole('link', { name: /^Documentation/ })).toHaveFocus();
      await user.tab();
      expect(screen.getByRole('button', { name: 'Release notes' })).toHaveFocus();
      await user.keyboard('{Enter}');
      expect(store.getState().whatsNewReducer.isViewedModalOpen).toBe(true);
    });

    it('keeps unavailable release notes focusable and announces the reason', async () => {
      const user = userEvent.setup();
      const store = renderHelp(succeeded(null), isDarkTheme);

      await user.tab();
      await user.tab();
      const row = screen.getByRole('button', { name: 'Release notes. No release notes published yet' });
      expect(row).toHaveFocus();
      expect(row).toHaveAttribute('aria-disabled', 'true');
      await user.keyboard('{Enter}');
      expect(store.getState().whatsNewReducer.isViewedModalOpen).toBe(false);
    });
  });

  describe('external links', () => {
    it.each(EXTERNAL_LINKS)('%s opens in a new tab with noopener noreferrer', (label, url) => {
      renderHelp(succeeded(RELEASE));

      const link = screen.getByRole('link', { name: `${label} (opens in a new tab)` });

      expect(link).toHaveAttribute('href', url);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('should fire one item-click event per click, naming the item', () => {
      renderHelp(succeeded(RELEASE));

      clickWithoutNavigating(screen.getByRole('link', { name: /^Discord/ }));

      expect(mockTrack).toHaveBeenCalledWith(evt_settings_help_item_click, { item: 'discord' });
      expect(
        mockTrack.mock.calls.filter(([event]) => event === evt_settings_help_item_click)
      ).toHaveLength(1);
    });
  });

  describe('email support', () => {
    it('should link to the support mailbox with the subject prefilled', () => {
      renderHelp(succeeded(RELEASE));

      const link = screen.getByRole('link', { name: 'Email support (opens your email app)' });

      expect(link).toHaveAttribute('href', helpLinks.WORKLENZ_SUPPORT_MAILTO_URL);
      expect(link.getAttribute('href')).toContain('mailto:support@worklenz.com');
      expect(link.getAttribute('href')).toContain('subject=Worklenz%20support%20request');
    });

    it('should hand off to the mail app instead of opening a tab', () => {
      renderHelp(succeeded(RELEASE));

      const link = screen.getByRole('link', { name: /^Email support/ });

      expect(link).not.toHaveAttribute('target');
      expect(link).not.toHaveAttribute('rel');
      expect(link.querySelector('.anticon-export')).toBeNull();
    });

    it('should track the click', () => {
      renderHelp(succeeded(RELEASE));

      clickWithoutNavigating(screen.getByRole('link', { name: /^Email support/ }));

      expect(mockTrack).toHaveBeenCalledWith(evt_settings_help_item_click, {
        item: 'email_support',
      });
      expect(
        mockTrack.mock.calls.filter(([event]) => event === evt_settings_help_item_click)
      ).toHaveLength(1);
    });
  });

  describe('release notes row', () => {
    it('should open the release viewer with the latest release and track the click', () => {
      const store = renderHelp(succeeded(RELEASE));

      fireEvent.click(screen.getByRole('button', { name: /Release notes/ }));

      const state = store.getState().whatsNewReducer;
      expect(state.isViewedModalOpen).toBe(true);
      expect(state.viewedRelease).toEqual(RELEASE);
      expect(mockTrack).toHaveBeenCalledWith(evt_settings_help_item_click, {
        item: 'release_notes',
      });
    });

    it('should stay disabled, without opening or tracking, when nothing is published', () => {
      const store = renderHelp(succeeded(null));

      const row = screen.getByRole('button', {
        name: 'Release notes. No release notes published yet',
      });
      fireEvent.click(row);

      expect(row).toHaveAttribute('aria-disabled', 'true');
      expect(store.getState().whatsNewReducer.isViewedModalOpen).toBe(false);
      expect(mockTrack).not.toHaveBeenCalledWith(evt_settings_help_item_click, expect.anything());
    });

    it('should explain why it is disabled in a tooltip', async () => {
      renderHelp(succeeded(null));

      fireEvent.mouseEnter(screen.getByRole('button', { name: /Release notes/ }));

      expect(await screen.findByRole('tooltip')).toHaveTextContent(
        'No release notes published yet'
      );
    });

    it('should resolve after load: busy first, then enabled once the latest release arrives', async () => {
      renderHelp();

      const row = screen.getByRole('button', { name: /Release notes/ });
      expect(row).toBeDisabled();
      expect(row).toHaveAttribute('aria-busy', 'true');

      await waitFor(() => expect(row).toBeEnabled());
      expect(mockGetLatest).toHaveBeenCalledTimes(1);
    });

    it('should not block the rest of the page on the release fetch', () => {
      mockGetLatest.mockReturnValue(new Promise(() => {}));

      renderHelp();

      expect(screen.getByRole('link', { name: /Documentation/ })).toBeInTheDocument();
      expect(screen.getByText('About')).toBeInTheDocument();
    });

    it('should retry on click after a failed load and open once it succeeds', async () => {
      mockGetLatest
        .mockRejectedValueOnce(new Error('network'))
        .mockResolvedValueOnce({ done: true, body: RELEASE });

      const store = renderHelp();
      const row = screen.getByRole('button', { name: /Release notes/ });
      await waitFor(() => expect(store.getState().whatsNewReducer.latestStatus).toBe('failed'));

      fireEvent.click(row);

      await waitFor(() => expect(store.getState().whatsNewReducer.isViewedModalOpen).toBe(true));
      expect(mockGetLatest).toHaveBeenCalledTimes(2);
    });

    it('should show an error message when the retry fails too', async () => {
      const errorSpy = vi.spyOn(message, 'error').mockImplementation(() => ({}) as never);
      mockGetLatest.mockRejectedValue(new Error('network'));

      const store = renderHelp();
      await waitFor(() => expect(store.getState().whatsNewReducer.latestStatus).toBe('failed'));

      fireEvent.click(screen.getByRole('button', { name: /Release notes/ }));

      await waitFor(() => expect(errorSpy).toHaveBeenCalledTimes(1));
      expect(store.getState().whatsNewReducer.isViewedModalOpen).toBe(false);
    });
  });

  describe('About', () => {
    const valueFor = (term: string) =>
      screen.getByText(term).closest('dt')?.nextElementSibling?.textContent;

    it('should show the configured version', () => {
      mockEnv.version = '3.1.1';

      renderHelp(succeeded(RELEASE));

      expect(valueFor('Version')).toBe('3.1.1');
    });

    it('should show a dash when no version is configured', () => {
      renderHelp(succeeded(RELEASE));

      expect(valueFor('Version')).toBe('—');
    });

    it('should show the build date, localized to the app language', () => {
      vi.stubGlobal('__BUILD_TIMESTAMP__', String(new Date(2026, 8, 3, 12).getTime()));

      renderHelp(succeeded(RELEASE));

      expect(valueFor('Last updated')).toBe('September 3, 2026');
    });

    it('should show a dash when the build date is unavailable', () => {
      renderHelp(succeeded(RELEASE));

      expect(valueFor('Last updated')).toBe('—');
    });

    it('should not be interactive', () => {
      renderHelp(succeeded(RELEASE));

      expect(screen.getByText('About').closest('a, button')).toBeNull();
    });
  });
});
