import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Button,
  Checkbox,
  Empty,
  Flex,
  Form,
  Input,
  Select,
  Skeleton,
  Typography,
  theme,
} from '@/shared/antd-imports';
import { SearchOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useGetClientsQuery } from '@/api/client-portal/client-portal-api';
import { useGetClientProjectsListQuery } from '@/api/client-portal/company-users-api';
import {
  PERMISSION_LEVELS,
  PERMISSION_TEMPLATES,
  PermissionTemplateKey,
} from '@/lib/client-portal/client-permissions';
import {
  getClientInitials,
  getStableColorIndex,
} from '@/pages/client-portal/clients/clients-list-helpers';
import { PersonFieldsForm } from './PersonFieldsForm';
import type { CompanyUserFields } from './wizard-state';

const { Text } = Typography;

const SEARCH_DEBOUNCE_MS = 300;
const COMPANY_RESULTS = 6;
const NO_TEMPLATE = 'none';

interface CompanyUserStepProps {
  value: CompanyUserFields;
  onChange: (patch: Partial<CompanyUserFields>) => void;
  onSelectCompany: (company: { id: string; name: string } | null) => void;
}

/** Step 2 of "Add a client user": pick the company first, then describe the new user. */
export const CompanyUserStep = ({ value, onChange, onSelectCompany }: CompanyUserStepProps) => {
  const { t } = useTranslation('client-portal-add-client');
  const { t: tPermissions } = useTranslation('client-portal-company-users');
  const { token } = theme.useToken();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

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

  const companiesQuery = useGetClientsQuery(
    {
      page: 1,
      limit: COMPANY_RESULTS,
      search: search || undefined,
      sortBy: 'name',
      sortOrder: 'asc',
    },
    { skip: value.companyId !== null }
  );
  // A deactivated company can't have anyone signing in, so it is not offered.
  const companies = useMemo(
    () => (companiesQuery.data?.body?.clients ?? []).filter(client => client.status !== 'inactive'),
    [companiesQuery.data]
  );

  const projectsQuery = useGetClientProjectsListQuery(
    { clientId: value.companyId ?? '' },
    { skip: value.companyId === null }
  );
  const projectCount = projectsQuery.data?.body?.projects.length ?? 0;
  const totalProjects = projectsQuery.data?.body?.total ?? 0;
  const hasNoProjects = projectsQuery.isSuccess && projectCount === 0;
  const isTruncated = projectsQuery.isSuccess && totalProjects > projectCount;

  const levelLabel = (levelKey: string) => {
    const level = PERMISSION_LEVELS.find(item => item.key === levelKey);
    return level ? tPermissions(level.labelKey, { defaultValue: level.labelDefault }) : levelKey;
  };

  const templateOptions = [
    {
      value: NO_TEMPLATE,
      label: t('companyUser.templateNone', {
        defaultValue: 'Set up manually later. No projects assigned yet',
      }),
    },
    ...PERMISSION_TEMPLATES.map(template => ({
      value: template.key,
      label: `${tPermissions(template.nameKey, { defaultValue: template.nameDefault })} — ${levelLabel(template.level)}`,
    })),
  ];

  const selectedTemplate = PERMISSION_TEMPLATES.find(template => template.key === value.template);

  const templateHelp = (() => {
    if (hasNoProjects) {
      return t('companyUser.templateNoProjects', {
        company: value.companyName,
        defaultValue:
          '{{company}} has no projects yet, so there is nothing to apply a template to.',
      });
    }
    if (isTruncated) {
      return t('companyUser.templateTooManyProjects', {
        company: value.companyName,
        defaultValue:
          '{{company}} has more projects than can be listed here. Assign access per project afterwards.',
      });
    }
    if (selectedTemplate) {
      return t('companyUser.templateApplied', {
        template: tPermissions(selectedTemplate.nameKey, {
          defaultValue: selectedTemplate.nameDefault,
        }),
        count: projectCount,
        company: value.companyName,
        defaultValue:
          'Grants {{template}} access to all {{count}} of {{company}}’s current projects. You can fine-tune per project afterwards from the row menu.',
      });
    }
    return t('companyUser.templateHint', {
      defaultValue:
        'Pick a template to grant access to every current project at once, or leave as is and assign projects individually afterwards.',
    });
  })();

  if (value.companyId === null) {
    return (
      <Flex vertical gap={12}>
        <Text strong>{t('companyUser.chooseCompany', { defaultValue: 'Choose the company' })}</Text>
        <Input
          allowClear
          prefix={<SearchOutlined />}
          value={searchInput}
          placeholder={t('companyUser.searchCompanies', { defaultValue: 'Search companies...' })}
          aria-label={t('companyUser.searchCompanies', { defaultValue: 'Search companies...' })}
          onChange={event => setSearchInput(event.target.value)}
        />

        {companiesQuery.isError ? (
          <Alert
            type="error"
            showIcon
            message={t('companyUser.companiesError', { defaultValue: 'Could not load companies.' })}
            action={
              <Button size="small" onClick={() => companiesQuery.refetch()}>
                {t('retry', { defaultValue: 'Retry' })}
              </Button>
            }
          />
        ) : companiesQuery.isLoading ? (
          <Skeleton active paragraph={{ rows: 3 }} title={false} />
        ) : companies.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              search
                ? t('companyUser.noMatches', {
                    query: search,
                    defaultValue: 'No companies match “{{query}}”.',
                  })
                : t('companyUser.noCompanies', {
                    defaultValue: 'No companies yet. Add a new client first.',
                  })
            }
          />
        ) : (
          <Flex
            vertical
            gap={8}
            role="group"
            aria-label={t('companyUser.companiesLabel', { defaultValue: 'Companies' })}
            style={{ maxHeight: 260, overflowY: 'auto' }}
          >
            {companies.map(company => {
              const displayName = company.company_name?.trim() || company.name;
              return (
                <button
                  key={company.id}
                  type="button"
                  onClick={() => onSelectCompany({ id: company.id, name: displayName })}
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
                    border: `1px solid ${token.colorBorderSecondary}`,
                    background: token.colorBgContainer,
                  }}
                >
                  <Avatar
                    size={32}
                    style={{
                      flexShrink: 0,
                      color: token.colorWhite,
                      backgroundColor:
                        avatarPalette[getStableColorIndex(company.id, avatarPalette.length)],
                    }}
                  >
                    {getClientInitials(displayName)}
                  </Avatar>
                  <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <Text strong>{displayName}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {t('companyUser.existingUsers', {
                        count: company.company_users_count ?? 0,
                        defaultValue_one: '{{count}} existing user',
                        defaultValue_other: '{{count}} existing users',
                      })}
                    </Text>
                  </span>
                </button>
              );
            })}
          </Flex>
        )}
      </Flex>
    );
  }

  return (
    <Flex vertical gap={12}>
      <Flex
        align="center"
        justify="space-between"
        gap={12}
        style={{
          padding: '8px 12px',
          borderRadius: token.borderRadiusLG,
          background: token.colorFillQuaternary,
          border: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Flex align="center" gap={10} style={{ minWidth: 0 }}>
          <Avatar
            size={32}
            style={{
              flexShrink: 0,
              color: token.colorWhite,
              backgroundColor:
                avatarPalette[getStableColorIndex(value.companyId, avatarPalette.length)],
            }}
          >
            {getClientInitials(value.companyName)}
          </Avatar>
          <Text strong ellipsis>
            {value.companyName}
          </Text>
        </Flex>
        <Button type="link" size="small" onClick={() => onSelectCompany(null)}>
          {t('companyUser.changeCompany', { defaultValue: 'Change' })}
        </Button>
      </Flex>

      <PersonFieldsForm idPrefix="add-company-user" value={value} onChange={onChange} />

      <Checkbox
        checked={value.isPoc}
        onChange={event => onChange({ isPoc: event.target.checked })}
        style={{
          width: '100%',
          padding: '10px 12px',
          borderRadius: token.borderRadiusLG,
          border: `1px solid ${token.colorBorderSecondary}`,
          alignItems: 'flex-start',
        }}
      >
        <Flex vertical>
          <Text strong>{t('companyUser.makePoc', { defaultValue: 'Make this user a POC' })}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('companyUser.makePocHint', {
              defaultValue:
                'A company can have any number of POCs, or none. This is independent of other users’ POC status.',
            })}
          </Text>
        </Flex>
      </Checkbox>

      <Form layout="vertical">
        <Form.Item
          label={t('companyUser.projectAccess', { defaultValue: 'Project access' })}
          htmlFor="add-company-user-template"
          extra={templateHelp}
          style={{ marginBottom: 0 }}
        >
          <Select
            id="add-company-user-template"
            loading={projectsQuery.isLoading}
            disabled={projectsQuery.isLoading || hasNoProjects || isTruncated}
            value={value.template ?? NO_TEMPLATE}
            options={templateOptions}
            onChange={next =>
              onChange({ template: next === NO_TEMPLATE ? null : (next as PermissionTemplateKey) })
            }
          />
        </Form.Item>
      </Form>
    </Flex>
  );
};
