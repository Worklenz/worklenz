// jest.config.js sets automock: true repo-wide - unmock explicitly so these pure functions run for real.
jest.unmock("../shared/home-pins");

import {
  buildPinLimitReachedBody,
  HOME_PIN_LIMIT,
  isPinLimitReached,
  PIN_LIMIT_REACHED_CODE,
} from "../shared/home-pins";

describe("home pin limit", () => {
  it("is 25", () => {
    expect(HOME_PIN_LIMIT).toBe(25);
  });

  it("is reached exactly when the user already holds the limit", () => {
    expect(isPinLimitReached(0)).toBe(false);
    expect(isPinLimitReached(HOME_PIN_LIMIT - 1)).toBe(false);
    expect(isPinLimitReached(HOME_PIN_LIMIT)).toBe(true);
    expect(isPinLimitReached(HOME_PIN_LIMIT + 3)).toBe(true);
  });

  it("gives the client a stable code and the limit to show", () => {
    expect(buildPinLimitReachedBody()).toEqual({ code: PIN_LIMIT_REACHED_CODE, limit: 25 });
  });
});
