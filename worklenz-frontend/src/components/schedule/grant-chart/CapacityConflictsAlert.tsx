import React from 'react';
import { Alert, Badge, Collapse } from '@/shared/antd-imports';
import { WarningOutlined } from '@ant-design/icons';
import { useFetchCapacityConflictsQuery } from '@/api/schedule/scheduleApi';
import { useTranslation } from 'react-i18next';

const { Panel } = Collapse;

interface CapacityConflictsAlertProps {
  startDate: string;
  endDate: string;
}

const CapacityConflictsAlert: React.FC<CapacityConflictsAlertProps> = ({ startDate, endDate }) => {
  const { t } = useTranslation('schedule');
  const { data: conflictsResponse } = useFetchCapacityConflictsQuery({
    startDate,
    endDate,
  });

  const conflicts = conflictsResponse?.body || [];

  if (conflicts.length === 0) return null;

  const highSeverity = conflicts.filter((c: any) => c.severity === 'high').length;
  const mediumSeverity = conflicts.filter((c: any) => c.severity === 'medium').length;

  return (
    <Alert
      message={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <WarningOutlined />
          <span>{t('capacityConflicts', { defaultValue: 'Capacity Conflicts Detected' })}</span>
          <Badge count={conflicts.length} style={{ backgroundColor: '#f5222d' }} />
        </div>
      }
      description={
        <Collapse ghost>
          <Panel
            header={`${highSeverity} high, ${mediumSeverity} medium severity conflicts`}
            key="1"
          >
            {conflicts.map((conflict: any, index: number) => (
              <div
                key={index}
                style={{
                  padding: '8px 0',
                  borderBottom: index < conflicts.length - 1 ? '1px solid #f0f0f0' : 'none',
                }}
              >
                <div style={{ fontWeight: 500 }}>{conflict.member_name}</div>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  {new Date(conflict.date).toLocaleDateString()} - Over-allocated by{' '}
                  {conflict.overallocation_hours.toFixed(1)}h (
                  {conflict.utilization_percent.toFixed(0)}% utilization)
                </div>
              </div>
            ))}
          </Panel>
        </Collapse>
      }
      type="warning"
      showIcon
      style={{ marginBottom: 16 }}
    />
  );
};

export default CapacityConflictsAlert;
