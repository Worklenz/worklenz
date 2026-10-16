import React, { CSSProperties, Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BookOutlined,
  Button,
  Card,
  DiscordOutlined,
  Divider,
  ExportOutlined,
  FacebookOutlined,
  Flex,
  GithubOutlined,
  HistoryOutlined,
  InfoCircleOutlined,
  LinkedinOutlined,
  MailOutlined,
  SafetyCertificateOutlined,
  Typography,
  XOutlined,
  YoutubeOutlined,
  theme,
} from '@/shared/antd-imports';
import {
  WORKLENZ_CHANGELOG_URL,
  WORKLENZ_DISCORD_URL,
  WORKLENZ_DOCS_URL,
  WORKLENZ_FACEBOOK_URL,
  WORKLENZ_GITHUB_URL,
  WORKLENZ_LINKEDIN_URL,
  WORKLENZ_PRIVACY_POLICY_URL,
  WORKLENZ_SUPPORT_MAILTO_URL,
  WORKLENZ_X_URL,
  WORKLENZ_YOUTUBE_URL,
} from '@/lib/client-portal/help-links-constants';

/** Help links and version info, mirroring the main app's Settings > Help (minus release notes). */
const HelpSettings: React.FC = () => {
  const { t } = useTranslation();

  return (
    <Card title={t('settings.nav.help', { defaultValue: 'Help' })}>
      <Flex vertical style={{ maxWidth: HELP_LIST_MAX_WIDTH }}>
        {HELP_GROUPS.map((group, index) => (
          <Fragment key={group.key}>
            {index > 0 && <Divider style={{ margin: '8px 0' }} />}
            <ul role="list" style={LIST_RESET_STYLE}>
              {group.rows.map(row => (
                <li key={row.id}>
                  {row.kind === 'about' ? <AboutBlock /> : <HelpLinkRow row={row} />}
                </li>
              ))}
            </ul>
          </Fragment>
        ))}
      </Flex>
    </Card>
  );
};

const HelpLinkRow: React.FC<{ row: IHelpLinkRow }> = ({ row }) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const [isActive, setIsActive] = useState(false);
  const Icon = row.icon;
  const label = t(row.labelKey, { defaultValue: row.defaultLabel });
  const hint = row.isEmail
    ? t('settings.help.opensEmailApp', { defaultValue: 'opens your email app' })
    : t('settings.help.opensInNewTab', { defaultValue: 'opens in a new tab' });

  return (
    <Button
      type="text"
      block
      href={row.url}
      // A mailto: link hands off to the mail app, so no new tab and no external icon.
      target={row.isEmail ? undefined : '_blank'}
      rel={row.isEmail ? undefined : 'noopener noreferrer'}
      aria-label={`${label} (${hint})`}
      onMouseEnter={() => setIsActive(true)}
      onMouseLeave={() => setIsActive(false)}
      onFocus={() => setIsActive(true)}
      onBlur={() => setIsActive(false)}
      style={{
        ...ROW_BUTTON_STYLE,
        // Brand tint instead of Ant's neutral text-button hover.
        background: isActive ? `color-mix(in srgb, ${token.colorPrimary} 14%, transparent)` : undefined,
        color: isActive ? token.colorPrimary : undefined,
      }}
    >
      <Flex component="span" align="center" justify="space-between" gap={12} style={{ width: '100%' }}>
        <Flex component="span" align="center" gap={12}>
          <Icon aria-hidden style={{ color: isActive ? token.colorPrimary : token.colorTextSecondary }} />
          <span>{label}</span>
        </Flex>
        {!row.isEmail && <ExportOutlined aria-hidden style={{ color: token.colorTextTertiary, fontSize: 12 }} />}
      </Flex>
    </Button>
  );
};

const AboutBlock: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { token } = theme.useToken();

  const version = import.meta.env.VITE_APP_VERSION?.trim() || null;
  const lastUpdated = formatLastUpdated(import.meta.env.VITE_APP_LAST_UPDATED, i18n.language);

  return (
    <Flex vertical gap={4} style={{ padding: '10px 12px' }}>
      <Flex align="center" gap={12}>
        <InfoCircleOutlined aria-hidden style={{ color: token.colorTextSecondary }} />
        <Typography.Text>{t('settings.help.items.about', { defaultValue: 'About' })}</Typography.Text>
      </Flex>
      <dl
        style={{
          margin: 0,
          paddingInlineStart: 28,
          display: 'grid',
          gridTemplateColumns: 'max-content 1fr',
          columnGap: 24,
          rowGap: 4,
        }}
      >
        <dt>
          <Typography.Text type="secondary">{t('settings.help.about.version', { defaultValue: 'Version' })}</Typography.Text>
        </dt>
        <dd style={{ margin: 0 }}>{version ?? EMPTY_VALUE}</dd>
        <dt>
          <Typography.Text type="secondary">
            {t('settings.help.about.lastUpdated', { defaultValue: 'Last updated' })}
          </Typography.Text>
        </dt>
        <dd style={{ margin: 0 }}>{lastUpdated ?? EMPTY_VALUE}</dd>
      </dl>
    </Flex>
  );
};

// Helper functions
const formatLastUpdated = (value: string | undefined, language: string): string | null => {
  const raw = value?.trim();
  if (!raw) return null;
  // A bare YYYY-MM-DD parses as UTC midnight, which can render as the previous day; read it as a local date.
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  const date = dateOnly ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])) : new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  try {
    return new Intl.DateTimeFormat(language, { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en', { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
  }
};

// Static content
const HELP_LIST_MAX_WIDTH = 480;
const EMPTY_VALUE = '—';

const LIST_RESET_STYLE: CSSProperties = { listStyle: 'none', margin: 0, padding: 0 };
const ROW_BUTTON_STYLE: CSSProperties = { height: 40, paddingInline: 12, justifyContent: 'flex-start' };

const link = (id: string, defaultLabel: string, icon: HelpIcon, url: string, isEmail = false): IHelpLinkRow => ({
  kind: 'link',
  id,
  labelKey: `settings.help.items.${id}`,
  defaultLabel,
  icon,
  url,
  isEmail,
});

const HELP_GROUPS: HelpGroup[] = [
  {
    key: 'learn',
    rows: [
      link('documentation', 'Documentation', BookOutlined, WORKLENZ_DOCS_URL),
      link('changelog', 'Changelog', HistoryOutlined, WORKLENZ_CHANGELOG_URL),
      link('emailSupport', 'Email support', MailOutlined, WORKLENZ_SUPPORT_MAILTO_URL, true),
    ],
  },
  {
    key: 'community',
    rows: [
      link('youtube', 'YouTube', YoutubeOutlined, WORKLENZ_YOUTUBE_URL),
      link('discord', 'Discord', DiscordOutlined, WORKLENZ_DISCORD_URL),
      link('github', 'GitHub', GithubOutlined, WORKLENZ_GITHUB_URL),
      link('facebook', 'Facebook', FacebookOutlined, WORKLENZ_FACEBOOK_URL),
      link('linkedin', 'LinkedIn', LinkedinOutlined, WORKLENZ_LINKEDIN_URL),
      link('x', 'X', XOutlined, WORKLENZ_X_URL),
    ],
  },
  {
    key: 'about',
    rows: [link('privacyPolicy', 'Privacy policy', SafetyCertificateOutlined, WORKLENZ_PRIVACY_POLICY_URL), { kind: 'about', id: 'about' }],
  },
];

// Types and interfaces
type HelpIcon = typeof BookOutlined;

interface IHelpLinkRow {
  kind: 'link';
  id: string;
  labelKey: string;
  defaultLabel: string;
  icon: HelpIcon;
  url: string;
  isEmail: boolean;
}

type HelpRow = IHelpLinkRow | { kind: 'about'; id: 'about' };

interface HelpGroup {
  key: string;
  rows: HelpRow[];
}

export default HelpSettings;
