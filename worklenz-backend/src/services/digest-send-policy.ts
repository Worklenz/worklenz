export type DigestEmailType = "daily" | "weekly_start" | "weekly_end";

/**
 * Skip when personal sections are empty, except for Admins:
 * weekly emails still send because the admin table is included.
 * Daily also still sends for Admins (team overview totals).
 */
export const shouldSkipEmptyDigest = (
  hasPersonalContent: boolean,
  isAdmin: boolean
): boolean => {
  return !hasPersonalContent && !isAdmin;
};

export const isSuccessfulDigestSend = (result: string | null | undefined): boolean => {
  return typeof result === "string" && result.length > 0;
};

/**
 * Skip Monday's daily digest only when Weekly Start is also enabled at the same send time.
 * Different send times still deliver both emails. Daily resumes on Tuesday either way.
 */
export const skipDailyForMondayConflict = (
  weekday: number,
  weeklyStartEnabled: boolean,
  weeklyStartSendTime: string,
  dailySendTime: string
): boolean => {
  return weekday === 1 && weeklyStartEnabled && weeklyStartSendTime === dailySendTime;
};
