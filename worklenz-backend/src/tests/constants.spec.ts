import * as constants from "../shared/constants";

describe("constants.ts", () => {
  it("should export DUPLICATE_KEY_VALUE", () => expect(constants.DUPLICATE_KEY_VALUE).toBeDefined());
  it("should export FOREIGN_KEY_VIOLATION", () => expect(constants.FOREIGN_KEY_VIOLATION).toBeDefined());
  it("should export DEFAULT_ERROR_MESSAGE", () => expect(constants.DEFAULT_ERROR_MESSAGE).toBeDefined());
  it("should export SessionsStatus", () => expect(constants.SessionsStatus).toBeDefined());
  it("should export LOG_DESCRIPTIONS", () => expect(constants.LOG_DESCRIPTIONS).toBeDefined());
  it("should export AvatarNamesMap", () => expect(constants.AvatarNamesMap).toBeDefined());
  it("should export PriorityColorCodes", () => expect(constants.PriorityColorCodes).toBeDefined());
  it("should export DEFAULT_PAGE_SIZE", () => expect(constants.DEFAULT_PAGE_SIZE).toBeDefined());
  it("should export REGION", () => expect(constants.REGION).toBeDefined());
  it("should export BUCKET", () => expect(constants.BUCKET).toBeDefined());
  it("should export S3_URL", () => expect(constants.S3_URL).toBeDefined());
});
