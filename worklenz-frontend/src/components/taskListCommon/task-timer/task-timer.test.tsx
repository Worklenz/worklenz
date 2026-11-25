import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getByTask, popoverRender, trackMixpanelEvent, getCurrentSession, dispatch } = vi.hoisted(() => ({
  getByTask: vi.fn(),
  popoverRender: vi.fn(),
  trackMixpanelEvent: vi.fn(),
  getCurrentSession: vi.fn(),
  dispatch: vi.fn(),
}));

vi.mock('@/api/tasks/task-time-logs.api.service', () => ({
  taskTimeLogsApiService: { getByTask },
}));
vi.mock('@/hooks/useMixpanelTracking', () => ({
  useMixpanelTracking: () => ({ trackMixpanelEvent }),
}));
vi.mock('@/hooks/useAuth', () => ({
  useAuthService: () => ({ getCurrentSession }),
}));
vi.mock('@/hooks/useAppDispatch', () => ({
  useAppDispatch: () => dispatch,
}));
vi.mock('@/components/common/single-avatar/single-avatar', () => ({ default: () => null }));
vi.mock('@/i18n', () => ({ default: { language: 'en' } }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue || key,
  }),
}));
vi.mock('@/shared/antd-imports', async importOriginal => {
  const actual = await importOriginal<typeof import('@/shared/antd-imports')>();
  return {
    ...actual,
    Popover: (props: ComponentProps<typeof actual.Popover>) => {
      popoverRender(props.open);
      return <actual.Popover {...props} />;
    },
  };
});

import TaskTimer from './task-timer';

describe('task timer log activation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentSession.mockReturnValue({ subscription_type: 'PADDLE' });
    getByTask.mockResolvedValue({ done: true, body: { logs: [] } });
  });

  it.each(['click', 'Enter', 'Space'])('opens deferred logs on the first %s', async activation => {
    const user = userEvent.setup();
    render(<TaskTimer taskId="task-1" started={false} timeString="0m 0s" deferLogPopover />);
    expect(popoverRender).not.toHaveBeenCalled();
    expect(getByTask).not.toHaveBeenCalled();

    const trigger = screen.getByRole('button', { name: 'Time: 0m 0s' });
    if (activation === 'click') {
      await user.click(trigger);
    } else {
      trigger.focus();
      await user.keyboard(activation === 'Enter' ? '{Enter}' : ' ');
    }
    await waitFor(() => expect(getByTask).toHaveBeenCalledExactlyOnceWith('task-1'));
    expect(screen.getByRole('button', { name: 'Time: 0m 0s' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    await waitFor(() => expect(screen.getByText('Time Tracking Log')).toBeVisible());
    expect(screen.getByRole('button', { name: 'Time: 0m 0s' })).toHaveFocus();

    await user.click(document.body);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Time: 0m 0s' })).toHaveAttribute(
        'aria-expanded',
        'false'
      )
    );
    await user.click(screen.getByRole('button', { name: 'Time: 0m 0s' }));
    await waitFor(() => expect(getByTask).toHaveBeenCalledTimes(2));
  });

  it('keeps disabled rows inert and updates the displayed time without mounting a popup', async () => {
    const { rerender } = render(
      <TaskTimer taskId="task-1" started={false} timeString="0m 0s" deferLogPopover disabled />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Time: 0m 0s' }));
    rerender(
      <TaskTimer taskId="task-1" started={false} timeString="2m 3s" deferLogPopover disabled />
    );
    expect(screen.getByRole('button', { name: 'Time: 2m 3s' })).toBeDisabled();
    expect(popoverRender).not.toHaveBeenCalled();
    expect(getByTask).not.toHaveBeenCalled();
  });

  it('preserves the existing popup behavior for other timer consumers', async () => {
    const user = userEvent.setup();
    render(<TaskTimer taskId="task-1" started={false} timeString="0m 0s" />);
    expect(popoverRender).toHaveBeenCalledWith(false);
    expect(getByTask).not.toHaveBeenCalled();
    await user.click(screen.getByText('0m 0s'));
    await waitFor(() => expect(getByTask).toHaveBeenCalledExactlyOnceWith('task-1'));
  });

  it('reads the current session when starting the timer', async () => {
    const user = userEvent.setup();
    const handleStartTimer = vi.fn();
    getCurrentSession.mockReturnValue({ subscription_type: 'PADDLE' });
    render(
      <TaskTimer
        taskId="task-1"
        started={false}
        timeString="0m 0s"
        handleStartTimer={handleStartTimer}
      />
    );

    getCurrentSession.mockReturnValue({ subscription_type: 'FREE' });
    await user.click(screen.getAllByRole('button')[0]);

    expect(handleStartTimer).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ type: 'adminCenterReducer/toggleUpgradeModal' })
    );
  });

  it('reads the current session when opening the log popover', async () => {
    const user = userEvent.setup();
    getCurrentSession.mockReturnValue({ subscription_type: 'PADDLE' });
    render(<TaskTimer taskId="task-1" started={false} timeString="0m 0s" deferLogPopover />);

    getCurrentSession.mockReturnValue({ subscription_type: 'FREE' });
    await user.click(screen.getByRole('button', { name: 'Time: 0m 0s' }));

    expect(getByTask).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ type: 'adminCenterReducer/toggleUpgradeModal' })
    );
  });

});
