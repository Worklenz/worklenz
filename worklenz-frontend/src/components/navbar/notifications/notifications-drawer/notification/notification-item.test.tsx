import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import NotificationItem from './notification-item';
import { IWorklenzNotification } from '@/types/notifications/notifications.types';

vi.mock('react-i18next', () => ({
  useTranslation: (namespace: string) => ({
    t: (key: string, options?: { reporter?: string; task?: string }) => {
      if (namespace === 'notifications' && key === 'taskAssigned') {
        return `<strong>${options?.reporter}</strong> vous a assigné à <strong>${options?.task}</strong>`;
      }

      return key;
    },
  }),
}));

vi.mock('@/utils/dateUtils', () => ({
  fromNow: () => 'a few seconds ago',
}));

const TEAM_NAME = 'Acme Team';

const buildNotification = (
  overrides: Partial<IWorklenzNotification> = {}
): IWorklenzNotification => ({
  id: 'notification-1',
  team: TEAM_NAME,
  team_id: 'team-1',
  message: '<b>Task assigned:</b> Write the report',
  created_at: new Date().toISOString(),
  ...overrides,
});

describe('NotificationItem team name', () => {
  it('shows the team name for a regular notification', () => {
    render(<NotificationItem notification={buildNotification()} />);

    expect(screen.getByText(TEAM_NAME)).toBeInTheDocument();
  });

  it("hides the team name for a What's New release notification", () => {
    render(
      <NotificationItem
        notification={buildNotification({
          message: "<b>What's New:</b> v3.1.2",
          release_id: 'v3.1.2-cloud',
        })}
      />
    );

    expect(screen.queryByText(TEAM_NAME)).not.toBeInTheDocument();
    expect(screen.getByText(/What's New:/)).toBeInTheDocument();
  });

  it('renders no team row when the team name is empty', () => {
    const { container } = render(<NotificationItem notification={buildNotification({ team: '' })} />);

    expect(container.querySelector('.anticon-bank')).not.toBeInTheDocument();
  });

  it('uses the selected-language template when the notification includes a message key', () => {
    render(
      <NotificationItem
        notification={buildNotification({
          message: '<strong>Alice</strong> has assigned you in <strong>Write the report</strong>',
          message_key: 'notifications.taskAssigned',
          message_params: { reporter: 'Alice', task: 'Write the report' },
        })}
      />
    );

    expect(
      screen.getByText(
        (_, element) => element?.classList.contains('mb-1') && element.textContent === 'Alice vous a assigné à Write the report'
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/has assigned you in/)).not.toBeInTheDocument();
  });
});
