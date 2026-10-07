import { describe, expect, it } from 'vitest';
import reducer, { openAddCompanyUserDrawer, toggleAddClientDrawer } from './clients-slice';

const initial = () => reducer(undefined, { type: 'init' });

describe('Add Client drawer', () => {
  it('starts closed with no preset', () => {
    expect(initial()).toMatchObject({ isAddClientDrawerOpen: false, addClientPreset: null });
  });

  it('opens plain from the toggle', () => {
    const state = reducer(initial(), toggleAddClientDrawer());

    expect(state).toMatchObject({ isAddClientDrawerOpen: true, addClientPreset: null });
  });

  it('opens on "Add a client user" for a company', () => {
    const state = reducer(initial(), openAddCompanyUserDrawer({ id: 'c1', name: 'Brandbase' }));

    expect(state).toMatchObject({
      isAddClientDrawerOpen: true,
      addClientPreset: { method: 'user', company: { id: 'c1', name: 'Brandbase' } },
    });
  });

  it('forgets the preset when the drawer closes, so the next opening starts fresh', () => {
    const opened = reducer(initial(), openAddCompanyUserDrawer({ id: 'c1', name: 'Brandbase' }));

    const closed = reducer(opened, toggleAddClientDrawer());
    const reopened = reducer(closed, toggleAddClientDrawer());

    expect(closed).toMatchObject({ isAddClientDrawerOpen: false, addClientPreset: null });
    expect(reopened).toMatchObject({ isAddClientDrawerOpen: true, addClientPreset: null });
  });
});
