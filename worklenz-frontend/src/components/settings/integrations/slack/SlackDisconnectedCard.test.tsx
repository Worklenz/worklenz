import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SlackDisconnectedCard } from './SlackDisconnectedCard';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));
vi.mock('@/hooks/useAppDispatch', () => ({ useAppDispatch: () => vi.fn() }));

describe('SlackDisconnectedCard', () => {
  it('uses the shared Connect label and starts the Slack connection', async () => {
    const onConnect = vi.fn();
    render(<SlackDisconnectedCard loading={false} hasBusinessAccess onConnect={onConnect} />);
    await userEvent.click(screen.getByRole('button', { name: 'Connect' }));
    expect(onConnect).toHaveBeenCalledOnce();
  });
});
