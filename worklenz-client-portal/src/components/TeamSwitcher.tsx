import React, { useMemo, useState } from 'react';
import { CaretDownFilled, CheckCircleFilled } from '@ant-design/icons';
import { Avatar, BankOutlined, Dropdown, Flex, Input, SearchOutlined, Tooltip, Typography, theme } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useTeamSwitch } from '@/hooks/useTeamSwitch';
import type { ClientOrganization } from '@/types';
import { decodeHtmlEntities } from '@/utils/html-entities';

// The pill is fully rounded, tinted with the portal's colour at a fixed opacity per theme.
const PILL_TINT_LIGHT = 14;
const PILL_TINT_DARK = 28;
const PILL_WIDTH = 230;

const initialOf = (value: string | null | undefined): string => (value?.trim()[0] ?? 'T').toUpperCase();

/**
 * What the client calls this portal: its Portal Title, or the common portal name when the operator has
 * not set one. The Worklenz team name is an internal label and is never shown to a client.
 */
export const teamDisplayName = (team: ClientOrganization, defaultName: string): string =>
  decodeHtmlEntities(team.portalTitle?.trim() || defaultName);

/** The client company the person acts for in this portal, shown above its name. */
export const teamSecondaryLabel = (team: ClientOrganization, defaultName: string): string | null => {
  const clientName = decodeHtmlEntities(team.clientName);
  return clientName && clientName !== teamDisplayName(team, defaultName) ? clientName : null;
};

/**
 * Top bar team (workspace) switcher, laid out like the main app's: a rounded pill with the current
 * team, and a dropdown with search and a card per team, a green check on the active one. Renders
 * nothing for a login that belongs to a single team; the top bar keeps its static label for that case.
 */
export const TeamSwitcher = () => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const isDark = useAppSelector(state => state.ui.theme) === 'dark';
  const { teams, currentTeam, canSwitch, isSwitching, switchTo } = useTeamSwitch();
  const defaultName = t('app.defaultPortalName', { defaultValue: 'Worklenz Client Portal' });
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const visibleTeams = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return teams;
    return teams.filter(team =>
      `${teamDisplayName(team, defaultName)} ${decodeHtmlEntities(team.clientName)}`.toLowerCase().includes(needle)
    );
  }, [teams, query, defaultName]);

  const pillStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 10,
    height: 36,
    maxWidth: 240,
    padding: '0 16px',
    border: 0,
    borderRadius: '50rem',
    // The branding colour tints the pill; the text stays the theme's own so it never clashes with it.
    background: `color-mix(in srgb, ${token.colorPrimary} ${isDark ? PILL_TINT_DARK : PILL_TINT_LIGHT}%, transparent)`,
    color: token.colorText,
    fontWeight: 500,
  };

  // One portal: the same pill, with nothing to switch to. Plain text, not a disabled control.
  if (!canSwitch) {
    const only = currentTeam ?? teams[0];
    if (!only) return null;
    const name = teamDisplayName(only, defaultName);
    return (
      <span style={pillStyle} title={name}>
        <BankOutlined aria-hidden />
        <Typography.Text strong ellipsis style={{ color: 'inherit', maxWidth: 140 }}>
          {name}
        </Typography.Text>
      </span>
    );
  }

  const searchLabel = t('organizations.search_teams', { defaultValue: 'Search portals...' });

  const panel = (
    <div
      role="dialog"
      aria-label={t('organizations.switch_team', { defaultValue: 'Switch portal' })}
      style={{
        minWidth: PILL_WIDTH,
        maxWidth: 'calc(100vw - 24px)',
        overflow: 'hidden',
        background: token.colorBgElevated,
        borderRadius: 12,
        boxShadow: token.boxShadowSecondary,
      }}
    >
      <div style={{ padding: 8, borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
        <Input
          allowClear
          autoFocus
          size="small"
          value={query}
          onChange={event => setQuery(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Escape') setOpen(false);
          }}
          prefix={<SearchOutlined style={{ opacity: 0.45 }} />}
          placeholder={searchLabel}
          aria-label={searchLabel}
        />
      </div>
      {visibleTeams.length === 0 ? (
        <div style={{ padding: 16, textAlign: 'center' }}>
          <Typography.Text type="secondary">
            {t('organizations.no_teams_found', { defaultValue: 'No portals found' })}
          </Typography.Text>
        </div>
      ) : (
        <div role="listbox" style={{ maxHeight: 'min(400px, calc(100vh - 160px))', overflowY: 'auto' }}>
          {visibleTeams.map((team, index) => {
            const isCurrent = team.teamId === currentTeam?.teamId;
            const secondary = teamSecondaryLabel(team, defaultName);
            return (
              <button
                key={team.teamId}
                type="button"
                role="option"
                aria-selected={isCurrent}
                disabled={isSwitching}
                onClick={() => {
                  if (isCurrent) {
                    setOpen(false);
                    return;
                  }
                  void switchTo(team.teamId).then(switched => {
                    if (switched) setOpen(false);
                  });
                }}
                onMouseEnter={event => (event.currentTarget.style.background = 'var(--portal-brand-tint-soft)')}
                onMouseLeave={event => (event.currentTarget.style.background = 'transparent')}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: 0,
                  border: 0,
                  borderBottom: index < visibleTeams.length - 1 ? `1px solid ${token.colorBorderSecondary}` : 0,
                  background: 'transparent',
                  color: token.colorText,
                  textAlign: 'start',
                  cursor: isSwitching ? 'wait' : 'pointer',
                  transition: 'background-color 0.2s ease',
                }}
              >
                <Flex gap={12} align="center" justify="space-between" style={{ padding: '10px 16px' }}>
                  <Flex gap={8} align="center" style={{ minWidth: 0 }}>
                    <Avatar size={28} style={{ backgroundColor: token.colorPrimary, flexShrink: 0 }}>
                      {initialOf(teamDisplayName(team, defaultName))}
                    </Avatar>
                    <Flex vertical style={{ minWidth: 0 }}>
                      {secondary && (
                        <Typography.Text ellipsis style={{ fontSize: 11, fontWeight: 300 }}>
                          {secondary}
                        </Typography.Text>
                      )}
                      <Typography.Text ellipsis>{teamDisplayName(team, defaultName)}</Typography.Text>
                    </Flex>
                  </Flex>
                  <CheckCircleFilled
                    aria-hidden
                    style={{ fontSize: 16, color: isCurrent ? '#52c41a' : token.colorTextQuaternary }}
                  />
                </Flex>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <Dropdown
      open={open}
      onOpenChange={next => {
        setOpen(next);
        if (!next) setQuery('');
      }}
      trigger={['click']}
      placement="bottomRight"
      popupRender={() => panel}
    >
      <Tooltip title={t('organizations.switch_team', { defaultValue: 'Switch portal' })}>
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={t('organizations.switch_team', { defaultValue: 'Switch portal' })}
          disabled={isSwitching}
          style={{ ...pillStyle, cursor: isSwitching ? 'wait' : 'pointer' }}
        >
          <BankOutlined aria-hidden />
          <Typography.Text strong ellipsis style={{ color: 'inherit', maxWidth: 140 }}>
            {currentTeam ? teamDisplayName(currentTeam, defaultName) : t('organizations.select', { defaultValue: 'Select portal' })}
          </Typography.Text>
          <CaretDownFilled aria-hidden />
        </button>
      </Tooltip>
    </Dropdown>
  );
};
