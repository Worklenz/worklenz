import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import memberReducer, { toggleInviteMemberDrawer } from '@/features/settings/member/memberSlice';
import { teamMembersApiService } from '@/api/team-members/teamMembers.api.service';
import { HomeWidgetProvider } from '../home-widgets/HomeWidgetContext';
import { HomeTeamMembersWidget } from './HomeTeamMembersWidget';

// No i18n instance in tests: resolve each key to its `defaultValue`, interpolating {{vars}}.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options: Record<string, string> = {}) =>
      (options.defaultValue ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) => options[name] ?? ''),
  }),
}));

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));

const session = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock('@/hooks/useAuth', () => ({ useAuthService: () => ({ getCurrentSession: () => session.current }) }));

vi.mock('@/api/team-members/teamMembers.api.service', () => ({ teamMembersApiService: { get: vi.fn() } }));

const get = vi.mocked(teamMembersApiService.get);

const members = [
  { id: 'm1', name: 'Alice Smith', email: 'alice@example.com', role_name: 'Admin', active: true },
  { id: 'm2', name: 'Bob Jones', email: 'bob@example.com', role_name: 'Member', active: true },
];

const renderWidget = () => {
  const store = configureStore({ reducer: { memberReducer } });
  render(
    <Provider store={store}>
      <HomeWidgetProvider
        value={{
          id: 'team-members',
          title: 'Team members',
          actions: { otherColumn: 'main', canRemove: true, onMoveToOtherColumn: () => {}, onRemove: () => {} },
        }}
      >
        <HomeTeamMembersWidget />
      </HomeWidgetProvider>
    </Provider>
  );
  const isDrawerOpen = () => store.getState().memberReducer.isInviteMemberDrawerOpen;
  const openMenu = (user: ReturnType<typeof userEvent.setup>) =>
    user.click(screen.getByRole('button', { name: 'Team members options' }));
  return { store, isDrawerOpen, openMenu };
};

beforeEach(() => {
  vi.clearAllMocks();
  get.mockResolvedValue({ done: true, body: { data: members, total: 2 } } as never);
});

describe('HomeTeamMembersWidget menu', () => {
  it.each([['Owner', { owner: true, role_name: 'Owner' }], ['Admin', { role_name: 'Admin' }]])(
    'gives %s an Invite Member action above the usual ones, which opens the invite drawer',
    async (_label, who) => {
      session.current = who;
      const user = userEvent.setup();
      const { isDrawerOpen, openMenu } = renderWidget();
      await screen.findByText('Alice Smith');
      await openMenu(user);

      expect(screen.getAllByRole('menuitem').map(item => item.textContent)).toEqual([
        'Invite Member',
        'Move to main area',
        'Remove widget',
      ]);

      expect(isDrawerOpen()).toBe(false);
      await user.click(screen.getByRole('menuitem', { name: 'Invite Member' }));
      expect(isDrawerOpen()).toBe(true);
    }
  );

  it('does not offer Invite Member to someone who cannot invite', async () => {
    session.current = { role_name: 'Member' };
    const user = userEvent.setup();
    const { openMenu } = renderWidget();
    await screen.findByText('Alice Smith');
    await openMenu(user);

    expect(screen.getAllByRole('menuitem').map(item => item.textContent)).toEqual(['Move to main area', 'Remove widget']);
  });

  it('is disabled while the subscription has expired', async () => {
    session.current = { role_name: 'Admin', is_expired: true };
    const user = userEvent.setup();
    const { isDrawerOpen, openMenu } = renderWidget();
    await screen.findByText('Alice Smith');
    await openMenu(user);

    const invite = screen.getByRole('menuitem', { name: 'Invite Member' });
    expect(invite).toHaveAttribute('aria-disabled', 'true');
    await user.click(invite);
    expect(isDrawerOpen()).toBe(false);
  });

  it('looks for the new member again once the invite drawer closes', async () => {
    session.current = { role_name: 'Admin' };
    const { store } = renderWidget();
    await screen.findByText('Alice Smith');
    expect(get).toHaveBeenCalledTimes(1);

    // Opened and closed as two separate events, as a person would, each one rendered.
    act(() => {
      store.dispatch(toggleInviteMemberDrawer());
    });
    expect(get).toHaveBeenCalledTimes(1);
    act(() => {
      store.dispatch(toggleInviteMemberDrawer());
    });
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
  });
});
