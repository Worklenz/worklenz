import React from 'react';
import { Form, Input, Row, Col } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import PhoneInput from '@/components/PhoneInput/PhoneInput';
import { validatePhoneNumber } from '@/utils/validatePhoneNumber';
import { IClientPortalSettings } from '@/types/settings/client-portal-settings.types';
import { SectionCard } from './SectionCard';

interface CompanyDetailsSectionProps {
  settings: IClientPortalSettings;
  onChange: (patch: Partial<IClientPortalSettings>) => void;
}

export const CompanyDetailsSection: React.FC<CompanyDetailsSectionProps> = ({ settings, onChange }) => {
  const { t } = useTranslation('client-portal-settings');

  return (
    <SectionCard
      title={t('companyDetailsTitle', { defaultValue: 'Company Details' })}
      description={t('companyDetailsDescription', { defaultValue: 'These details will appear on your invoices.' })}
    >
      <Form layout="vertical">
        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item label={t('companyNameLabel', { defaultValue: 'Company Name' })}>
              <Input
                placeholder={t('companyNamePlaceholder', { defaultValue: 'Enter your company name' })}
                value={settings.company_name || ''}
                onChange={e => onChange({ company_name: e.target.value })}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item label={t('contactEmailLabel', { defaultValue: 'Contact Email' })}>
              <Input
                placeholder={t('contactEmailPlaceholder', { defaultValue: 'Enter contact email' })}
                value={settings.contact_email || ''}
                onChange={e => onChange({ contact_email: e.target.value })}
              />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item
              label={t('contactPhoneLabel', { defaultValue: 'Contact Phone' })}
              rules={[
                {
                  validator: (_, value) => {
                    if (!value || value.trim() === '') return Promise.resolve();
                    if (validatePhoneNumber(value)) return Promise.resolve();
                    return Promise.reject(
                      new Error(t('invalidPhoneNumberFormat', { defaultValue: 'Invalid phone number format' }))
                    );
                  },
                },
              ]}
            >
              <PhoneInput
                placeholder={t('contactPhonePlaceholder', { defaultValue: 'Enter contact phone' })}
                value={settings.contact_phone || ''}
                onChange={value => onChange({ contact_phone: value })}
              />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item label={t('addressLine1Label', { defaultValue: 'Address Line 1' })}>
              <Input
                placeholder={t('addressLine1Placeholder', { defaultValue: 'Street address, P.O. box' })}
                value={settings.address_line_1 || ''}
                onChange={e => onChange({ address_line_1: e.target.value })}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item label={t('addressLine2Label', { defaultValue: 'Address Line 2' })}>
              <Input
                placeholder={t('addressLine2Placeholder', { defaultValue: 'City, State, ZIP, Country' })}
                value={settings.address_line_2 || ''}
                onChange={e => onChange({ address_line_2: e.target.value })}
              />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item label={t('cityLabel', { defaultValue: 'City' })}>
              <Input
                placeholder={t('cityPlaceholder', { defaultValue: 'City' })}
                value={settings.city || ''}
                onChange={e => onChange({ city: e.target.value })}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item label={t('stateLabel', { defaultValue: 'State / Province' })}>
              <Input
                placeholder={t('statePlaceholder', { defaultValue: 'State / Province' })}
                value={settings.state || ''}
                onChange={e => onChange({ state: e.target.value })}
              />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item label={t('zipCodeLabel', { defaultValue: 'Zip / Postal Code' })}>
              <Input
                placeholder={t('zipCodePlaceholder', { defaultValue: 'Zip / Postal Code' })}
                value={settings.zip_code || ''}
                onChange={e => onChange({ zip_code: e.target.value })}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item label={t('countryLabel', { defaultValue: 'Country' })} style={{ marginBottom: 0 }}>
              <Input
                placeholder={t('countryPlaceholder', { defaultValue: 'Country' })}
                value={settings.country || ''}
                onChange={e => onChange({ country: e.target.value })}
              />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </SectionCard>
  );
};

export default CompanyDetailsSection;
