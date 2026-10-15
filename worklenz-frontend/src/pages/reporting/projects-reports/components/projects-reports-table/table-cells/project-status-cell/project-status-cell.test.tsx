import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ProjectStatusCell from './project-status-cell';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/hooks/useAppDispatch', () => ({
  useAppDispatch: () => vi.fn(),
}));

vi.mock('@/hooks/useAppSelector', () => ({
  useAppSelector: (
    selector: (state: {
      projectStatusesReducer: {
        projectStatuses: Array<{
          id: string;
          name: string;
          color_code: string;
          icon: string;
        }>;
      };
    }) => unknown
  ) =>
    selector({
      projectStatusesReducer: {
        projectStatuses: [
          {
            id: 'active',
            name: 'Active',
            color_code: '#1890ff',
            icon: 'check',
          },
        ],
      },
    }),
}));

vi.mock('@/socket/socketContext', () => ({
  useSocket: () => ({ socket: null }),
}));

vi.mock('@/utils/projectUtils', () => ({
  getStatusIcon: () => null,
}));

describe('ProjectStatusCell', () => {
  it('renders the status selector with an outlined border', () => {
    const { container } = render(
      <ProjectStatusCell currentStatus="active" projectId="project-1" />
    );

    const statusSelector = container.querySelector('.ant-select');

    expect(statusSelector).toHaveClass('ant-select-outlined');
    expect(statusSelector).not.toHaveClass('ant-select-borderless');
  });
});
