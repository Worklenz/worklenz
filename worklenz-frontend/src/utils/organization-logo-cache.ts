/** Legacy unscoped key — caused the wrong team logo to stick after switches. */
export const LEGACY_ORG_LOGO_CACHE_KEY = 'organizationLogo';

const ORG_LOGO_CACHE_PREFIX = 'organizationLogo_';

export const getOrganizationLogoCacheKey = (teamId: string): string =>
  `${ORG_LOGO_CACHE_PREFIX}${teamId}`;

export const readOrganizationLogoCache = (teamId: string | undefined | null): string | null => {
  if (!teamId) return null;
  return localStorage.getItem(getOrganizationLogoCacheKey(teamId));
};

export const writeOrganizationLogoCache = (
  teamId: string | undefined | null,
  logoUrl: string
): void => {
  if (!teamId || !logoUrl) return;
  localStorage.setItem(getOrganizationLogoCacheKey(teamId), logoUrl);
  // Drop the legacy key so a prior team's logo cannot leak across switches.
  localStorage.removeItem(LEGACY_ORG_LOGO_CACHE_KEY);
};

export const clearOrganizationLogoCache = (teamId?: string | null): void => {
  if (teamId) {
    localStorage.removeItem(getOrganizationLogoCacheKey(teamId));
  }
  localStorage.removeItem(LEGACY_ORG_LOGO_CACHE_KEY);
};
