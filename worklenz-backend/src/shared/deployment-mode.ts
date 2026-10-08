export type DeploymentMode = "cloud" | "self_hosted";

const SELF_HOSTED_MODE = "self_hosted";

/**
 * This public repository is self-hosted by default. Cloud licensing remains
 * an explicit opt-in for private multi-tenant deployments.
 */
export function getDeploymentMode(): DeploymentMode {
  const configuredMode = process.env.WORKLENZ_DEPLOYMENT_MODE?.trim().toLowerCase();

  if (!configuredMode || configuredMode === SELF_HOSTED_MODE) {
    return SELF_HOSTED_MODE;
  }

  if (configuredMode === "cloud") {
    return "cloud";
  }

  throw new Error(
    "WORKLENZ_DEPLOYMENT_MODE must be either self_hosted or cloud",
  );
}

/** Returns whether this instance includes self-hosted Business entitlements. */
export function isSelfHostedDeployment(): boolean {
  return getDeploymentMode() === SELF_HOSTED_MODE;
}
