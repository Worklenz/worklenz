import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import i18n from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import TimeOffCalendar from './TimeOffCalendar';
import zhSchedule from '../../../../public/locales/zh/schedule.json';

// Initialize a test i18n instance with zh translations
const testI18n = i18n.createInstance();
testI18n.use(initReactI18next).init({
  lng: 'zh',
  fallbackLng: 'en',
  resources: {
    zh: {
      schedule: zhSchedule,
    },
  },
  interpolation: {
    escapeValue: false,
  },
});

vi.mock('@/hooks/useAppSelector', () => ({
  useAppSelector: (selector: (state: any) => any) =>
    selector({
      themeReducer: { mode: 'light' },
    }),
}));

vi.mock('@/api/schedule/scheduleApi', () => ({
  useFetchTimeOffQuery: () => ({
    data: {
      body: [
        {
          id: 'to-1',
          team_member_id: 'member-1',
          member_name: 'chamika',
          member_email: 'chamika@ceydigital.com',
          start_date: '2026-09-17',
          end_date: '2026-09-19',
          reason: 'Doctor appointment',
          is_full_day: true,
          hours_off: null,
          type: 'sick',
          timezone: null,
        },
      ],
    },
    isLoading: false,
    refetch: vi.fn(),
  }),
  useCreateTimeOffMutation: () => [vi.fn(), { isLoading: false }],
  useUpdateTimeOffMutation: () => [vi.fn(), { isLoading: false }],
  useDeleteTimeOffMutation: () => [vi.fn(), { isLoading: false }],
}));

describe('TimeOffCalendar Localization', () => {
  const members = [
    { id: 'member-1', name: 'chamika', email: 'chamika@ceydigital.com' },
  ];

  it('renders localized modal title, form elements, and table columns in Chinese', async () => {
    render(
      <I18nextProvider i18n={testI18n}>
        <TimeOffCalendar
          visible={true}
          members={members}
          onClose={vi.fn()}
          preselectedMemberId="member-1"
        />
      </I18nextProvider>
    );

    // Modal title
    expect(screen.getByText('休假管理')).toBeInTheDocument();

    // Form labels
    expect(screen.getAllByText('团队成员').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('时长类型')).toBeInTheDocument();
    expect(screen.getAllByText('类型').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('原因 (可选)')).toBeInTheDocument();
    expect(screen.getAllByText('全天').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('部分时间')).toBeInTheDocument();

    // Buttons
    expect(screen.getByRole('button', { name: /创\s*建/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /取\s*消/ })).toBeInTheDocument();

    // Table elements
    expect(screen.getAllByText('持续时间').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('操作').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('病假')).toBeInTheDocument();
  });
});
