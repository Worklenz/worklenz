import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Col, Form, Input, Row, Select, Typography } from '@/shared/antd-imports';
import { useGetPortalOrganizationsQuery } from '@/api/client-portal/portal-access-api';
import { RoleCards, useDebouncedValue } from '@/components/client-portal/v2';
import { isValidEmailAddress } from '@/components/client-portal/v2/validation';
import type { ClientRole } from '@/types/client-portal/v2';
import type { PersonField, WizardState } from './wizard-state';
import { decodeHtmlEntities } from '@/utils/html-entities';

interface DetailsStepProps {
  state: WizardState;
  onOrganizationName: (value: string) => void;
  onOrganization: (organization: { id: string; name: string } | null) => void;
  onPerson: (field: PersonField, value: string) => void;
  onRole: (role: ClientRole) => void;
}

/** Who the organization is (new) or which one (existing), then the person being invited. */
export const DetailsStep = ({ state, onOrganizationName, onOrganization, onPerson, onRole }: DetailsStepProps) => {
  const { t } = useTranslation('client-portal-v2-add-client');
  const isNewOrganization = state.method === 'new_organization';
  const [organizationSearch, setOrganizationSearch] = useState('');
  const debouncedSearch = useDebouncedValue(organizationSearch);

  const organizations = useGetPortalOrganizationsQuery(
    { limit: 50, search: debouncedSearch.trim() || undefined },
    { skip: isNewOrganization }
  );
  const organizationOptions = (organizations.data?.body?.items ?? []).map(item => ({
    value: item.id,
    label: decodeHtmlEntities(item.name),
  }));
  // Keep the chosen organization selectable even when the current search no longer lists it.
  if (state.organization && !organizationOptions.some(option => option.value === state.organization?.id)) {
    organizationOptions.unshift({
      value: state.organization.id,
      label: decodeHtmlEntities(state.organization.name),
    });
  }

  const emailInvalid = state.email.trim() !== '' && !isValidEmailAddress(state.email);

  return (
    <Form layout="vertical" requiredMark>
      {isNewOrganization ? (
        <Form.Item label={t('details.organizationName', { defaultValue: 'Organization name' })} required>
          <Input
            value={state.organizationName}
            aria-label={t('details.organizationName', { defaultValue: 'Organization name' })}
            onChange={event => onOrganizationName(event.target.value)}
            placeholder={t('details.organizationNamePlaceholder', { defaultValue: 'e.g. Beacon Logistics' })}
            maxLength={150}
            autoComplete="off"
          />
        </Form.Item>
      ) : (
        <Form.Item label={t('details.organization', { defaultValue: 'Organization' })} required>
          <Select
            showSearch
            filterOption={false}
            value={state.organization?.id}
            loading={organizations.isFetching}
            options={organizationOptions}
            onSearch={setOrganizationSearch}
            onChange={(value: string, option) => {
              const label = Array.isArray(option) ? '' : String(option?.label ?? '');
              onOrganization({ id: value, name: label });
            }}
            placeholder={t('details.selectOrganization', { defaultValue: 'Select an organization…' })}
            notFoundContent={t('details.noOrganizations', { defaultValue: 'No organizations found.' })}
            aria-label={t('details.organization', { defaultValue: 'Organization' })}
          />
        </Form.Item>
      )}

      <Row gutter={12}>
        <Col xs={24} sm={12}>
          <Form.Item label={t('details.firstName', { defaultValue: 'First name' })} required>
            <Input
              value={state.firstName}
              aria-label={t('details.firstName', { defaultValue: 'First name' })}
              onChange={event => onPerson('firstName', event.target.value)}
              placeholder={t('details.firstNamePlaceholder', { defaultValue: 'Jane' })}
              maxLength={80}
              autoComplete="off"
            />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item label={t('details.lastName', { defaultValue: 'Last name' })}>
            <Input
              value={state.lastName}
              aria-label={t('details.lastName', { defaultValue: 'Last name' })}
              onChange={event => onPerson('lastName', event.target.value)}
              placeholder={t('details.lastNamePlaceholder', { defaultValue: 'Doe' })}
              maxLength={80}
              autoComplete="off"
            />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item
        label={t('details.email', { defaultValue: 'Email address' })}
        required
        extra={t('details.emailHint', {
          defaultValue: 'This is the login and invitation address. It must be unique.',
        })}
        validateStatus={emailInvalid ? 'error' : undefined}
        help={emailInvalid ? t('details.emailInvalid', { defaultValue: 'Enter a valid email address.' }) : undefined}
      >
        <Input
          type="email"
          value={state.email}
          aria-label={t('details.email', { defaultValue: 'Email address' })}
          onChange={event => onPerson('email', event.target.value)}
          placeholder="jane@company.com"
          autoComplete="off"
        />
      </Form.Item>

      <Row gutter={12}>
        <Col xs={24} sm={12}>
          <Form.Item label={t('details.jobTitle', { defaultValue: 'Job title' })}>
            <Input
              value={state.jobTitle}
              aria-label={t('details.jobTitle', { defaultValue: 'Job title' })}
              onChange={event => onPerson('jobTitle', event.target.value)}
              placeholder={t('details.jobTitlePlaceholder', { defaultValue: 'e.g. Marketing Manager' })}
              maxLength={150}
              autoComplete="off"
            />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item label={t('details.phone', { defaultValue: 'Phone (optional)' })}>
            <Input
              value={state.phone}
              aria-label={t('details.phone', { defaultValue: 'Phone (optional)' })}
              onChange={event => onPerson('phone', event.target.value)}
              placeholder="+1 415 555 0142"
              maxLength={40}
              autoComplete="off"
            />
          </Form.Item>
        </Col>
      </Row>

      {isNewOrganization ? (
        <Alert
          type="info"
          showIcon
          message={t('details.firstUserNotice', {
            defaultValue:
              'The first user of a new organization is a Client Admin. They can approve items and, if you enable it in Portal Settings, manage their own colleagues. Like every client user, they sign in with a one-time code emailed to this address.',
          })}
        />
      ) : (
        <>
          <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
            {t('details.role', { defaultValue: 'Role' })}
          </Typography.Text>
          <RoleCards value={state.role} onChange={onRole} />
        </>
      )}
    </Form>
  );
};
