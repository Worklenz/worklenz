import React from 'react';
import { Card, Col, Flex, Row, Typography, theme } from '@/shared/antd-imports';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import {
  ANALYTICS_NAV,
  analyticsPath,
  getAnalyticsNavIcon,
} from '@/lib/reporting/analytics-nav';

const { Title, Text } = Typography;

const AllReportsPage: React.FC = () => {
  const { t } = useTranslation('reporting-analytics');
  const navigate = useNavigate();
  const { token } = theme.useToken();
  useDocumentTitle(t('allReports', { defaultValue: 'All reports' }));

  const cards = ANALYTICS_NAV.groups.flatMap(group =>
    group.items.map(item => ({
      ...item,
      groupLabel: t(group.labelKey, { defaultValue: group.defaultLabel }),
    }))
  );

  return (
    <Flex vertical gap={16}>
      <div>
        <Title level={3} style={{ margin: 0 }}>
          {t('allReports', { defaultValue: 'All reports' })}
        </Title>
        <Text type="secondary">
          {t('allReportsSubtitle', {
            defaultValue: 'Every report in one place. Open a report to filter, export, or share.',
          })}
        </Text>
      </div>

      <Row gutter={[16, 16]}>
        {cards.map(item => (
          <Col key={item.key} xs={24} sm={12} lg={8} xl={6}>
            <Card
              hoverable
              onClick={() => navigate(analyticsPath(item.path))}
              styles={{ body: { padding: 16 } }}
              style={{ height: '100%', borderColor: token.colorBorderSecondary }}
            >
              <Flex gap={12} align="flex-start">
                <span style={{ fontSize: 18, color: token.colorPrimary, marginTop: 2 }}>
                  {getAnalyticsNavIcon(item.key)}
                </span>
                <Flex vertical gap={4}>
                  <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase' }}>
                    {item.groupLabel}
                  </Text>
                  <Text strong>
                    {t(item.labelKey, { defaultValue: item.defaultLabel })}
                  </Text>
                </Flex>
              </Flex>
            </Card>
          </Col>
        ))}
      </Row>
    </Flex>
  );
};

export default AllReportsPage;
