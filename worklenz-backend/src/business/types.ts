import { Application, Router } from "express";

/**
 * Edition seam contract.
 *
 * The CE implementation (`src/ce/business.ts`) ships in the open-source build and disables all
 * Business-plan features. The EE implementation (`src/ee/business.ts`) lives only in the private
 * repo and wires up the real routers and gating. The active implementation is chosen at runtime
 * by `src/business/index.ts` based on the `EDITION` env var.
 */

/** Minimal shape of the per-team subscription data used for gating decisions. */
export interface ISubscriptionGateData {
  subscription_type?: string | null;
  plan_name?: string | null;
  is_ltd?: boolean | null;
  [key: string]: unknown;
}

export interface IFeatureGate {
  /** Whether the given user/session has Business-plan feature access. */
  hasBusinessAccess(user: unknown): boolean;
  /**
   * Whether the team has Business-plan access, resolved from its stored subscription.
   * Returns `true` when there is no team/subscription data (no limit to enforce) so callers
   * can gate quota checks on a single value. CE always returns `true` (self-hosted = unlimited).
   */
  teamHasBusinessAccess(teamId: string | null | undefined): Promise<boolean>;
  /** Whether the team is restricted from Pro-plan features (billable, etc.). */
  isRestrictedFromProFeatures(teamId: string | null | undefined): Promise<boolean>;
  /**
   * Per-team subscription data used by seat-limit enforcement in the member controllers.
   * EE returns the real Paddle/licensing record; CE returns a SELF_HOSTED-shaped record so the
   * controllers' existing self-hosted / limit-override branches bypass all seat enforcement.
   * Returns `any` to match the loosely-typed subscription record the controllers consume.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getTeamSubscription(teamId: string | null | undefined): Promise<any>;
  /** Sync the paid seat count with the billing provider. CE is a no-op. */
  syncSeatCount(subscriptionId: string, quantity: number): Promise<unknown>;
}

/** Slack integration surface used by core notification dispatch. CE is inert. */
export interface IBusinessSlack {
  /** Channel configs for a project; CE returns []. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getChannelConfigsByProject(projectId: string): Promise<any[]>;
  /** Send a Slack notification; CE is a no-op. */
  sendNotification(
    channelConfigId: string,
    notificationType: string,
    entityType: string,
    entityId: string,
    message: Record<string, unknown>
  ): Promise<void>;
}

export interface IBusinessEdition {
  /** EE: mounts business routers (slack, client-portal, finance, billing, …). CE: no-op. */
  registerBusinessRoutes(api: Router): void;
  /** EE: mounts public (unauthenticated) business routes, e.g. Slack OAuth callback. CE: no-op. */
  registerBusinessPublicRoutes(router: Router): void;
  /**
   * EE: mounts the client-portal app (own auth, own base path /api/client-portal) on the Express
   * application. CE: no-op (client portal is a Business-plan feature).
   */
  registerClientPortalRoutes(app: Application): void;
  /**
   * EE: registers client-portal socket.io event handlers (chat, client connect).
   * CE: no-op (client portal is a Business-plan feature).
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerClientPortalSocketHandlers(io: any, socket: any): void;
  /**
   * EE: mounts payment/billing webhooks that must live outside the authenticated API router
   * (e.g. DirectPay card-response). CE: no-op.
   */
  registerWebhooks(app: Application): void;
  /**
   * EE: starts background/cron jobs that are Business-plan-only (e.g. plan-trial expiration).
   * CE: no-op.
   */
  startBackgroundJobs(): void;
  /** Server-side plan gating. CE returns "unrestricted" (self-hosted core has no SaaS plans). */
  featureGate: IFeatureGate;
  /** Slack integration; CE is inert (no configs, no sends). */
  slack: IBusinessSlack;
}
