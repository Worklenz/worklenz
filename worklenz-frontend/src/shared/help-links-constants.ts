// Every external link on Settings > Help, in one place. Not overridable by
// self-hosted admins in v1 — to add that later, change only this file.
export const WORKLENZ_DOCS_URL = 'https://docs.worklenz.com/en/start/introduction/';
export const WORKLENZ_CHANGELOG_URL = 'https://worklenz.com/changelog';

export const WORKLENZ_YOUTUBE_URL = 'https://www.youtube.com/@WorklenzHQ';

export const WORKLENZ_DISCORD_URL = 'https://discord.gg/6Qmm839mgr';
export const WORKLENZ_GITHUB_URL = 'https://github.com/Worklenz/worklenz';
export const WORKLENZ_FACEBOOK_URL = 'https://www.facebook.com/Worklenz/';
export const WORKLENZ_LINKEDIN_URL = 'https://lk.linkedin.com/showcase/worklenz/';
export const WORKLENZ_X_URL = 'https://x.com/WorklenzHQ';

export const WORKLENZ_PRIVACY_POLICY_URL = 'https://worklenz.com/privacy/';

// Email support opens the user's mail app (no page, no new tab). The subject is
// prefilled and deliberately not localized: it is addressed to the support team,
// which triages in English.
export const WORKLENZ_SUPPORT_EMAIL = 'support@worklenz.com';
export const WORKLENZ_SUPPORT_EMAIL_SUBJECT = 'Worklenz support request';
export const WORKLENZ_SUPPORT_MAILTO_URL = `mailto:${WORKLENZ_SUPPORT_EMAIL}?subject=${encodeURIComponent(WORKLENZ_SUPPORT_EMAIL_SUBJECT)}`;
