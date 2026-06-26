/**
 * Edition-neutral contract for business-feature gating.
 *
 * The CE copy DEFINES this shape; the EE copy mirrors it verbatim. Shared code in `src/`
 * imports these types via the `@/worklenz-ee/*` alias, which the build swaps between the CE
 * stub directory (open-source) and the EE implementation directory (private).
 */

/** Variants the upgrade modal can open to. Mirrors the slice's `UpgradeModalVariant`. */
export type UpgradeModalVariant =
  | 'default'
  | 'customOrganizationLogo'
  | 'fileSizeLimit'
  | 'customFields';

export interface IBusinessFeatures {
  /** Client portal, project finance, slack, org logo, etc. */
  hasBusinessAccess: boolean;
  /** Strict business-plan check (excludes enterprise-only plan names). */
  isBusinessPlan: boolean;
  isEnterprisePlan: boolean;
  isFreeUser: boolean;
  isOnBusinessTrial: boolean;
  /** Days left in an active business-plan trial (0 when not on trial). */
  planTrialDaysRemaining: number;
  /** Billable-task toggle is restricted (Free / Pro / AppSumo). */
  shouldRestrictBillable: boolean;
}

export interface IUpgradePrompt {
  /** CE: opens the public pricing page. EE: opens the in-app upgrade modal. */
  promptUpgrade: (variant?: UpgradeModalVariant) => void;
  isUpgradeOpen: boolean;
}
