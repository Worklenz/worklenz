interface ISubscriptionDataForLimits {
  effective_user_limit?: number | string | null;
  quantity?: number | string | null;
  is_ltd?: boolean | null;
  ltd_users?: number | string | null;
  billing_provider?: string | null;
  plan_name?: string | null;
}

const parsePositiveInt = (value: unknown): number => {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? parseInt(value, 10)
        : NaN;

  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
};

export const getTeamMemberSeatLimit = (
  subscriptionData: ISubscriptionDataForLimits | null | undefined,
  defaultLimit = 25,
): number => {
  // Per-user Paddle Billing plans are sold by seat: the purchased quantity is the limit, with no
  // free floor. Lifetime/AppSumo seats still stack on top, as below.
  if (subscriptionData?.billing_provider === "paddle_billing") {
    const purchasedSeats = parsePositiveInt(subscriptionData?.quantity);
    if (purchasedSeats > 0) {
      const ltdSeats =
        subscriptionData?.is_ltd === true ? parsePositiveInt(subscriptionData?.ltd_users) : 0;
      // AppSumo Expansion seats are bought on top of the codes' own seats, so they add up.
      const isExpansion = /expansion/i.test(String(subscriptionData?.plan_name ?? ""));
      return isExpansion ? purchasedSeats + ltdSeats : Math.max(purchasedSeats, ltdSeats);
    }
  }

  const effectiveUserLimit = parsePositiveInt(
    subscriptionData?.effective_user_limit,
  );
  const quantityLimit = parsePositiveInt(subscriptionData?.quantity);

  // Lifetime/AppSumo codes can grant extra member capacity; keep that entitlement
  // even when the org is on an active paid subscription.
  const ltdLimit =
    subscriptionData?.is_ltd === true
      ? parsePositiveInt(subscriptionData?.ltd_users)
      : 0;

  return Math.max(defaultLimit, effectiveUserLimit, quantityLimit, ltdLimit);
};

