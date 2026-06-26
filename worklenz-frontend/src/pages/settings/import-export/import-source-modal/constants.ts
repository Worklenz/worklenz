export const DIRECT_INTEGRATION_APPS = [
  'asana',
  'monday',
  'clickup',
  'trello',
  'jira',
  'jira-software',
  'jira-business',
] as const;

export const AUTH_GATE_APPS = [...DIRECT_INTEGRATION_APPS] as const;

export const isJiraProvider = (key: string): boolean =>
  key === 'jira' || key === 'jira-software' || key === 'jira-business';
