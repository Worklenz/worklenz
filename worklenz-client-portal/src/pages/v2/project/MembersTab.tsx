import React, { useState } from 'react';
import { Avatar, Button, Card, Flex, List, Popconfirm, Select, Typography, UserAddOutlined, theme } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useMessage } from '@/hooks/useMessage';
import { useGetProjectMembersQuery, useSetProjectMembersMutation } from '@/store/api-v2';
import { useClientAccess } from '@/hooks/useClientAccess';
import { EmptyState, LockedNote, QueryState, StatusTag, errorMessage } from '@/components/v2';
import type { ClientProjectV2 } from '@/types/v2';

/** Who of the organization can open this project. Client Admins assign and remove Members and Viewers. */
export const MembersTab: React.FC<{ project: ClientProjectV2 }> = ({ project }) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const message = useMessage();
  const { can } = useClientAccess();
  const query = useGetProjectMembersQuery(project.id);
  const [setMembers, { isLoading: isSaving }] = useSetProjectMembersMutation();
  const [picked, setPicked] = useState<string[]>([]);

  const members = query.data?.members ?? [];
  const candidates = query.data?.candidates ?? [];

  const save = async (change: { add?: string[]; remove?: string[] }, success: string) => {
    try {
      await setMembers({ projectId: project.id, ...change }).unwrap();
      void message.success(success);
    } catch (error) {
      void message.error(errorMessage(error) ?? t('members.saveFailed', { defaultValue: 'We could not save the change. Please try again.' }));
      throw error;
    }
  };

  const add = async () => {
    if (picked.length === 0) return;
    await save({ add: picked }, t('members.added', { count: picked.length, defaultValue: 'Added to the project.' })).then(
      () => setPicked([]),
      () => undefined
    );
  };

  return (
    <QueryState {...query} refetch={query.refetch}>
      {can.manageUsers ? (
        <Flex gap={8} wrap="wrap" style={{ marginBottom: 12 }}>
          <Select
            mode="multiple"
            allowClear
            style={{ flex: '1 1 260px', minWidth: 0 }}
            value={picked}
            onChange={setPicked}
            disabled={candidates.length === 0}
            placeholder={
              candidates.length === 0
                ? t('members.noCandidates', { defaultValue: 'Everyone in your organization already has access' })
                : t('members.pick', { defaultValue: 'Choose people to add' })
            }
            aria-label={t('members.pick', { defaultValue: 'Choose people to add' })}
            optionFilterProp="label"
            options={candidates.map(person => ({ value: person.id, label: `${person.name} (${person.email})` }))}
          />
          <Button type="primary" icon={<UserAddOutlined />} loading={isSaving} disabled={picked.length === 0} onClick={() => void add()}>
            {t('members.add', { defaultValue: 'Add' })}
          </Button>
        </Flex>
      ) : (
        <div style={{ marginBottom: 12 }}>
          <LockedNote>{t('locked.members', { defaultValue: 'Only a Client Admin can add or remove people.' })}</LockedNote>
        </div>
      )}

      {members.length === 0 ? (
        <EmptyState title={t('members.none', { defaultValue: 'No one is assigned to this project yet.' })} />
      ) : (
        <Card styles={{ body: { padding: 0 } }}>
          <List
            dataSource={members}
            renderItem={person => (
              <List.Item
                style={{ padding: `${token.paddingSM}px ${token.padding}px` }}
                actions={
                  can.manageUsers && !person.locked
                    ? [
                        <Popconfirm
                          key="remove"
                          title={t('members.removeConfirm', { name: person.name, defaultValue: 'Remove {{name}} from this project?' })}
                          okText={t('members.remove', { defaultValue: 'Remove' })}
                          cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
                          onConfirm={() =>
                            save({ remove: [person.id] }, t('members.removed', { defaultValue: 'Removed from the project.' })).catch(() => undefined)
                          }
                        >
                          <Button size="small" danger aria-label={`${t('members.remove', { defaultValue: 'Remove' })} ${person.name}`}>
                            {t('members.remove', { defaultValue: 'Remove' })}
                          </Button>
                        </Popconfirm>,
                      ]
                    : undefined
                }
              >
                <List.Item.Meta
                  avatar={<Avatar>{person.name.charAt(0).toUpperCase()}</Avatar>}
                  title={
                    <Flex gap={8} align="center" wrap="wrap">
                      <Typography.Text strong>{person.name}</Typography.Text>
                      <StatusTag kind="role" status={person.role} />
                      {person.isYou && <Typography.Text type="secondary">{t('members.you', { defaultValue: '(you)' })}</Typography.Text>}
                    </Flex>
                  }
                  description={[person.jobTitle, person.email].filter(Boolean).join(' · ')}
                />
              </List.Item>
            )}
          />
        </Card>
      )}
    </QueryState>
  );
};
