import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { ConfigProvider, theme } from 'antd';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import enTranslations from '../../../../public/locales/en/all-project-list.json';
import itTranslations from '../../../../public/locales/it/all-project-list.json';
import ProjectGroupList from './project-group-list';
import { GroupedProject } from '@/types/project/project.types';

vi.mock('@/api/projects/projects.v1.api.service', () => ({
  useToggleFavoriteProjectMutation: () => [vi.fn().mockReturnValue({ unwrap: vi.fn() })],
}));

vi.mock('@/hooks/useAppSelector', () => ({
  useAppSelector: (selector: (state: any) => any) => {
    const mockState = {
      projectsReducer: { groupedRequestParams: {} },
      projectListFieldsReducer: { fields: [] },
      themeReducer: { mode: 'light' },
    };
    return selector(mockState);
  },
}));

vi.mock('@/hooks/useAppDispatch', () => ({
  useAppDispatch: () => vi.fn(),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuthService: () => ({
    isOwnerOrAdmin: () => true,
  }),
}));

vi.mock('@/hooks/useMixpanelTracking', () => ({
  useMixpanelTracking: () => ({
    trackMixpanelEvent: vi.fn(),
  }),
}));

vi.mock('@/utils/errorLogger', () => ({
  default: { error: vi.fn() },
}));

afterEach(cleanup);

const mockStore = configureStore({
  reducer: {
    dummy: (state = {}) => state,
  },
});

const mockGroups: GroupedProject[] = [
  {
    groupKey: 'high',
    groupName: 'High',
    groupColor: '#ff4d4f',
    count: 1,
    totalProgress: 0,
    totalTasks: 1,
    projects: [
      { id: 'p1', name: 'Alpha Project', color_code: '#1890ff', status: 'In Progress' } as any,
    ],
  },
  {
    groupKey: 'medium',
    groupName: '', // Unnamed group test
    groupColor: '#faad14',
    count: 2,
    totalProgress: 0,
    totalTasks: 2,
    projects: [
      { id: 'p2', name: 'Beta Project', color_code: '#52c41a', status: 'Done' } as any,
      { id: 'p3', name: 'Gamma Project', color_code: '#722ed1', status: 'Todo' } as any,
    ],
  },
];

const renderGroupList = async (lng = 'en', dark = false) => {
  const instance = createInstance();
  await instance.init({
    lng,
    fallbackLng: false,
    defaultNS: 'all-project-list',
    resources: {
      en: { 'all-project-list': enTranslations },
      it: { 'all-project-list': itTranslations },
    },
  });

  render(
    <Provider store={mockStore}>
      <I18nextProvider i18n={instance}>
        <ConfigProvider theme={{ algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm }}>
          <ProjectGroupList
            groups={mockGroups}
            navigate={vi.fn()}
            onProjectSelect={vi.fn()}
            onArchive={vi.fn()}
            isOwnerOrAdmin={true}
            loading={false}
          />
        </ConfigProvider>
      </I18nextProvider>
    </Provider>
  );

  return { instance };
};

describe('ProjectGroupList Localization', () => {
  it('renders English text for group controls, counts, and unnamed groups', async () => {
    await renderGroupList('en', false);

    expect(screen.getByRole('button', { name: 'Expand All' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collapse All' })).toBeInTheDocument();
    expect(screen.getByText('Unnamed Group')).toBeInTheDocument();
    expect(screen.getByText('1 project')).toBeInTheDocument();
    expect(screen.getByText('2 projects')).toBeInTheDocument();
  });

  it('renders Italian text for group controls, counts, and unnamed groups', async () => {
    await renderGroupList('it', false);

    expect(screen.getByRole('button', { name: 'Espandi tutto' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Comprimi tutto' })).toBeInTheDocument();
    expect(screen.getByText('Gruppo senza nome')).toBeInTheDocument();
    expect(screen.getByText('1 progetto')).toBeInTheDocument();
    expect(screen.getByText('2 progetti')).toBeInTheDocument();
  });

  it('supports dark mode theming without breaking localized labels', async () => {
    await renderGroupList('it', true);

    expect(screen.getByRole('button', { name: 'Espandi tutto' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Comprimi tutto' })).toBeInTheDocument();
    expect(screen.getByText('Gruppo senza nome')).toBeInTheDocument();
    expect(screen.getByText('1 progetto')).toBeInTheDocument();
    expect(screen.getByText('2 progetti')).toBeInTheDocument();
  });

  it('collapses and expands all groups with translated action buttons', async () => {
    await renderGroupList('it', false);

    expect(screen.getByText('Alpha Project')).toBeInTheDocument();

    const collapseAllBtn = screen.getByRole('button', { name: 'Comprimi tutto' });
    fireEvent.click(collapseAllBtn);

    expect(screen.queryByText('Alpha Project')).not.toBeInTheDocument();

    const expandAllBtn = screen.getByRole('button', { name: 'Espandi tutto' });
    fireEvent.click(expandAllBtn);

    expect(screen.getByText('Alpha Project')).toBeInTheDocument();
  });
});
