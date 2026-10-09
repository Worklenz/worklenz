import type {
  AddCompanyUserRequest,
  CompanyUserRole,
  ImportRowInput,
  InviteDelivery,
  OnboardClientRequest,
} from '@/api/client-portal/company-users-api';
import {
  PERMISSION_TEMPLATES,
  PermissionTemplateKey,
  applyPermissionTemplate,
  toProjectAccessPayload,
} from '@/lib/client-portal/client-permissions';
import { isValidEmailAddress } from '@/pages/client-portal/clients/company-users/company-users-helpers';

/**
 * State of the Add Client wizard. Four methods (a new client, a user for an existing company, an
 * existing contact, a CSV import) each have their own details step and converge on one review step.
 */

export type WizardMethod = 'company' | 'user' | 'existing' | 'csv';
export type WizardStep = 1 | 2 | 3;

export interface PersonFields {
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  phone: string;
}

export interface NewClientFields extends PersonFields {
  companyName: string;
  /** "Set up their portal": post a welcome message to Messages. */
  welcomeMessage: boolean;
}

export interface CompanyUserFields extends PersonFields {
  companyId: string | null;
  companyName: string;
  isPoc: boolean;
  /** A Permission Template to apply across the company's current projects, if any. */
  template: PermissionTemplateKey | null;
}

/** The person chosen in "Invite an existing contact", kept so the review step can show them. */
export interface ExistingContactSnapshot {
  id: string;
  name: string;
  email: string;
  companyName: string;
}

export interface WizardState {
  step: WizardStep;
  method: WizardMethod | null;
  company: NewClientFields;
  user: CompanyUserFields;
  existing: ExistingContactSnapshot | null;
  sendInvite: boolean;
  delivery: InviteDelivery;
  csv: { fileName: string | null; rows: ImportRowInput[] };
}

const EMPTY_PERSON: PersonFields = {
  firstName: '',
  lastName: '',
  email: '',
  jobTitle: '',
  phone: '',
};

export const INITIAL_WIZARD_STATE: WizardState = {
  step: 1,
  method: null,
  company: { ...EMPTY_PERSON, companyName: '', welcomeMessage: true },
  user: { ...EMPTY_PERSON, companyId: null, companyName: '', isPoc: false, template: null },
  existing: null,
  // Inviting now is the common case; unchecking it saves the record without sending anything.
  sendInvite: true,
  delivery: 'email',
  csv: { fileName: null, rows: [] },
};

export type WizardAction =
  | { type: 'reset' }
  | { type: 'selectMethod'; method: WizardMethod }
  | { type: 'next' }
  | { type: 'back' }
  | { type: 'updateCompany'; patch: Partial<NewClientFields> }
  | { type: 'updateUser'; patch: Partial<CompanyUserFields> }
  | { type: 'selectUserCompany'; company: { id: string; name: string } | null }
  | { type: 'selectExisting'; contact: ExistingContactSnapshot | null }
  | { type: 'setSendInvite'; value: boolean }
  | { type: 'setDelivery'; value: InviteDelivery }
  | { type: 'setCsv'; fileName: string | null; rows: ImportRowInput[] };

/** A CSV import has no review step: its second step ends with the import itself. */
export const getStepCount = (method: WizardMethod | null): number => (method === 'csv' ? 2 : 3);

export const wizardReducer = (state: WizardState, action: WizardAction): WizardState => {
  switch (action.type) {
    case 'reset':
      return INITIAL_WIZARD_STATE;

    case 'selectMethod':
      return { ...state, method: action.method };

    case 'next':
      return state.step >= getStepCount(state.method)
        ? state
        : { ...state, step: (state.step + 1) as WizardStep };

    case 'back':
      return state.step <= 1 ? state : { ...state, step: (state.step - 1) as WizardStep };

    case 'updateCompany':
      return { ...state, company: { ...state.company, ...action.patch } };

    case 'updateUser':
      return { ...state, user: { ...state.user, ...action.patch } };

    case 'selectUserCompany':
      // A template applies to one company's projects, so it does not carry over to another.
      return {
        ...state,
        user: {
          ...state.user,
          companyId: action.company?.id ?? null,
          companyName: action.company?.name ?? '',
          template: null,
        },
      };

    case 'selectExisting':
      return { ...state, existing: action.contact };

    case 'setSendInvite':
      return { ...state, sendInvite: action.value };

    case 'setDelivery':
      return { ...state, delivery: action.value };

    case 'setCsv':
      return { ...state, csv: { fileName: action.fileName, rows: action.rows } };

    default:
      return state;
  }
};

/** Whether the email is filled in and looks like an email address. */
export const hasValidEmail = (email: string): boolean =>
  Boolean(email.trim()) && isValidEmailAddress(email);

export const getPersonErrors = (
  person: PersonFields
): { firstName: boolean; email: 'missing' | 'invalid' | null } => ({
  firstName: !person.firstName.trim(),
  email: !person.email.trim() ? 'missing' : isValidEmailAddress(person.email) ? null : 'invalid',
});

/** Whether "Continue" (or the final action of a two-step method) is available on the current step. */
export const canContinue = (state: WizardState): boolean => {
  if (state.step === 1) return state.method !== null;

  if (state.step === 2) {
    switch (state.method) {
      case 'company':
        return Boolean(state.company.firstName.trim()) && hasValidEmail(state.company.email);
      case 'user':
        return (
          state.user.companyId !== null &&
          Boolean(state.user.firstName.trim()) &&
          hasValidEmail(state.user.email)
        );
      case 'existing':
        return state.existing !== null;
      case 'csv':
        return state.csv.rows.length > 0;
      default:
        return false;
    }
  }

  return true;
};

export interface ReviewSubject {
  name: string;
  company: string | null;
  email: string;
  /** Not shown for an existing contact, whose role is already set. */
  role: CompanyUserRole | null;
}

const fullName = (person: PersonFields) =>
  [person.firstName, person.lastName]
    .map(part => part.trim())
    .filter(Boolean)
    .join(' ');

/** Who the review step is about, for the method that was chosen. */
export const getReviewSubject = (state: WizardState): ReviewSubject | null => {
  switch (state.method) {
    case 'company':
      return {
        name: fullName(state.company),
        // Without a company name the client is named after the person.
        company: state.company.companyName.trim() || null,
        email: state.company.email.trim(),
        // The first contact of a new company is its POC.
        role: 'poc',
      };
    case 'user':
      return {
        name: fullName(state.user),
        company: state.user.companyName || null,
        email: state.user.email.trim(),
        role: state.user.isPoc ? 'poc' : 'member',
      };
    case 'existing':
      return state.existing
        ? {
            name: state.existing.name,
            company: state.existing.companyName || null,
            email: state.existing.email,
            role: null,
          }
        : null;
    default:
      return null;
  }
};

/** Whether the "send invite now" choice applies: an existing contact is always invited. */
export const canDeferInvite = (method: WizardMethod | null): boolean =>
  method === 'company' || method === 'user';

const optional = (value: string): string | undefined => value.trim() || undefined;

export const buildOnboardRequest = (
  state: WizardState,
  welcomeMessageText: string
): OnboardClientRequest => ({
  company_name: optional(state.company.companyName),
  first_name: state.company.firstName.trim(),
  last_name: optional(state.company.lastName),
  email: state.company.email.trim(),
  phone: optional(state.company.phone),
  job_title: optional(state.company.jobTitle),
  send_invite: state.sendInvite,
  delivery: state.delivery,
  welcome_message: state.company.welcomeMessage ? welcomeMessageText : null,
});

/**
 * The template is applied here, over the company's projects as they are right now, and sent as an
 * explicit list, so the server only ever validates levels and never needs to know the templates.
 */
export const buildAddUserRequest = (
  state: WizardState,
  companyProjectIds: string[]
): AddCompanyUserRequest => {
  const template = PERMISSION_TEMPLATES.find(item => item.key === state.user.template);

  return {
    first_name: state.user.firstName.trim(),
    last_name: optional(state.user.lastName),
    email: state.user.email.trim(),
    phone: optional(state.user.phone),
    job_title: optional(state.user.jobTitle),
    role: state.user.isPoc ? 'poc' : 'member',
    project_access: template
      ? toProjectAccessPayload(applyPermissionTemplate(template, companyProjectIds))
      : [],
    send_invite: state.sendInvite,
    delivery: state.delivery,
  };
};
