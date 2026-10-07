import { useEffect, useState } from 'react';
import { SearchOutlined } from '@ant-design/icons';
import {
  Alert,
  Avatar,
  Button,
  Empty,
  Flex,
  Input,
  Skeleton,
  Typography,
  theme,
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useGetCompanyUsersQuery } from '@/api/client-portal/company-users-api';
import {
  getClientInitials,
  getStableColorIndex,
} from '@/pages/client-portal/clients/clients-list-helpers';
import type { ExistingContactSnapshot } from './wizard-state';

const { Text } = Typography;

const SEARCH_DEBOUNCE_MS = 300;
const RESULT_LIMIT = 8;

interface ExistingContactStepProps {
  selected: ExistingContactSnapshot | null;
  onSelect: (contact: ExistingContactSnapshot) => void;
}

/**
 * Step 2 of "Invite an existing contact": people who are in the list but have no working access,
 * meaning they were never invited or their invitation expired.
 */
export const ExistingContactStep = ({ selected, onSelect }: ExistingContactStepProps) => {
  const { t } = useTranslation('client-portal-add-client');
  const { token } = theme.useToken();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading, isError, refetch } = useGetCompanyUsersQuery({
    page: 1,
    limit: RESULT_LIMIT,
    search: search || undefined,
    status: 'not_invited,expired',
    sortBy: 'name',
    sortOrder: 'asc',
  });
  const users = data?.body?.users ?? [];

  const avatarPalette = [
    token.blue6,
    token.cyan6,
    token.green6,
    token.orange6,
    token.volcano6,
    token.purple6,
    token.magenta6,
    token.geekblue6,
  ];

  return (
    <Flex vertical gap={12}>
      <Text type="secondary">
        {t('existing.helper', { defaultValue: 'Contacts without active portal access.' })}
      </Text>

      <Input
        allowClear
        prefix={<SearchOutlined />}
        value={searchInput}
        placeholder={t('existing.search', { defaultValue: 'Search by name or email...' })}
        aria-label={t('existing.search', { defaultValue: 'Search by name or email...' })}
        onChange={event => setSearchInput(event.target.value)}
      />

      {isError ? (
        <Alert
          type="error"
          showIcon
          message={t('existing.loadError', { defaultValue: 'Could not load contacts.' })}
          action={
            <Button size="small" onClick={() => refetch()}>
              {t('retry', { defaultValue: 'Retry' })}
            </Button>
          }
        />
      ) : isLoading ? (
        <Skeleton active paragraph={{ rows: 3 }} title={false} />
      ) : users.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            search
              ? t('existing.noMatches', {
                  query: search,
                  defaultValue: 'No matches for “{{query}}”.',
                })
              : t('existing.everyoneHasAccess', {
                  defaultValue: 'Everyone already has active portal access.',
                })
          }
        />
      ) : (
        <div
          role="radiogroup"
          aria-label={t('existing.groupLabel', { defaultValue: 'Contacts to invite' })}
          style={{ display: 'grid', gap: 8, maxHeight: 280, overflowY: 'auto' }}
        >
          {users.map(user => {
            const isSelected = selected?.id === user.id;
            return (
              <button
                key={user.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() =>
                  onSelect({
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    companyName: user.company_name,
                  })
                }
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '8px 12px',
                  textAlign: 'start',
                  cursor: 'pointer',
                  color: token.colorText,
                  borderRadius: token.borderRadiusLG,
                  border: `1px solid ${isSelected ? token.colorPrimary : token.colorBorderSecondary}`,
                  background: isSelected ? token.colorPrimaryBg : token.colorBgContainer,
                }}
              >
                <Avatar
                  size={36}
                  style={{
                    flexShrink: 0,
                    color: token.colorWhite,
                    backgroundColor:
                      avatarPalette[getStableColorIndex(user.id, avatarPalette.length)],
                  }}
                >
                  {getClientInitials(user.name)}
                </Avatar>
                <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <Text strong>{user.name}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {user.email}
                    {' · '}
                    {user.company_name}
                  </Text>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </Flex>
  );
};
