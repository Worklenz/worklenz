interface ISubscriptionDataForLimits {
  effective_user_limit?: number | string | null;
  quantity?: number | string | null;
  is_ltd?: boolean | null;
  ltd_users?: number | string | null;
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

