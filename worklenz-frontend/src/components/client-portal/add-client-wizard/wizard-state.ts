import type { AddClientRequest, ClientRole } from '@/types/client-portal/v2';
import { isValidEmailAddress } from '@/components/client-portal/v2/validation';

/**
 * State of the Add Client wizard: two ways in (a new organization, or another user for an existing
 * one) that share one ending (project access, review, "send the invitation now").
 */

export type WizardMethod = 'new_organization' | 'existing_organization';
export type WizardStep = 1 | 2 | 3;

export interface WizardState {
  step: WizardStep;
  method: WizardMethod | null;
  /** New organization: the name to create. */
  organizationName: string;
  /** Existing organization: the chosen one, kept with its name so the review step can show it. */
  organization: { id: string; name: string } | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  jobTitle: string;
  /** Only chosen for an existing organization; the first user of a new one is always a Client Admin. */
  role: ClientRole;
  projectIds: string[];
  sendInvitation: boolean;
}

export const INITIAL_WIZARD_STATE: WizardState = {
  step: 1,
  method: null,
  organizationName: '',
  organization: null,
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  jobTitle: '',
  role: 'member',
  projectIds: [],
  sendInvitation: true,
};

export type PersonField = 'firstName' | 'lastName' | 'email' | 'phone' | 'jobTitle';

export type WizardAction =
  | { type: 'selectMethod'; method: WizardMethod }
  | { type: 'setOrganizationName'; value: string }
  | { type: 'selectOrganization'; organization: { id: string; name: string } | null }
  | { type: 'setPerson'; field: PersonField; value: string }
  | { type: 'setRole'; role: ClientRole }
  | { type: 'toggleProject'; projectId: string }
  | { type: 'setSendInvitation'; value: boolean }
  /** Opened from an organization's workspace: skip the choice of method and organization. */
  | { type: 'startForOrganization'; organization: { id: string; name: string } }
  | { type: 'next' }
  | { type: 'back' }
  | { type: 'reset' };

/** The ending of the flow is the same for both methods, so these checks decide when each step is complete. */
export const canContinue = (state: WizardState): boolean => {
  if (state.step === 1) return state.method !== null;

  if (state.step === 2) {
    const hasOrganization =
      state.method === 'new_organization' ? state.organizationName.trim() !== '' : state.organization !== null;
    return hasOrganization && state.firstName.trim() !== '' && isValidEmailAddress(state.email);
  }

  return true;
};

/** The first user of a new organization is a Client Admin; anyone else gets the role that was picked. */
export const getEffectiveRole = (state: WizardState): ClientRole =>
  state.method === 'new_organization' ? 'admin' : state.role;

export const getFullName = (state: Pick<WizardState, 'firstName' | 'lastName'>): string =>
  `${state.firstName.trim()} ${state.lastName.trim()}`.trim();

export const getOrganizationLabel = (state: WizardState): string =>
  state.method === 'new_organization' ? state.organizationName.trim() : (state.organization?.name ?? '');

export const wizardReducer = (state: WizardState, action: WizardAction): WizardState => {
  switch (action.type) {
    case 'selectMethod':
      // A different method offers different projects, so the selection starts again.
      return action.method === state.method
        ? state
        : { ...state, method: action.method, organization: null, projectIds: [] };
    case 'setOrganizationName':
      return { ...state, organizationName: action.value };
    case 'selectOrganization':
      return { ...state, organization: action.organization, projectIds: [] };
    case 'setPerson':
      return { ...state, [action.field]: action.value };
    case 'setRole':
      return { ...state, role: action.role };
    case 'toggleProject':
      return {
        ...state,
        projectIds: state.projectIds.includes(action.projectId)
          ? state.projectIds.filter(id => id !== action.projectId)
          : [...state.projectIds, action.projectId],
      };
    case 'setSendInvitation':
      return { ...state, sendInvitation: action.value };
    case 'startForOrganization':
      return {
        ...INITIAL_WIZARD_STATE,
        method: 'existing_organization',
        organization: action.organization,
        step: 2,
      };
    case 'next':
      return canContinue(state) && state.step < 3 ? { ...state, step: (state.step + 1) as WizardStep } : state;
    case 'back':
      return state.step > 1 ? { ...state, step: (state.step - 1) as WizardStep } : state;
    case 'reset':
      return INITIAL_WIZARD_STATE;
    default:
      return state;
  }
};

/** The one request that finishes the wizard. The server does it all in a single transaction. */
export const buildAddClientRequest = (state: WizardState): AddClientRequest => {
  const isNewOrganization = state.method === 'new_organization';
  const lastName = state.lastName.trim();
  const phone = state.phone.trim();
  const jobTitle = state.jobTitle.trim();

  return {
    method: isNewOrganization ? 'new_organization' : 'existing_organization',
    ...(isNewOrganization
      ? { organization_name: state.organizationName.trim() }
      : { organization_id: state.organization?.id }),
    first_name: state.firstName.trim(),
    ...(lastName ? { last_name: lastName } : {}),
    email: state.email.trim(),
    ...(phone ? { phone } : {}),
    ...(jobTitle ? { job_title: jobTitle } : {}),
    ...(isNewOrganization ? {} : { role: state.role }),
    project_ids: state.projectIds,
    send_invitation: state.sendInvitation,
  };
};
