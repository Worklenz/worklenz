import { useState } from 'react';
import { Col, Form, Input, Row } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { PersonFields, getPersonErrors } from './wizard-state';

interface PersonFieldsFormProps {
  value: PersonFields;
  onChange: (patch: Partial<PersonFields>) => void;
  /** Keeps element ids unique when two of these forms exist in one page. */
  idPrefix: string;
}

type TouchedField = 'firstName' | 'email';

/**
 * The person's details, shared by "New client" and "Add a client user". An error shows once a
 * field has been left, never while the person is still typing in it for the first time.
 */
export const PersonFieldsForm = ({ value, onChange, idPrefix }: PersonFieldsFormProps) => {
  const { t } = useTranslation('client-portal-add-client');
  const [touched, setTouched] = useState<Record<TouchedField, boolean>>({
    firstName: false,
    email: false,
  });

  const errors = getPersonErrors(value);
  const markTouched = (field: TouchedField) =>
    setTouched(previous => ({ ...previous, [field]: true }));

  const emailError = touched.email ? errors.email : null;

  return (
    <Form layout="vertical" requiredMark>
      <Row gutter={12}>
        <Col xs={24} sm={12}>
          <Form.Item
            label={t('fields.firstName', { defaultValue: 'First name' })}
            required
            htmlFor={`${idPrefix}-first-name`}
            validateStatus={touched.firstName && errors.firstName ? 'error' : undefined}
            help={
              touched.firstName && errors.firstName
                ? t('errors.firstNameRequired', { defaultValue: 'Enter a first name.' })
                : undefined
            }
          >
            <Input
              id={`${idPrefix}-first-name`}
              value={value.firstName}
              maxLength={100}
              autoComplete="off"
              placeholder={t('fields.firstNamePlaceholder', { defaultValue: 'Jane' })}
              onChange={event => onChange({ firstName: event.target.value })}
              onBlur={() => markTouched('firstName')}
            />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item
            label={t('fields.lastName', { defaultValue: 'Last name' })}
            htmlFor={`${idPrefix}-last-name`}
          >
            <Input
              id={`${idPrefix}-last-name`}
              value={value.lastName}
              maxLength={100}
              autoComplete="off"
              placeholder={t('fields.lastNamePlaceholder', { defaultValue: 'Doe' })}
              onChange={event => onChange({ lastName: event.target.value })}
            />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item
        label={t('fields.email', { defaultValue: 'Email address' })}
        required
        htmlFor={`${idPrefix}-email`}
        validateStatus={emailError ? 'error' : undefined}
        help={
          emailError === 'missing'
            ? t('errors.emailRequired', { defaultValue: 'Enter an email address.' })
            : emailError === 'invalid'
              ? t('errors.emailInvalid', { defaultValue: 'Enter a valid email address.' })
              : undefined
        }
      >
        <Input
          id={`${idPrefix}-email`}
          type="email"
          value={value.email}
          maxLength={255}
          autoComplete="off"
          placeholder={t('fields.emailPlaceholder', { defaultValue: 'jane@company.com' })}
          onChange={event => onChange({ email: event.target.value })}
          onBlur={() => markTouched('email')}
        />
      </Form.Item>

      <Row gutter={12}>
        <Col xs={24} sm={12}>
          <Form.Item
            label={t('fields.jobTitle', { defaultValue: 'Job title' })}
            htmlFor={`${idPrefix}-job-title`}
          >
            <Input
              id={`${idPrefix}-job-title`}
              value={value.jobTitle}
              maxLength={100}
              placeholder={t('fields.jobTitlePlaceholder', {
                defaultValue: 'e.g. Marketing Manager',
              })}
              onChange={event => onChange({ jobTitle: event.target.value })}
            />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item
            label={t('fields.phone', { defaultValue: 'Phone (optional)' })}
            htmlFor={`${idPrefix}-phone`}
          >
            <Input
              id={`${idPrefix}-phone`}
              type="tel"
              value={value.phone}
              maxLength={50}
              placeholder={t('fields.phonePlaceholder', { defaultValue: '+1 415 555 0142' })}
              onChange={event => onChange({ phone: event.target.value })}
            />
          </Form.Item>
        </Col>
      </Row>
    </Form>
  );
};
