import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useNavigate } from 'react-router-dom';
import { renderPortal } from '@/test/renderPortal';
import { useUnsavedChangesGuard } from '../useUnsavedChangesGuard';

const Harness = ({ dirty, onLeave }: { dirty: boolean; onLeave: () => void }) => {
  const navigate = useNavigate();
  useUnsavedChangesGuard(dirty, onLeave);
  return <button onClick={() => navigate('/elsewhere')}>Go</button>;
};

describe('useUnsavedChangesGuard', () => {
  it('navigates straight away when nothing is unsaved', async () => {
    const user = userEvent.setup();
    renderPortal(<Harness dirty={false} onLeave={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Go' }));
    expect(await screen.findByTestId('elsewhere')).toBeInTheDocument();
    expect(screen.queryByText('Leave without saving?')).not.toBeInTheDocument();
  });

  it('asks first, and Stay keeps the person on the page', async () => {
    const user = userEvent.setup();
    const onLeave = vi.fn();
    renderPortal(<Harness dirty onLeave={onLeave} />);
    await user.click(screen.getByRole('button', { name: 'Go' }));
    expect(await screen.findByText('Leave without saving?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Stay' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/');
    expect(screen.queryByTestId('elsewhere')).not.toBeInTheDocument();
    expect(onLeave).not.toHaveBeenCalled();
  });

  it('Leave discards the draft and continues to where they were going', async () => {
    const user = userEvent.setup();
    const onLeave = vi.fn();
    renderPortal(<Harness dirty onLeave={onLeave} />);
    await user.click(screen.getByRole('button', { name: 'Go' }));
    await user.click(await screen.findByRole('button', { name: 'Leave' }));
    expect(await screen.findByTestId('elsewhere')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/elsewhere');
    expect(onLeave).toHaveBeenCalledTimes(1);
  });
});
