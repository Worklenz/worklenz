/**
 * Guards the middleware wiring of the custom-columns API so authorization
 * changes land on the path that actually serves the requests.
 */

jest.mock("../middlewares/validators/require-project-permission", () => {
  const projectPermissionGuard = () => undefined;
  return {
    __esModule: true,
    projectPermissionGuard,
    requireProjectPermission: jest.fn(() => projectPermissionGuard),
  };
});

jest.mock("../middlewares/validators/require-custom-column-permission", () => {
  const customColumnPermissionGuard = () => undefined;
  return {
    __esModule: true,
    customColumnPermissionGuard,
    default: jest.fn(() => customColumnPermissionGuard),
  };
});

jest.mock("../middlewares/verify-project-access", () => ({
  __esModule: true,
  default: () => () => undefined,
}));

jest.mock("../middlewares/verify-custom-column-access", () => ({
  __esModule: true,
  default: () => () => undefined,
}));

jest.mock("../controllers/custom-columns-controller", () => ({
  __esModule: true,
  default: {
    create: () => undefined,
    get: () => undefined,
    getProjectColumns: () => undefined,
    getById: () => undefined,
    update: () => undefined,
    deleteById: () => undefined,
  },
}));

import * as projectPermissionModule from "../middlewares/validators/require-project-permission";
import * as customColumnPermissionModule from "../middlewares/validators/require-custom-column-permission";
import CustomcolumnsController from "../controllers/custom-columns-controller";
import customColumnsApiRouter from "../routes/apis/custom-columns-api-router";

interface IMockedPermissionModule {
  projectPermissionGuard?: unknown;
  customColumnPermissionGuard?: unknown;
}

const { projectPermissionGuard } =
  projectPermissionModule as unknown as IMockedPermissionModule;
const { customColumnPermissionGuard } =
  customColumnPermissionModule as unknown as IMockedPermissionModule;

// Captured at load time: jest config clears mock calls before each test.
const requireProjectPermissionCalls = [
  ...(projectPermissionModule.requireProjectPermission as unknown as jest.Mock).mock.calls,
];
const requireCustomColumnPermissionCalls = [
  ...(customColumnPermissionModule.default as unknown as jest.Mock).mock.calls,
];

interface IRouteLayer {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: { handle: unknown }[];
  };
}

const getRouteHandlers = (method: string, path: string): unknown[] => {
  const layer = (customColumnsApiRouter.stack as IRouteLayer[]).find(
    ({ route }) => route?.path === path && route.methods[method]
  );
  return layer?.route?.stack.map(({ handle }) => handle) ?? [];
};

describe("custom-columns-api-router authorization wiring", () => {
  it("guards POST / with requireProjectPermission('customColumns') reading body.project_id first", () => {
    expect(getRouteHandlers("post", "/")).toEqual([
      projectPermissionGuard,
      CustomcolumnsController.create,
    ]);
    expect(requireProjectPermissionCalls).toEqual([
      [
        "customColumns",
        expect.objectContaining({
          sources: expect.arrayContaining(["body.project_id"]),
        }),
      ],
    ]);
    expect(requireProjectPermissionCalls[0][1].sources[0]).toBe("body.project_id");
  });

  it("guards PUT /:id with requireCustomColumnPermission('customColumns')", () => {
    expect(getRouteHandlers("put", "/:id")).toEqual([
      customColumnPermissionGuard,
      CustomcolumnsController.update,
    ]);
  });

  it("guards DELETE /:id with requireCustomColumnPermission('customColumns')", () => {
    expect(getRouteHandlers("delete", "/:id")).toEqual([
      customColumnPermissionGuard,
      CustomcolumnsController.deleteById,
    ]);
    expect(requireCustomColumnPermissionCalls).toEqual([
      ["customColumns"],
      ["customColumns"],
    ]);
  });
});
