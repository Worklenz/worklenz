import { Alert, Space, Typography, Tag, Row, Col } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { AppSumoAlertProps } from '../types';

export const AppSumoAlert: React.FC<AppSumoAlertProps> = ({ appSumoDiscountInfo }) => {
  const { t } = useTranslation(['admin-center/current-bill', 'pricing-modal']);

  return (
    <Row justify="center" style={{ marginTop: 24, marginBottom: 16 }}>
      <Col xs={24} sm={22} md={20} lg={18} xl={16}>
        {appSumoDiscountInfo.eligibleForDiscount ? (
          <Alert
            message={
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <Typography.Title
                  level={4}
                  style={{
                    margin: 0,
                    color: '#f57c00',
                  }}
                >
                  {t(
                    'pricing-modal:appsumo.exclusiveTitle',
                    '🎉 AppSumo Exclusive: 70% OFF Business Plans!'
                  )}
                </Typography.Title>
                {appSumoDiscountInfo.remainingDays > 0 && (
                  <Space size="large" align="center" wrap>
                    <Typography.Text strong>
                      {t(
                        'pricing-modal:appsumo.timeRemaining',
                        '{{days}}d {{hours}}h {{minutes}}m remaining',
                        {
                          days: appSumoDiscountInfo.remainingDays,
                          hours: appSumoDiscountInfo.remainingHours,
                          minutes: appSumoDiscountInfo.remainingMinutes,
                        }
                      )}
                    </Typography.Text>
                    <Tag
                      color={
                        appSumoDiscountInfo.urgencyLevel === 'critical' ||
                        appSumoDiscountInfo.urgencyLevel === 'high'
                          ? 'red'
                          : 'orange'
                      }
                    >
                      {appSumoDiscountInfo.urgencyLevel === 'critical'
                        ? t('pricing-modal:appsumo.urgency.finalHours', 'FINAL HOURS')
                        : appSumoDiscountInfo.urgencyLevel === 'high'
                          ? t('pricing-modal:appsumo.urgency.urgent', 'URGENT')
                          : t('pricing-modal:appsumo.urgency.limitedTime', 'LIMITED TIME')}
                    </Tag>
                  </Space>
                )}
              </Space>
            }
            description={
              <Space direction="vertical" size="small">
                <Typography.Text>
                  {t(
                    'pricing-modal:appsumo.specialPricing',
                    '🎯 Special pricing for AppSumo lifetime deal members'
                  )}
                </Typography.Text>
                <Typography.Text>
                  {t(
                    'pricing-modal:appsumo.businessUsers',
                    '💪 Business plans support up to 100 users included'
                  )}
                </Typography.Text>
                <Typography.Text style={{ color: '#666' }}>
                  {appSumoDiscountInfo.message}
                </Typography.Text>
              </Space>
            }
            type="info"
            showIcon
            style={{
              border: '2px solid #1890ff',
            }}
          />
        ) : (
          <Alert
            message={t('pricing-modal:appsumo.lifetimeTitle', 'AppSumo Lifetime Deal Member')}
            description={
              <Space direction="vertical" size="small">
                <Typography.Text>
                  {t(
                    'pricing-modal:appsumo.discountExpired',
                    'Your 70% discount period has expired, but you can still upgrade to Business or Enterprise plans at standard pricing.'
                  )}
                </Typography.Text>
                <Typography.Text>
                  {t(
                    'pricing-modal:appsumo.watchOffers',
                    '💡 Watch for future campaigns and special offers!'
                  )}
                </Typography.Text>
              </Space>
            }
            type="info"
            showIcon
          />
        )}
      </Col>
    </Row>
  );
};
