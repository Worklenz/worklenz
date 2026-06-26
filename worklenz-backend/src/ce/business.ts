import { IBusinessEdition } from "../business/types";

/**
 * CE (open-core) edition stub.
 *
 * No Business-plan routers are mounted, and gating is permissive: a self-hosted open-core
 * deployment has no SaaS subscription concept, so feature checks never restrict the user.
 * This file must not import any `src/ee/*` code.
 */
const ceBusiness: IBusinessEdition = {
  registerBusinessRoutes(): void {
    // No business routes in the open-core build.
  },
  registerBusinessPublicRoutes(): void {
    // No public business routes in the open-core build.
  },
  registerClientPortalRoutes(): void {
    // Client portal is a Business-plan feature; not available in open-core.
  },
  registerClientPortalSocketHandlers(): void {
    // Client portal socket events are a Business-plan feature; not available in open-core.
  },
  registerWebhooks(): void {
    // No payment webhooks in open-core (no billing provider).
  },
  startBackgroundJobs(): void {
    // No Business-plan background jobs in open-core.
  },
  featureGate: {
    // Open-core / self-hosted has no SaaS plan concept, so gating is permissive: every team
    // has "business" access (no seat/custom-field/billable limits are enforced).
    hasBusinessAccess(): boolean {
      return true;
    },
    async teamHasBusinessAccess(): Promise<boolean> {
      return true;
    },
    async isRestrictedFromProFeatures(): Promise<boolean> {
      return false;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async getTeamSubscription(): Promise<any> {
      // SELF_HOSTED-shaped record: the member controllers already treat this as unlimited
      // (self-hosted branch / team_member_limit_override), so no seat caps apply in open-core.
      return {
        subscription_type: "SELF_HOSTED",
        // Not "active": avoids the billing-provider seat-sync path in member controllers
        // (mirrors a real self-hosted record, which has no licensing subscription row).
        subscription_status: null,
        subscription_id: null,
        quantity: 0,
        business_plan_override: true,
        team_member_limit_override: true,
        active_plan_trial: null,
        plan_name: null,
        base_user_limit: null,
        is_custom: false,
        is_credit: false,
        is_ltd: false,
        ltd_users: "0",
        redeemed_codes_count: 0,
        current_count: "0",
        appsumo_business_eligible: false,
        effective_user_limit: null,
        trial_expire_date: null,
      };
    },
    async syncSeatCount(): Promise<unknown> {
      return null; // no billing provider in open-core
    },
  },
  slack: {
    async getChannelConfigsByProject(): Promise<any[]> {
      return []; // no Slack integration in open-core
    },
    async sendNotification(): Promise<void> {
      // no-op
    },
  },
};

export default ceBusiness;
