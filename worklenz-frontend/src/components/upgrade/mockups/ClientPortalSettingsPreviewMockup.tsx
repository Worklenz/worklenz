import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  Row,
  Col,
  Flex,
  Typography,
  Tag,
  theme,
  SettingOutlined,
  PictureOutlined,
  EyeOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  CaretRightOutlined,
} from '@/shared/antd-imports';

const { useToken } = theme;
const { Title, Text } = Typography;

const ClientPortalSettingsPreviewMockup: React.FC = () => {
  const { token } = useToken();
  const { t } = useTranslation('client-portal-settings');

  const BENEFITS = [
    t('professionalBrandingText', { defaultValue: 'Professional branding for your client portal' }),
    t('consistentIdentityText', { defaultValue: 'Consistent visual identity across platforms' }),
    t('enhancedTrustText', { defaultValue: 'Enhanced client trust and recognition' }),
  ];

  return (
    <Flex vertical gap={16}>
      <Flex align="center" gap={10}>
        <SettingOutlined style={{ fontSize: 18 }} />
        <div>
          <Title level={4} style={{ margin: 0 }}>
            {t('title', { defaultValue: 'Portal Settings' })}
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            {t('customizePortalText', { defaultValue: 'Customize your client portal appearance and branding' })}
          </Text>
        </div>
      </Flex>

      <Flex gap={20} style={{ borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
        <Flex
          align="center"
          gap={6}
          style={{ padding: '0 0 10px', borderBottom: `2px solid ${token.colorPrimary}`, color: token.colorPrimary }}
        >
          <PictureOutlined />
          <Text style={{ color: token.colorPrimary, fontWeight: 500 }}>
            {t('logoManagementTitle', { defaultValue: 'Logo Management' })}
          </Text>
        </Flex>
        <Flex align="center" gap={6} style={{ padding: '0 0 10px', color: token.colorTextTertiary }}>
          <InfoCircleOutlined />
          <Text type="secondary">{t('companyDetailsTitle', { defaultValue: 'Company Details' })}</Text>
        </Flex>
      </Flex>

      <Row gutter={16}>
        <Col xs={24} md={14}>
          <Card title={t('logoManagementTitle', { defaultValue: 'Logo Management' })}>
            <Flex
              vertical
              align="center"
              justify="center"
              gap={6}
              style={{
                border: `1px dashed ${token.colorBorder}`,
                borderRadius: 8,
                padding: '32px 16px',
              }}
            >
              <PictureOutlined style={{ fontSize: 28, color: token.colorPrimary }} />
              <Text strong>{t('noLogoUploadedText', { defaultValue: 'No logo uploaded' })}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t('uploadLogoAltText', { defaultValue: 'Click or drag file to this area to upload' })}
              </Text>
            </Flex>
            <Flex align="center" gap={4} style={{ marginTop: 12 }}>
              <CaretRightOutlined style={{ fontSize: 11, color: token.colorPrimary }} />
              <Text style={{ fontSize: 12, color: token.colorPrimary }}>
                {t('logoGuidelinesTitle', { defaultValue: 'Logo Guidelines' })}
              </Text>
            </Flex>
          </Card>
        </Col>

        <Col xs={24} md={10}>
          <Flex vertical gap={16}>
            <Card
              title={
                <Flex align="center" gap={6}>
                  <EyeOutlined /> {t('logoPreviewTitle', { defaultValue: 'Logo Preview' })}
                </Flex>
              }
            >
              <Flex
                vertical
                align="center"
                justify="center"
                gap={4}
                style={{ border: `1px solid ${token.colorBorderSecondary}`, borderRadius: 8, padding: '24px 0' }}
              >
                <PictureOutlined style={{ fontSize: 24, color: token.colorTextQuaternary }} />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t('noLogoUploadedText', { defaultValue: 'No logo uploaded' })}
                </Text>
              </Flex>
              <Flex gap={6} wrap="wrap" style={{ marginTop: 10 }}>
                <Tag color="blue">{t('headerDisplayTag', { defaultValue: 'Header Display' })}</Tag>
                <Tag color="green">{t('responsiveTag', { defaultValue: 'Responsive' })}</Tag>
                <Tag color="gold">{t('autoScaledTag', { defaultValue: 'Auto-scaled' })}</Tag>
              </Flex>
            </Card>

            <Card
              title={
                <Flex align="center" gap={6}>
                  <CheckCircleOutlined style={{ color: '#52c41a' }} /> {t('benefitsTitle', { defaultValue: 'Benefits' })}
                </Flex>
              }
            >
              <Flex vertical gap={8}>
                {BENEFITS.map(benefit => (
                  <Flex key={benefit} align="flex-start" gap={8}>
                    <CheckCircleOutlined style={{ color: '#52c41a', marginTop: 3, flexShrink: 0 }} />
                    <Text style={{ fontSize: 13 }}>{benefit}</Text>
                  </Flex>
                ))}
              </Flex>
            </Card>
          </Flex>
        </Col>
      </Row>
    </Flex>
  );
};

export default ClientPortalSettingsPreviewMockup;
