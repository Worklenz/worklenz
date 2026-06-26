import React, { useState, useEffect } from 'react';
import { Card, Select, Space, Typography, Tooltip, message, Button } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { InfoCircleOutlined, CalculatorOutlined, SaveOutlined } from '@ant-design/icons';
import { adminCenterApiService } from '@/api/admin-center/admin-center.api.service';
import { IOrganization } from '@/types/admin-center/admin-center.types';

const { Option } = Select;
const { Text, Title } = Typography;

interface OrganizationCalculationMethodProps {
  organization: IOrganization | null;
  refetch: () => void;
}

const OrganizationCalculationMethod: React.FC<OrganizationCalculationMethodProps> = ({
  organization,
  refetch,
}) => {
  const { t } = useTranslation('admin-center/overview');
  const [updating, setUpdating] = useState(false);
  const [currentMethod, setCurrentMethod] = useState<'hourly' | 'man_days'>(
    organization?.calculation_method || 'hourly'
  );
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (organization) {
      setCurrentMethod(organization.calculation_method || 'hourly');
      setHasChanges(false);
    }
  }, [organization]);

  const handleMethodChange = (newMethod: 'hourly' | 'man_days') => {
    setCurrentMethod(newMethod);
    setHasChanges(newMethod !== organization?.calculation_method);
  };

  const handleSave = async () => {
    setUpdating(true);
    try {
      await adminCenterApiService.updateOrganizationCalculationMethod(currentMethod);

      message.success(t('calculationMethodUpdated'));

      setHasChanges(false);
      refetch();
    } catch (error) {
      console.error('Failed to update organization calculation method:', error);
      message.error(t('calculationMethodUpdateError'));
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Card>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Space align="center">
          <CalculatorOutlined />
          <Title level={5} style={{ margin: 0 }}>
            {t('organizationCalculationMethod')}
          </Title>
          <Tooltip title={t('calculationMethodTooltip')}>
            <InfoCircleOutlined style={{ color: '#666' }} />
          </Tooltip>
        </Space>

        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <Space align="center" wrap>
            <Text strong>{t('calculationMethod')}:</Text>
            <Select
              value={currentMethod}
              onChange={handleMethodChange}
              disabled={updating}
              style={{ width: 150 }}
            >
              <Option value="hourly">
                <Space>
                  <span>{t('hourlyRates')}</span>
                </Space>
              </Option>
              <Option value="man_days">
                <Space>
                  <span>{t('manDays')}</span>
                </Space>
              </Option>
            </Select>

            {hasChanges && (
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSave}
                loading={updating}
                size="small"
              >
                {t('saveChanges')}
              </Button>
            )}
          </Space>

          {currentMethod === 'hourly' && (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {t('hourlyCalculationDescription')}
            </Text>
          )}

          {currentMethod === 'man_days' && (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {t('manDaysCalculationDescription')} ({organization?.hours_per_day}h/day)
            </Text>
          )}
        </Space>
      </Space>
    </Card>
  );
};

export default OrganizationCalculationMethod;
