import { describe, expect, it } from 'vitest';
import {
  INITIAL_WIZARD_STATE,
  WizardAction,
  WizardState,
  buildAddClientRequest,
  canContinue,
  getEffectiveRole,
  getOrganizationLabel,
  wizardReducer,
} from './wizard-state';

const run = (actions: WizardAction[], from: WizardState = INITIAL_WIZARD_STATE): WizardState =>
  actions.reduce(wizardReducer, from);

const newOrganizationDetails: WizardAction[] = [
  { type: 'selectMethod', method: 'new_organization' },
  { type: 'next' },
  { type: 'setOrganizationName', value: '  Beacon Logistics ' },
  { type: 'setPerson', field: 'firstName', value: ' Jane ' },
  { type: 'setPerson', field: 'lastName', value: 'Doe' },
  { type: 'setPerson', field: 'email', value: ' jane@beacon.example ' },
];

describe('add client wizard state', () => {
  it('needs a method before moving past step 1', () => {
    expect(canContinue(INITIAL_WIZARD_STATE)).toBe(false);
    expect(wizardReducer(INITIAL_WIZARD_STATE, { type: 'next' }).step).toBe(1);
    expect(run([{ type: 'selectMethod', method: 'new_organization' }, { type: 'next' }]).step).toBe(2);
  });

  it('needs organization, first name and a valid email on step 2', () => {
    let state = run([{ type: 'selectMethod', method: 'new_organization' }, { type: 'next' }]);
    expect(canContinue(state)).toBe(false);

    state = run(
      [
        { type: 'setOrganizationName', value: 'Beacon' },
        { type: 'setPerson', field: 'firstName', value: 'Jane' },
        { type: 'setPerson', field: 'email', value: 'not-an-email' },
      ],
      state
    );
    expect(canContinue(state)).toBe(false);
    expect(wizardReducer(state, { type: 'next' }).step).toBe(2);

    state = wizardReducer(state, { type: 'setPerson', field: 'email', value: 'jane@beacon.example' });
    expect(canContinue(state)).toBe(true);
  });

  it('asks for a chosen organization, not a name, when adding to an existing one', () => {
    let state = run([
      { type: 'selectMethod', method: 'existing_organization' },
      { type: 'next' },
      { type: 'setPerson', field: 'firstName', value: 'Sam' },
      { type: 'setPerson', field: 'email', value: 'sam@acme.example' },
    ]);
    expect(canContinue(state)).toBe(false);

    state = wizardReducer(state, { type: 'selectOrganization', organization: { id: 'org-1', name: 'Acme' } });
    expect(canContinue(state)).toBe(true);
    expect(getOrganizationLabel(state)).toBe('Acme');
  });

  it('clears the project selection when the method or organization changes', () => {
    let state = run([
      { type: 'selectMethod', method: 'existing_organization' },
      { type: 'selectOrganization', organization: { id: 'org-1', name: 'Acme' } },
      { type: 'toggleProject', projectId: 'p1' },
      { type: 'toggleProject', projectId: 'p2' },
    ]);
    expect(state.projectIds).toEqual(['p1', 'p2']);

    state = wizardReducer(state, { type: 'toggleProject', projectId: 'p1' });
    expect(state.projectIds).toEqual(['p2']);

    expect(wizardReducer(state, { type: 'selectOrganization', organization: { id: 'org-2', name: 'Other' } }).projectIds).toEqual([]);
    expect(wizardReducer(state, { type: 'selectMethod', method: 'new_organization' }).projectIds).toEqual([]);
    // Picking the same method again keeps what was chosen.
    expect(wizardReducer(state, { type: 'selectMethod', method: 'existing_organization' })).toBe(state);
  });

  it('makes the first user of a new organization a Client Admin whatever role was picked', () => {
    const state = run([...newOrganizationDetails, { type: 'setRole', role: 'viewer' }]);
    expect(getEffectiveRole(state)).toBe('admin');
    expect(buildAddClientRequest(state)).not.toHaveProperty('role');
  });

  it('opens on the user details when started from an organization', () => {
    const state = wizardReducer(INITIAL_WIZARD_STATE, {
      type: 'startForOrganization',
      organization: { id: 'org-1', name: 'Acme' },
    });
    expect(state).toMatchObject({ step: 2, method: 'existing_organization', organization: { id: 'org-1', name: 'Acme' } });
  });

  it('builds the request for a new organization, trimming text and leaving out blanks', () => {
    const state = run([...newOrganizationDetails, { type: 'toggleProject', projectId: 'p1' }]);
    expect(buildAddClientRequest(state)).toEqual({
      method: 'new_organization',
      organization_name: 'Beacon Logistics',
      first_name: 'Jane',
      last_name: 'Doe',
      email: 'jane@beacon.example',
      project_ids: ['p1'],
      send_invitation: true,
    });
  });

  it('builds the request for an existing organization with the chosen role and no invitation', () => {
    const state = run([
      { type: 'selectMethod', method: 'existing_organization' },
      { type: 'selectOrganization', organization: { id: 'org-1', name: 'Acme' } },
      { type: 'setPerson', field: 'firstName', value: 'Sam' },
      { type: 'setPerson', field: 'email', value: 'sam@acme.example' },
      { type: 'setPerson', field: 'jobTitle', value: 'Designer' },
      { type: 'setPerson', field: 'phone', value: '+1 415 555 0142' },
      { type: 'setRole', role: 'viewer' },
      { type: 'setSendInvitation', value: false },
    ]);
    expect(buildAddClientRequest(state)).toEqual({
      method: 'existing_organization',
      organization_id: 'org-1',
      first_name: 'Sam',
      email: 'sam@acme.example',
      phone: '+1 415 555 0142',
      job_title: 'Designer',
      role: 'viewer',
      project_ids: [],
      send_invitation: false,
    });
  });

  it('goes back one step at a time and resets to the start', () => {
    let state = run([...newOrganizationDetails, { type: 'next' }]);
    expect(state.step).toBe(3);
    state = wizardReducer(state, { type: 'back' });
    expect(state.step).toBe(2);
    expect(wizardReducer(INITIAL_WIZARD_STATE, { type: 'back' }).step).toBe(1);
    expect(wizardReducer(state, { type: 'reset' })).toEqual(INITIAL_WIZARD_STATE);
  });
});
