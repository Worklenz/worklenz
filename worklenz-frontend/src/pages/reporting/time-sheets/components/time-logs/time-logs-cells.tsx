import React from 'react';
import { Avatar, Flex, Tag, Tooltip, theme } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { TimeEntryMemberAvatars } from '@/components/time-entries/TimeEntryMemberAvatars';
import { avatarNamesMap } from '@/shared/constants';
import { ITimeLogTaskMember, TimeLogMemberStatus } from '@/types/reporting/time-logs.types';

/** Single-line text that ends in an ellipsis instead of wrapping. */
export const ELLIPSIS_STYLE: React.CSSProperties = {
  display: 'block',
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const getInitial = (name: string | null): string => (name || '?').charAt(0).toUpperCase();

/** The placeholder for a value an entry does not have (no client, no description). */
export const EmptyCell: React.FC = () => (
  <span style={{ opacity: 0.5 }} aria-hidden="true">
    —
  </span>
);

interface TextCellProps {
  value: string | null | undefined;
}

/** A cell of text that is cut to one line, with the full text on hover — or a dash when empty. */
export const TextCell: React.FC<TextCellProps> = ({ value }) =>
  value ? (
    <Tooltip title={value}>
      <span style={ELLIPSIS_STYLE}>{value}</span>
    </Tooltip>
  ) : (
    <EmptyCell />
  );

/** The "Deactivated" / "Removed" tag a member who is no longer active carries. */
export const MemberStatusTag: React.FC<{ status: TimeLogMemberStatus }> = ({ status }) => {
  const { t } = useTranslation('time-report');
  if (status === 'active') return null;
  return (
    <Tag style={{ margin: 0, fontSize: 11, flexShrink: 0 }}>
      {status === 'removed'
        ? t('timeLogsMemberRemoved', { defaultValue: 'Removed' })
        : t('timeLogsMemberDeactivated', { defaultValue: 'Deactivated' })}
    </Tag>
  );
};

interface MemberCellProps {
  name: string | null;
  avatarUrl: string | null;
  status: TimeLogMemberStatus;
}

/** One person: avatar, name and — when they are no longer active — their standing. */
export const MemberCell: React.FC<MemberCellProps> = ({ name, avatarUrl, status }) => {
  const { token } = theme.useToken();
  return (
    <Flex align="center" gap={8} style={{ minWidth: 0 }}>
      <Avatar
        size={22}
        src={avatarUrl || undefined}
        style={{
          flexShrink: 0,
          fontSize: 12,
          // Same name-derived colours as every other initials avatar in the app.
          backgroundColor: avatarNamesMap[getInitial(name)] ?? token.colorPrimary,
        }}
      >
        {getInitial(name)}
      </Avatar>
      <span style={ELLIPSIS_STYLE}>{name}</span>
      <MemberStatusTag status={status} />
    </Flex>
  );
};

/**
 * The people who logged on a task (a By task row): overlapping avatars, like the Assignee column in
 * Home > My Tasks. Their names are on hover — with their standing, so a former member is not
 * mistaken for a current one.
 */
export const TaskMembersCell: React.FC<{ members: ITimeLogTaskMember[] }> = ({ members }) => {
  const { t } = useTranslation('time-report');
  const standing = (status: TimeLogMemberStatus): string =>
    status === 'removed'
      ? t('timeLogsMemberRemoved', { defaultValue: 'Removed' })
      : t('timeLogsMemberDeactivated', { defaultValue: 'Deactivated' });

  return (
    <TimeEntryMemberAvatars
      members={members.map(member => ({
        user_id: member.user_id,
        user_name:
          member.member_status === 'active'
            ? member.user_name
            : `${member.user_name ?? ''} (${standing(member.member_status)})`,
        avatar_url: member.avatar_url,
        color_code: member.color_code,
      }))}
    />
  );
};
