import {
  shouldSkipEmptyDigest,
  isSuccessfulDigestSend,
  skipDailyForMondayConflict
} from "../services/digest-send-policy";

describe("digest-send-policy", () => {
  describe("shouldSkipEmptyDigest", () => {
    it("should not skip when user has personal content, regardless of admin status", () => {
      expect(shouldSkipEmptyDigest(true, false)).toBe(false);
      expect(shouldSkipEmptyDigest(true, true)).toBe(false);
    });

    it("should not skip for admins even when personal content is empty (delivers team summary)", () => {
      expect(shouldSkipEmptyDigest(false, true)).toBe(false);
    });

    it("should skip for non-admin users when personal content is empty", () => {
      expect(shouldSkipEmptyDigest(false, false)).toBe(true);
    });
  });

  describe("isSuccessfulDigestSend", () => {
    it("should return true for valid message or job ID strings", () => {
      expect(isSuccessfulDigestSend("msg_12345")).toBe(true);
      expect(isSuccessfulDigestSend("ok")).toBe(true);
    });

    it("should return false for empty string, null, or undefined", () => {
      expect(isSuccessfulDigestSend("")).toBe(false);
      expect(isSuccessfulDigestSend(null)).toBe(false);
      expect(isSuccessfulDigestSend(undefined)).toBe(false);
    });
  });

  describe("skipDailyForMondayConflict", () => {
    it("should skip Monday daily digest when weekly start is enabled and configured for same time", () => {
      expect(skipDailyForMondayConflict(1, true, "09:00", "09:00")).toBe(true);
    });

    it("should not skip if send times differ on Monday", () => {
      expect(skipDailyForMondayConflict(1, true, "08:00", "09:00")).toBe(false);
    });

    it("should not skip on Monday if weekly start is disabled", () => {
      expect(skipDailyForMondayConflict(1, false, "09:00", "09:00")).toBe(false);
    });

    it("should not skip on days other than Monday", () => {
      // 2 = Tuesday, 3 = Wednesday, 5 = Friday
      expect(skipDailyForMondayConflict(2, true, "09:00", "09:00")).toBe(false);
      expect(skipDailyForMondayConflict(3, true, "09:00", "09:00")).toBe(false);
      expect(skipDailyForMondayConflict(5, true, "09:00", "09:00")).toBe(false);
    });
  });
});
