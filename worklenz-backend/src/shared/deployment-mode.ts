export type DeploymentMode = "cloud" | "self_hosted";

const SELF_HOSTED_MODE = "self_hosted";

/**
 * This public repository is self-hosted by default. Cloud licensing remains
 * an explicit opt-in for private multi-tenant deployments.
 */
export function getDeploymentMode(): DeploymentMode {
  return process.env.WORKLENZ_DEPLOYMENT_MODE?.trim().toLowerCase() === "cloud"
    ? "cloud"
    : SELF_HOSTED_MODE;
}

export function isSelfHostedDeployment(): boolean {
  return getDeploymentMode() === SELF_HOSTED_MODE;
}
