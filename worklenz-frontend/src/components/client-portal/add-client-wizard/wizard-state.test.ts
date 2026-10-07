import { describe, expect, it } from 'vitest';
import {
  INITIAL_WIZARD_STATE,
  WizardAction,
  WizardState,
  buildAddUserRequest,
  buildOnboardRequest,
  canContinue,
  canDeferInvite,
  getPersonErrors,
  getReviewSubject,
  getStepCount,
  wizardReducer,
} from './wizard-state';

const run = (actions: WizardAction[], from: WizardState = INITIAL_WIZARD_STATE) =>
  actions.reduce(wizardReducer, from);

const filledCompany = (): WizardState =>
  run([
    { type: 'selectMethod', method: 'company' },
    { type: 'next' },
    {
      type: 'updateCompany',
      patch: {
        companyName: ' Beacon Logistics ',
        firstName: ' Jane ',
        lastName: 'Doe',
        email: ' jane@beacon.io ',
      },
    },
  ]);

const filledUser = (): WizardState =>
  run([
    { type: 'selectMethod', method: 'user' },
    { type: 'next' },
    { type: 'selectUserCompany', company: { id: 'c1', name: 'Brandbase' } },
    { type: 'updateUser', patch: { firstName: 'Sam', email: 'sam@brandbase.com' } },
  ]);

describe('navigation', () => {
  it('starts on the method step with nothing chosen', () => {
    expect(INITIAL_WIZARD_STATE).toMatchObject({
      step: 1,
      method: null,
      sendInvite: true,
      delivery: 'email',
    });
  });

  it('has three steps, or two for a CSV which has no review', () => {
    expect(getStepCount('company')).toBe(3);
    expect(getStepCount('user')).toBe(3);
    expect(getStepCount('existing')).toBe(3);
    expect(getStepCount('csv')).toBe(2);
    expect(getStepCount(null)).toBe(3);
  });

  it('moves forward and back within the steps of the method', () => {
    const atDetails = run([{ type: 'selectMethod', method: 'company' }, { type: 'next' }]);
    expect(atDetails.step).toBe(2);
    expect(run([{ type: 'next' }, { type: 'next' }], atDetails).step).toBe(3);
    expect(run([{ type: 'next' }, { type: 'next' }, { type: 'next' }], atDetails).step).toBe(3);
    expect(run([{ type: 'back' }], atDetails).step).toBe(1);
    expect(run([{ type: 'back' }, { type: 'back' }], atDetails).step).toBe(1);
  });

  it('stops a CSV at its second step', () => {
    const state = run([
      { type: 'selectMethod', method: 'csv' },
      { type: 'next' },
      { type: 'next' },
    ]);

    expect(state.step).toBe(2);
  });

  it('keeps what was typed when going back and forward', () => {
    const state = run([{ type: 'next' }, { type: 'back' }, { type: 'next' }], filledCompany());

    expect(state.company.firstName).toBe(' Jane ');
  });

  it('resets everything', () => {
    expect(run([{ type: 'reset' }], filledCompany())).toEqual(INITIAL_WIZARD_STATE);
  });
});

describe('canContinue', () => {
  it('needs a method on step 1', () => {
    expect(canContinue(INITIAL_WIZARD_STATE)).toBe(false);
    expect(canContinue(run([{ type: 'selectMethod', method: 'csv' }]))).toBe(true);
  });

  it('needs a first name and a valid email for a new client, but not a company name', () => {
    const atDetails = run([{ type: 'selectMethod', method: 'company' }, { type: 'next' }]);

    expect(canContinue(atDetails)).toBe(false);
    expect(
      canContinue(run([{ type: 'updateCompany', patch: { firstName: 'Jane' } }], atDetails))
    ).toBe(false);
    expect(
      canContinue(
        run([{ type: 'updateCompany', patch: { firstName: 'Jane', email: 'nope' } }], atDetails)
      )
    ).toBe(false);
    expect(
      canContinue(
        run(
          [{ type: 'updateCompany', patch: { firstName: 'Jane', email: 'jane@x.io' } }],
          atDetails
        )
      )
    ).toBe(true);
    expect(
      canContinue(
        run([{ type: 'updateCompany', patch: { firstName: '  ', email: 'jane@x.io' } }], atDetails)
      )
    ).toBe(false);
  });

  it('needs a company for a new company user, as well as the person', () => {
    const noCompany = run([
      { type: 'selectMethod', method: 'user' },
      { type: 'next' },
      { type: 'updateUser', patch: { firstName: 'Sam', email: 'sam@x.io' } },
    ]);
    expect(canContinue(noCompany)).toBe(false);

    expect(
      canContinue(
        run([{ type: 'selectUserCompany', company: { id: 'c1', name: 'Brandbase' } }], noCompany)
      )
    ).toBe(true);
  });

  it('needs a chosen contact for an existing contact', () => {
    const atDetails = run([{ type: 'selectMethod', method: 'existing' }, { type: 'next' }]);

    expect(canContinue(atDetails)).toBe(false);
    expect(
      canContinue(
        run(
          [
            {
              type: 'selectExisting',
              contact: { id: 'u1', name: 'Alex', email: 'a@x.io', companyName: 'Avant' },
            },
          ],
          atDetails
        )
      )
    ).toBe(true);
  });

  it('needs rows for a CSV', () => {
    const atFile = run([{ type: 'selectMethod', method: 'csv' }, { type: 'next' }]);

    expect(canContinue(atFile)).toBe(false);
    expect(
      canContinue(
        run(
          [
            {
              type: 'setCsv',
              fileName: 'clients.csv',
              rows: [{ company: '', first_name: 'A', last_name: '', email: 'a@x.io' }],
            },
          ],
          atFile
        )
      )
    ).toBe(true);
  });

  it('lets the review step through', () => {
    expect(canContinue({ ...filledCompany(), step: 3 })).toBe(true);
  });
});

describe('selecting a company for a new user', () => {
  it('clears a template, which only makes sense for the company it was chosen for', () => {
    const withTemplate = run(
      [{ type: 'updateUser', patch: { template: 'full_partner' } }],
      filledUser()
    );

    const switched = run(
      [{ type: 'selectUserCompany', company: { id: 'c2', name: 'Avant' } }],
      withTemplate
    );

    expect(switched.user).toMatchObject({ companyId: 'c2', companyName: 'Avant', template: null });
  });

  it('can be undone with "Change"', () => {
    const cleared = run([{ type: 'selectUserCompany', company: null }], filledUser());

    expect(cleared.user).toMatchObject({ companyId: null, companyName: '' });
  });
});

describe('getPersonErrors', () => {
  const person = { firstName: '', lastName: '', email: '', jobTitle: '', phone: '' };

  it('tells a missing email from an invalid one', () => {
    expect(getPersonErrors(person)).toEqual({ firstName: true, email: 'missing' });
    expect(getPersonErrors({ ...person, firstName: 'A', email: 'nope' })).toEqual({
      firstName: false,
      email: 'invalid',
    });
    expect(getPersonErrors({ ...person, firstName: 'A', email: 'a@x.io' })).toEqual({
      firstName: false,
      email: null,
    });
  });
});

describe('getReviewSubject', () => {
  it('makes the first contact of a new client a POC, and names it from first and last name', () => {
    expect(getReviewSubject(filledCompany())).toEqual({
      name: 'Jane Doe',
      company: 'Beacon Logistics',
      email: 'jane@beacon.io',
      role: 'poc',
    });
  });

  it('has no company when none was typed', () => {
    const state = run([{ type: 'updateCompany', patch: { companyName: '  ' } }], filledCompany());

    expect(getReviewSubject(state)?.company).toBeNull();
  });

  it('follows the POC checkbox for a company user', () => {
    expect(getReviewSubject(filledUser())?.role).toBe('member');
    expect(
      getReviewSubject(run([{ type: 'updateUser', patch: { isPoc: true } }], filledUser()))?.role
    ).toBe('poc');
  });

  it('shows an existing contact without a role', () => {
    const state = run([
      { type: 'selectMethod', method: 'existing' },
      {
        type: 'selectExisting',
        contact: { id: 'u1', name: 'Alex Chen', email: 'a@x.io', companyName: 'Avant' },
      },
    ]);

    expect(getReviewSubject(state)).toEqual({
      name: 'Alex Chen',
      company: 'Avant',
      email: 'a@x.io',
      role: null,
    });
  });

  it('is empty for a CSV', () => {
    expect(getReviewSubject(run([{ type: 'selectMethod', method: 'csv' }]))).toBeNull();
  });
});

describe('canDeferInvite', () => {
  it('lets new records be saved without inviting, but an existing contact is always invited', () => {
    expect(canDeferInvite('company')).toBe(true);
    expect(canDeferInvite('user')).toBe(true);
    expect(canDeferInvite('existing')).toBe(false);
    expect(canDeferInvite('csv')).toBe(false);
    expect(canDeferInvite(null)).toBe(false);
  });
});

describe('buildOnboardRequest', () => {
  it('trims fields, drops empty ones and carries the invite choice', () => {
    expect(buildOnboardRequest(filledCompany(), 'Welcome!')).toEqual({
      company_name: 'Beacon Logistics',
      first_name: 'Jane',
      last_name: 'Doe',
      email: 'jane@beacon.io',
      phone: undefined,
      job_title: undefined,
      send_invite: true,
      delivery: 'email',
      welcome_message: 'Welcome!',
    });
  });

  it('leaves the welcome message out when it was unchecked', () => {
    const state = run(
      [
        { type: 'updateCompany', patch: { welcomeMessage: false } },
        { type: 'setSendInvite', value: false },
        { type: 'setDelivery', value: 'link' },
      ],
      filledCompany()
    );

    expect(buildOnboardRequest(state, 'Welcome!')).toMatchObject({
      welcome_message: null,
      send_invite: false,
      delivery: 'link',
    });
  });
});

describe('buildAddUserRequest', () => {
  it('sets a template on every current project of the company', () => {
    const state = run(
      [{ type: 'updateUser', patch: { template: 'standard_contact', isPoc: true } }],
      filledUser()
    );

    expect(buildAddUserRequest(state, ['p1', 'p2'])).toMatchObject({
      first_name: 'Sam',
      email: 'sam@brandbase.com',
      role: 'poc',
      project_access: [
        { project_id: 'p1', level: 'comment' },
        { project_id: 'p2', level: 'comment' },
      ],
    });
  });

  it('sends no access when no template was chosen, or the company has no projects', () => {
    expect(buildAddUserRequest(filledUser(), ['p1']).project_access).toEqual([]);
    expect(
      buildAddUserRequest(
        run([{ type: 'updateUser', patch: { template: 'full_partner' } }], filledUser()),
        []
      ).project_access
    ).toEqual([]);
  });

  it('defaults to a member', () => {
    expect(buildAddUserRequest(filledUser(), []).role).toBe('member');
  });
});
