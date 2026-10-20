import { CSSProperties, Fragment, useEffect } from 'react';
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
  NotificationOutlined,
  SafetyCertificateOutlined,
  Spin,
  Tooltip,
  Typography,
  XOutlined,
  YoutubeOutlined,
  message,
  theme,
} from '@/shared/antd-imports';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { fetchLatestRelease, openLatestReleaseViewer } from '@/features/whats-new/whatsNewSlice';
import { getAppVersion } from '@/config/env';
import { formatBuildDate, getBuildDate } from '@/utils/app-info';
import {
  evt_settings_help_item_click,
  evt_settings_help_visit,
} from '@/shared/worklenz-analytics-events';
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
} from '@/shared/help-links-constants';

export const HelpSettings = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('settings/help');
  const { trackMixpanelEvent } = useMixpanelTracking();
  const latestStatus = useAppSelector(state => state.whatsNewReducer.latestStatus);

  useDocumentTitle(t('pageTitle', { defaultValue: 'Help' }));

  useEffect(() => {
    trackMixpanelEvent(evt_settings_help_visit);
  }, [trackMixpanelEvent]);

  // Non-blocking: the page renders straight away and the Release notes row
  // resolves its enabled/disabled state once this settles. A failed earlier
  // attempt is retried on the next visit.
  useEffect(() => {
    if (latestStatus === 'idle' || latestStatus === 'failed') {
      dispatch(fetchLatestRelease());
    }
    // Only on mount: re-running on every status change would loop after a failure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const trackItemClick = (item: HelpItemId) => {
    trackMixpanelEvent(evt_settings_help_item_click, { item });
  };

  return (
    <Card style={{ width: '100%' }}>
      <Flex vertical gap={24}>
        <Flex vertical gap={4}>
          <Typography.Title level={4} style={{ marginBlockEnd: 0 }}>
            {t('pageTitle', { defaultValue: 'Help' })}
          </Typography.Title>
          <Typography.Text type="secondary">
            {t('pageDescription', {
              defaultValue:
                'Documentation, release notes, community links, and version information.',
            })}
          </Typography.Text>
        </Flex>

        <Flex vertical style={{ maxWidth: HELP_LIST_MAX_WIDTH }}>
          {HELP_GROUPS.map((group, index) => (
            <Fragment key={group.key}>
              {index > 0 && <Divider style={{ margin: '8px 0' }} />}
              <ul role="list" style={LIST_RESET_STYLE}>
                {group.rows.map(row => (
                  <li key={row.id}>
                    {row.kind === 'link' && <HelpLinkRow row={row} onOpen={trackItemClick} />}
                    {row.kind === 'email' && <HelpEmailRow row={row} onOpen={trackItemClick} />}
                    {row.kind === 'release-notes' && <ReleaseNotesRow onOpen={trackItemClick} />}
                    {row.kind === 'about' && <AboutBlock />}
                  </li>
                ))}
              </ul>
            </Fragment>
          ))}
        </Flex>
      </Flex>
    </Card>
  );
};

const HelpRowContent = ({
  icon: Icon,
  label,
  isExternal = false,
  isBusy = false,
}: HelpRowContentProps) => {
  const { token } = theme.useToken();

  return (
    <Flex
      component="span"
      align="center"
      justify="space-between"
      gap={12}
      style={{ width: '100%' }}
    >
      <Flex component="span" align="center" gap={12}>
        {isBusy ? (
          <Spin size="small" />
        ) : (
          <Icon aria-hidden style={{ color: token.colorTextSecondary }} />
        )}
        <span>{label}</span>
      </Flex>
      {isExternal && (
        <ExportOutlined aria-hidden style={{ color: token.colorTextTertiary, fontSize: 12 }} />
      )}
    </Flex>
  );
};

const HelpLinkRow = ({ row, onOpen }: HelpLinkRowProps) => {
  const { t } = useTranslation('settings/help');
  const label = t(row.labelKey, { defaultValue: row.defaultLabel });
  const opensInNewTab = t('opensInNewTab', { defaultValue: 'opens in a new tab' });

  return (
    <Button
      type="text"
      block
      href={row.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label} (${opensInNewTab})`}
      onClick={() => onOpen(row.id)}
      style={ROW_BUTTON_STYLE}
    >
      <HelpRowContent icon={row.icon} label={label} isExternal />
    </Button>
  );
};

// A mailto: link hands off to the user's mail app: no target=_blank (that can
// leave a blank tab behind) and no external-link icon, since nothing opens in
// the browser. The aria-label says so instead of "opens in a new tab".
const HelpEmailRow = ({ row, onOpen }: HelpEmailRowProps) => {
  const { t } = useTranslation('settings/help');
  const label = t(row.labelKey, { defaultValue: row.defaultLabel });
  const opensEmailApp = t('opensEmailApp', { defaultValue: 'opens your email app' });

  return (
    <Button
      type="text"
      block
      href={row.url}
      aria-label={`${label} (${opensEmailApp})`}
      onClick={() => onOpen(row.id)}
      style={ROW_BUTTON_STYLE}
    >
      <HelpRowContent icon={row.icon} label={label} />
    </Button>
  );
};

const ReleaseNotesRow = ({ onOpen }: ReleaseNotesRowProps) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('settings/help');
  const { token } = theme.useToken();
  const latestStatus = useAppSelector(state => state.whatsNewReducer.latestStatus);
  const latestRelease = useAppSelector(state => state.whatsNewReducer.latestRelease);

  const isLoading = latestStatus === 'idle' || latestStatus === 'loading';
  const hasFailed = latestStatus === 'failed';
  const isUnavailable = latestStatus === 'succeeded' && !latestRelease;

  const label = t('items.releaseNotes', { defaultValue: 'Release notes' });
  const unavailableText = t('releaseNotes.unavailable', {
    defaultValue: 'No release notes published yet',
  });
  const loadFailedText = t('releaseNotes.loadFailed', {
    defaultValue: "Couldn't load release notes. Click to try again.",
  });

  const tooltipTitle = isUnavailable ? unavailableText : hasFailed ? loadFailedText : undefined;

  const handleClick = async () => {
    if (isLoading || isUnavailable) return;
    onOpen('release_notes');

    if (!hasFailed) {
      dispatch(openLatestReleaseViewer());
      return;
    }

    try {
      const release = await dispatch(fetchLatestRelease()).unwrap();
      if (release) dispatch(openLatestReleaseViewer());
    } catch {
      message.error(
        t('releaseNotes.loadFailedMessage', {
          defaultValue: "Couldn't load release notes. Please try again.",
        })
      );
    }
  };

  return (
    // aria-disabled rather than a native `disabled` when unavailable, so the row
    // stays keyboard-focusable and the tooltip/aria-label can say why.
    <Tooltip title={tooltipTitle} trigger={['hover', 'focus']}>
      <Button
        type="text"
        block
        disabled={isLoading}
        aria-busy={isLoading}
        aria-disabled={isUnavailable || undefined}
        aria-label={isUnavailable ? `${label}. ${unavailableText}` : undefined}
        onClick={handleClick}
        style={{
          ...ROW_BUTTON_STYLE,
          ...(isUnavailable ? { color: token.colorTextDisabled, cursor: 'not-allowed' } : {}),
        }}
      >
        <HelpRowContent icon={NotificationOutlined} label={label} isBusy={isLoading} />
      </Button>
    </Tooltip>
  );
};

const AboutBlock = () => {
  const { t } = useTranslation('settings/help');
  const { token } = theme.useToken();
  const language = useAppSelector(state => state.localesReducer.lng);

  const version = getAppVersion();
  const buildDate = getBuildDate();

  return (
    <Flex vertical gap={4} style={{ padding: '10px 12px' }}>
      <Flex align="center" gap={12}>
        <InfoCircleOutlined aria-hidden style={{ color: token.colorTextSecondary }} />
        <Typography.Text>{t('items.about', { defaultValue: 'About' })}</Typography.Text>
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
          <Typography.Text type="secondary">
            {t('about.version', { defaultValue: 'Version' })}
          </Typography.Text>
        </dt>
        <dd style={{ margin: 0 }}>{version ?? EMPTY_VALUE}</dd>
        <dt>
          <Typography.Text type="secondary">
            {t('about.lastUpdated', { defaultValue: 'Last updated' })}
          </Typography.Text>
        </dt>
        <dd style={{ margin: 0 }}>
          {buildDate ? formatBuildDate(buildDate, language) : EMPTY_VALUE}
        </dd>
      </dl>
    </Flex>
  );
};

// Static content
const HELP_LIST_MAX_WIDTH = 480;
const EMPTY_VALUE = '—';

const LIST_RESET_STYLE: CSSProperties = { listStyle: 'none', margin: 0, padding: 0 };
const ROW_BUTTON_STYLE: CSSProperties = {
  height: 40,
  paddingInline: 12,
  justifyContent: 'flex-start',
};

// Group order mirrors the spec: Learn, Community, then Privacy + About.
const HELP_GROUPS: HelpGroup[] = [
  {
    key: 'learn',
    rows: [
      {
        kind: 'link',
        id: 'documentation',
        labelKey: 'items.documentation',
        defaultLabel: 'Documentation',
        icon: BookOutlined,
        url: WORKLENZ_DOCS_URL,
      },
      { kind: 'release-notes', id: 'release_notes' },
      {
        kind: 'link',
        id: 'changelog',
        labelKey: 'items.changelog',
        defaultLabel: 'Changelog',
        icon: HistoryOutlined,
        url: WORKLENZ_CHANGELOG_URL,
      },
      {
        kind: 'email',
        id: 'email_support',
        labelKey: 'items.emailSupport',
        defaultLabel: 'Email support',
        icon: MailOutlined,
        url: WORKLENZ_SUPPORT_MAILTO_URL,
      },
    ],
  },
  {
    key: 'community',
    rows: [
      {
        kind: 'link',
        id: 'youtube',
        labelKey: 'items.youtube',
        defaultLabel: 'YouTube',
        icon: YoutubeOutlined,
        url: WORKLENZ_YOUTUBE_URL,
      },
      {
        kind: 'link',
        id: 'discord',
        labelKey: 'items.discord',
        defaultLabel: 'Discord',
        icon: DiscordOutlined,
        url: WORKLENZ_DISCORD_URL,
      },
      {
        kind: 'link',
        id: 'github',
        labelKey: 'items.github',
        defaultLabel: 'GitHub',
        icon: GithubOutlined,
        url: WORKLENZ_GITHUB_URL,
      },
      {
        kind: 'link',
        id: 'facebook',
        labelKey: 'items.facebook',
        defaultLabel: 'Facebook',
        icon: FacebookOutlined,
        url: WORKLENZ_FACEBOOK_URL,
      },
      {
        kind: 'link',
        id: 'linkedin',
        labelKey: 'items.linkedin',
        defaultLabel: 'LinkedIn',
        icon: LinkedinOutlined,
        url: WORKLENZ_LINKEDIN_URL,
      },
      {
        kind: 'link',
        id: 'x',
        labelKey: 'items.x',
        defaultLabel: 'X',
        icon: XOutlined,
        url: WORKLENZ_X_URL,
      },
    ],
  },
  {
    key: 'about',
    rows: [
      {
        kind: 'link',
        id: 'privacy_policy',
        labelKey: 'items.privacyPolicy',
        defaultLabel: 'Privacy policy',
        icon: SafetyCertificateOutlined,
        url: WORKLENZ_PRIVACY_POLICY_URL,
      },
      { kind: 'about', id: 'about' },
    ],
  },
];

// Types and interfaces
// `item` values sent with evt_settings_help_item_click. About has no click action.
export type HelpItemId =
  | 'documentation'
  | 'release_notes'
  | 'changelog'
  | 'youtube'
  | 'discord'
  | 'github'
  | 'facebook'
  | 'linkedin'
  | 'x'
  | 'privacy_policy'
  | 'email_support';

type HelpIcon = typeof BookOutlined;

interface IHelpLinkRow {
  kind: 'link';
  id: HelpItemId;
  labelKey: string;
  defaultLabel: string;
  icon: HelpIcon;
  url: string;
}

interface IHelpEmailRow {
  kind: 'email';
  id: 'email_support';
  labelKey: string;
  defaultLabel: string;
  icon: HelpIcon;
  url: string;
}

type HelpRow =
  | IHelpLinkRow
  | IHelpEmailRow
  | { kind: 'release-notes'; id: 'release_notes' }
  | { kind: 'about'; id: 'about' };

interface HelpGroup {
  key: string;
  rows: HelpRow[];
}

interface HelpRowContentProps {
  icon: HelpIcon;
  label: string;
  isExternal?: boolean;
  isBusy?: boolean;
}

interface HelpLinkRowProps {
  row: IHelpLinkRow;
  onOpen: (item: HelpItemId) => void;
}

interface HelpEmailRowProps {
  row: IHelpEmailRow;
  onOpen: (item: HelpItemId) => void;
}

interface ReleaseNotesRowProps {
  onOpen: (item: HelpItemId) => void;
}

export default HelpSettings;
