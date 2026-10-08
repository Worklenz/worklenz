import { getDeploymentMode, isSelfHostedDeployment } from "../shared/deployment-mode";

const originalDeploymentMode = process.env.WORKLENZ_DEPLOYMENT_MODE;

const setDeploymentMode = (mode: string | undefined): void => {
  if (mode === undefined) {
    delete process.env.WORKLENZ_DEPLOYMENT_MODE;
    return;
  }

  process.env.WORKLENZ_DEPLOYMENT_MODE = mode;
};

afterAll(() => setDeploymentMode(originalDeploymentMode));

describe("getDeploymentMode", () => {
  it.each([undefined, "", "self_hosted", " SELF_HOSTED "])(
    "defaults %p to self_hosted",
    mode => {
      setDeploymentMode(mode);

      expect(getDeploymentMode()).toBe("self_hosted");
      expect(isSelfHostedDeployment()).toBe(true);
    },
  );

  it("supports an explicit cloud deployment", () => {
    setDeploymentMode("cloud");

    expect(getDeploymentMode()).toBe("cloud");
    expect(isSelfHostedDeployment()).toBe(false);
  });

  it("rejects unsupported non-empty values", () => {
    setDeploymentMode("self-hosted");

    expect(() => getDeploymentMode()).toThrow(
      "WORKLENZ_DEPLOYMENT_MODE must be either self_hosted or cloud",
    );
  });
});
