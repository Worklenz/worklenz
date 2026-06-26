import React from 'react';
import { Button, InfoCircleOutlined, Input, Select, Tooltip, Typography } from '@/shared/antd-imports';
import { validateEmail } from '@/utils/validateEmail';
import { ClickupTeam } from '../types';
import { isValidDomain, normalizeDomain } from '../utils';

type TranslateFn = (key: string, defaultValueOrOptions?: any, options?: any) => string;

interface AuthGateContentProps {
  lowerKey: string;
  isJira: boolean;
  t: TranslateFn;
  themeToken: any;
  authError: string | null;
  authLoading: boolean;
  onClose: () => void;
  handleAsanaAuth: () => void;
  mondayToken: string;
  setMondayToken: React.Dispatch<React.SetStateAction<string>>;
  handleMondayValidate: () => void;
  trelloKey: string;
  setTrelloKey: React.Dispatch<React.SetStateAction<string>>;
  trelloToken: string;
  setTrelloToken: React.Dispatch<React.SetStateAction<string>>;
  handleTrelloValidate: () => void;
  clickupToken: string;
  setClickupToken: React.Dispatch<React.SetStateAction<string>>;
  selectedClickupSpace: string;
  setSelectedClickupSpace: React.Dispatch<React.SetStateAction<string>>;
  selectedClickupList: string;
  setSelectedClickupList: React.Dispatch<React.SetStateAction<string>>;
  clickupTeams: ClickupTeam[];
  handleClickupValidate: () => void;
  jiraEmail: string;
  setJiraEmail: React.Dispatch<React.SetStateAction<string>>;
  jiraDomain: string;
  setJiraDomain: React.Dispatch<React.SetStateAction<string>>;
  jiraToken: string;
  setJiraToken: React.Dispatch<React.SetStateAction<string>>;
  handleJiraValidate: () => void;
}

export const AuthGateContent: React.FC<AuthGateContentProps> = props => {
  const {
    lowerKey,
    isJira,
    t,
    themeToken,
    authError,
    authLoading,
    onClose,
    handleAsanaAuth,
    mondayToken,
    setMondayToken,
    handleMondayValidate,
    trelloKey,
    setTrelloKey,
    trelloToken,
    setTrelloToken,
    handleTrelloValidate,
    clickupToken,
    setClickupToken,
    selectedClickupSpace,
    setSelectedClickupSpace,
    selectedClickupList,
    setSelectedClickupList,
    clickupTeams,
    handleClickupValidate,
    jiraEmail,
    setJiraEmail,
    jiraDomain,
    setJiraDomain,
    jiraToken,
    setJiraToken,
    handleJiraValidate,
  } = props;

  const defaultContainerStyle = React.useMemo(
    () => ({ padding: 48, background: themeToken.colorBgLayout }),
    [themeToken.colorBgLayout]
  );

  const jiraContainerStyle = React.useMemo(
    () => ({ padding: '28px 40px 20px', background: themeToken.colorBgLayout }),
    [themeToken.colorBgLayout]
  );

  const actionsEndStyle = React.useMemo(
    () => ({ display: 'flex', gap: 12, justifyContent: 'flex-end' as const }),
    []
  );

  const actionsStartStyle = React.useMemo(
    () => ({ display: 'flex', gap: 12, marginTop: 12 }),
    []
  );

  const clickupSpaceOptions = React.useMemo(
    () =>
      clickupTeams.flatMap(team =>
        team.spaces.map(space => ({
          value: space.id,
          label: `${team.name} • ${space.name}`,
        }))
      ),
    [clickupTeams]
  );

  const clickupListOptions = React.useMemo(
    () =>
      clickupTeams
        .flatMap(team => team.spaces)
        .filter(space => !selectedClickupSpace || space.id === selectedClickupSpace)
        .flatMap(space =>
          space.lists.map(list => ({
            value: list.id,
            label: `${space.name} • ${list.name}`,
          }))
        ),
    [clickupTeams, selectedClickupSpace]
  );

  const renderAuthError = (style?: React.CSSProperties) =>
    authError ? (
      <Typography.Text type="danger" style={{ display: 'block', marginBottom: 12, ...style }}>
        {authError}
      </Typography.Text>
    ) : null;

  const jiraFieldLabelStyle = React.useMemo(
    () =>
      ({
        color: themeToken.colorText,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
      }) as React.CSSProperties,
    [themeToken.colorText]
  );

  const jiraFieldHintStyle = React.useMemo(
    () => ({ display: 'block', marginTop: 4 }) as React.CSSProperties,
    []
  );

  const jiraSharedTextInputProps = React.useMemo(
    () =>
      ({
        autoComplete: 'off' as const,
        autoCorrect: 'off' as const,
        autoCapitalize: 'none' as const,
        spellCheck: false,
        'data-lpignore': 'true',
        'data-1p-ignore': 'true',
      }) as const,
    []
  );

  const jiraTokenInputProps = React.useMemo(
    () =>
      ({
        ...jiraSharedTextInputProps,
        autoComplete: 'new-password' as const,
      }) as const,
    [jiraSharedTextInputProps]
  );

  if (lowerKey === 'asana') {
    return (
      <div style={defaultContainerStyle}>
        <Typography.Title level={4} style={{ color: themeToken.colorText, marginBottom: 8 }}>
          {t('auth.asanaTitle', 'Connect Asana to import')}
        </Typography.Title>
        <Typography.Paragraph style={{ color: themeToken.colorTextSecondary, marginBottom: 16 }}>
          {t(
            'auth.asanaBody',
            "We'll open Asana's consent screen to grant access to your projects and tasks."
          )}
        </Typography.Paragraph>
        {renderAuthError()}
        <div style={actionsEndStyle}>
          <Button onClick={onClose}>{t('common.cancel', 'Cancel')}</Button>
          <Button type="primary" loading={authLoading} onClick={handleAsanaAuth}>
            {t('auth.asanaCta', 'Allow Permission')}
          </Button>
        </div>
        <div style={{ color: themeToken.colorTextSecondary, marginTop: 12 }}>
          {t('auth.asanaHint', 'Opens a new tab to Asana')}
        </div>
      </div>
    );
  }

  if (lowerKey === 'monday') {
    return (
      <div style={defaultContainerStyle}>
        <Typography.Title level={4} style={{ color: themeToken.colorText, marginBottom: 8 }}>
          {t('auth.mondayTitle', 'Enter your Monday token')}
        </Typography.Title>
        <Typography.Paragraph style={{ color: themeToken.colorTextSecondary, marginBottom: 16 }}>
          {t(
            'auth.mondayBody',
            'Paste a personal access token to let Worklenz fetch boards and items for import.'
          )}
        </Typography.Paragraph>
        <Input.Password
          placeholder={t('auth.mondayPlaceholder', 'Paste your Monday token')}
          value={mondayToken}
          onChange={e => setMondayToken(e.target.value)}
          style={{ marginBottom: 16 }}
        />
        {renderAuthError()}
        <div style={actionsEndStyle}>
          <Button onClick={onClose}>{t('common.cancel', 'Cancel')}</Button>
          <Button
            type="primary"
            disabled={!mondayToken.trim()}
            loading={authLoading}
            onClick={handleMondayValidate}
          >
            {t('auth.mondaySubmit', 'Continue')}
          </Button>
        </div>
      </div>
    );
  }

  if (lowerKey === 'trello') {
    return (
      <div style={defaultContainerStyle}>
        <Typography.Title level={4} style={{ color: themeToken.colorText, marginBottom: 8 }}>
          {t('auth.trelloTitle', 'Connect Trello to import')}
        </Typography.Title>
        <Typography.Paragraph style={{ color: themeToken.colorTextSecondary, marginBottom: 16 }}>
          {t(
            'auth.trelloBody',
            'Enter your Trello API key and token so Worklenz can fetch your boards.'
          )}
        </Typography.Paragraph>
        <Input
          placeholder={t('auth.trelloKeyPlaceholder', 'Enter your Trello API key')}
          value={trelloKey}
          onChange={e => setTrelloKey(e.target.value)}
          style={{ marginBottom: 12 }}
          allowClear
        />
        <Input.Password
          placeholder={t('auth.trelloTokenPlaceholder', 'Enter your Trello token')}
          value={trelloToken}
          onChange={e => setTrelloToken(e.target.value)}
          style={{ marginBottom: 16 }}
        />
        {renderAuthError()}
        <div style={actionsEndStyle}>
          <Button onClick={onClose}>{t('common.cancel', 'Cancel')}</Button>
          <Button
            type="primary"
            disabled={!trelloKey.trim() || !trelloToken.trim()}
            loading={authLoading}
            onClick={handleTrelloValidate}
          >
            {t('auth.trelloSubmit', 'Continue')}
          </Button>
        </div>
      </div>
    );
  }

  if (lowerKey === 'clickup') {
    return (
      <div style={defaultContainerStyle}>
        <Typography.Title level={2} style={{ color: themeToken.colorText, marginBottom: 12 }}>
          {t('auth.clickupTitle', 'Connect ClickUp workspace')}
        </Typography.Title>
        <Typography.Paragraph style={{ color: themeToken.colorTextSecondary, fontSize: 16 }}>
          {t(
            'auth.clickupBody',
            'Choose the ClickUp workspace to connect. We\'ll request access to read your spaces, folders, lists, and tasks for import.'
          )}
        </Typography.Paragraph>
        <Input.Password
          placeholder={t('auth.tokenPlaceholder', 'Paste your access token')}
          value={clickupToken}
          onChange={e => setClickupToken(e.target.value)}
          style={{ marginBottom: 12 }}
        />
        <label style={{ color: themeToken.colorTextSecondary, display: 'block', marginBottom: 8 }}>
          {t('auth.clickupWorkspace', 'Workspace')}
        </label>
        <Select
          placeholder={t('auth.clickupSelect', 'Select workspace')}
          value={selectedClickupSpace || undefined}
          onChange={v => setSelectedClickupSpace(v)}
          style={{ width: 320, marginBottom: 16 }}
          options={clickupSpaceOptions}
        />
        <Select
          placeholder={t('auth.clickupSelect', 'Select workspace')}
          value={selectedClickupList || undefined}
          onChange={v => setSelectedClickupList(v)}
          style={{ width: 320, marginBottom: 16 }}
          options={clickupListOptions}
        />
        {renderAuthError()}
        <div style={actionsStartStyle}>
          <Button onClick={onClose}>{t('common.cancel', 'Cancel')}</Button>
          <Button
            type="primary"
            disabled={!clickupToken.trim()}
            loading={authLoading}
            onClick={handleClickupValidate}
          >
            {t('auth.clickupSubmit', 'Select workspace')}
          </Button>
        </div>
      </div>
    );
  }

  if (isJira) {
    const jiraEmailTrimmed = jiraEmail.trim();
    const jiraDomainNormalized = normalizeDomain(jiraDomain);
    const jiraTokenTrimmed = jiraToken.trim();
    const jiraEmailInvalid = jiraEmailTrimmed.length > 0 && !validateEmail(jiraEmailTrimmed);
    const jiraDomainInvalid = jiraDomain.trim().length > 0 && !isValidDomain(jiraDomainNormalized);
    const jiraCanConnect =
      !!jiraTokenTrimmed &&
      !!jiraEmailTrimmed &&
      !!jiraDomainNormalized &&
      !jiraEmailInvalid &&
      !jiraDomainInvalid;

    return (
      <div style={jiraContainerStyle}>
        <div style={{ width: '100%', maxWidth: 760, margin: '0 auto' }}>
          <Typography.Title level={2} style={{ color: themeToken.colorText, marginBottom: 8 }}>
            {t('auth.jiraTitle', 'Connect JIRA')}
          </Typography.Title>
          <Typography.Paragraph
            style={{ color: themeToken.colorTextSecondary, fontSize: 16, marginBottom: 18 }}
          >
            {t(
              'auth.jiraBody',
              "Enter your JIRA credentials to import projects and issues. You'll need an API token from your JIRA account."
            )}
          </Typography.Paragraph>

          <form
            style={{
              border: `1px solid ${themeToken.colorBorderSecondary}`,
              borderRadius: themeToken.borderRadiusLG,
              background: themeToken.colorBgContainer,
              padding: 20,
            }}
            autoComplete="off"
            onSubmit={e => e.preventDefault()}
          >
            <input
              type="text"
              name="jira-decoy-username"
              autoComplete="username"
              tabIndex={-1}
              aria-hidden="true"
              style={{ display: 'none' }}
            />
            <input
              type="password"
              name="jira-decoy-password"
              autoComplete="current-password"
              tabIndex={-1}
              aria-hidden="true"
              style={{ display: 'none' }}
            />
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 14, fontSize: 12 }}>
              {t('auth.jiraRequiredFields', {
                defaultValue: 'All fields are required to connect to Jira.',
              })}
            </Typography.Text>

            <div style={{ marginBottom: 16 }}>
              <label style={jiraFieldLabelStyle}>
                {t('auth.jiraEmail', { defaultValue: 'Email' })} *
                <Tooltip
                  title={t('auth.jiraEmailTooltip', {
                    defaultValue: 'Use the Atlassian account email tied to this Jira site.',
                  })}
                >
                  <InfoCircleOutlined
                    aria-label={t('auth.jiraEmailTooltipAriaLabel', {
                      defaultValue: 'Jira email guidance',
                    })}
                    style={{ color: themeToken.colorTextSecondary }}
                  />
                </Tooltip>
              </label>
              <Input
                placeholder={t('auth.jiraEmailPlaceholder', 'your-email@company.com')}
                name="jira-connect-email"
                {...jiraSharedTextInputProps}
                value={jiraEmail}
                onChange={e => setJiraEmail(e.target.value)}
                status={jiraEmailInvalid ? 'error' : ''}
              />
              <Typography.Text type="secondary" style={jiraFieldHintStyle}>
                {t('auth.jiraEmailHint', {
                  defaultValue: 'Example: jane@company.com',
                })}
              </Typography.Text>
              {jiraEmailInvalid && (
                <Typography.Text type="danger" style={jiraFieldHintStyle}>
                  {t('auth.jiraEmailInvalid', { defaultValue: 'Enter a valid email address.' })}
                </Typography.Text>
              )}
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={jiraFieldLabelStyle}>
                {t('auth.jiraDomain', { defaultValue: 'Domain' })} *
                <Tooltip
                  title={t('auth.jiraDomainTooltip', {
                    defaultValue:
                      'Enter your Jira Cloud domain only, for example yourcompany.atlassian.net (no https:// or paths).',
                  })}
                >
                  <InfoCircleOutlined
                    aria-label={t('auth.jiraDomainTooltipAriaLabel', {
                      defaultValue: 'Jira domain guidance',
                    })}
                    style={{ color: themeToken.colorTextSecondary }}
                  />
                </Tooltip>
              </label>
              <Input
                placeholder={t('auth.jiraDomainPlaceholder', 'yourcompany.atlassian.net')}
                name="jira-connect-domain"
                {...jiraSharedTextInputProps}
                value={jiraDomain}
                onChange={e => setJiraDomain(e.target.value)}
                onBlur={e => setJiraDomain(normalizeDomain(e.target.value))}
                status={jiraDomainInvalid ? 'error' : ''}
              />
              <Typography.Text type="secondary" style={jiraFieldHintStyle}>
                {t('auth.jiraDomainHint', {
                  defaultValue: 'Use only the host name. Example: yourcompany.atlassian.net',
                })}
              </Typography.Text>
              {jiraDomainInvalid && (
                <Typography.Text type="danger" style={jiraFieldHintStyle}>
                  {t('auth.jiraDomainInvalid', {
                    defaultValue:
                      'Enter a valid domain, for example yourcompany.atlassian.net (without https://).',
                  })}
                </Typography.Text>
              )}
            </div>

            <div style={{ marginBottom: 0 }}>
              <label style={jiraFieldLabelStyle}>
                {t('auth.jiraToken', { defaultValue: 'API Token' })} *
                <Tooltip
                  title={t('auth.jiraTokenTooltip', {
                    defaultValue:
                      'Create a token at id.atlassian.com/manage-profile/security/api-tokens, then paste that token here.',
                  })}
                >
                  <InfoCircleOutlined
                    aria-label={t('auth.jiraTokenTooltipAriaLabel', {
                      defaultValue: 'How to get a Jira API token',
                    })}
                    style={{ color: themeToken.colorTextSecondary }}
                  />
                </Tooltip>
              </label>
              <Input.Password
                placeholder={t('auth.jiraTokenPlaceholder', 'Paste your JIRA API token')}
                name="jira-connect-api-token"
                {...jiraTokenInputProps}
                value={jiraToken}
                onChange={e => setJiraToken(e.target.value)}
              />
              <Typography.Text type="secondary" style={jiraFieldHintStyle}>
                {t('auth.jiraTokenHint', {
                  defaultValue: 'Generate your token from Atlassian account security settings.',
                })}{' '}
                <a
                  href="https://id.atlassian.com/manage-profile/security/api-tokens"
                  target="_blank"
                  rel="noreferrer"
                >
                  {t('auth.jiraTokenLink', { defaultValue: 'Open token page' })}
                </a>
              </Typography.Text>
            </div>
          </form>
        </div>

        {renderAuthError({
          marginTop: 12,
          marginBottom: 0,
          maxWidth: 760,
          marginLeft: 'auto',
          marginRight: 'auto',
        })}

        <div
          style={{
            display: 'flex',
            gap: 12,
            justifyContent: 'flex-end',
            marginTop: 16,
            maxWidth: 760,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          <Button onClick={onClose}>{t('common.cancel', 'Cancel')}</Button>
          <Button type="primary" disabled={!jiraCanConnect} loading={authLoading} onClick={handleJiraValidate}>
            {t('auth.jiraSubmit', 'Connect')}
          </Button>
        </div>
      </div>
    );
  }

  return null;
};
