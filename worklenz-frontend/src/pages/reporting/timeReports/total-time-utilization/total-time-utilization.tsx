import { Card, Flex } from 'antd';
import React, { useEffect } from 'react';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { IRPTTimeTotals } from '@/types/reporting/reporting.types';

interface TotalTimeUtilizationProps {
  totals: IRPTTimeTotals;
}
const TotalTimeUtilization: React.FC<TotalTimeUtilizationProps> = ({ totals }) => {
  return (
    <Flex gap={16} style={{ marginBottom: '16px' }}>
      <Card style={{ borderRadius: '4px', flex: 1 }}>
        <div>
          <div style={{ fontSize: 14, color: '#888' }}>Total Time Logs</div>
          <div style={{ fontSize: 24, fontWeight: 600 }}>{totals.total_time_logs}h</div>
        </div>
      </Card>
      <Card style={{ borderRadius: '4px', flex: 1 }}>
        <div>
          <div style={{ fontSize: 14, color: '#888' }}>Estimated Hours</div>
          <div style={{ fontSize: 24, fontWeight: 600 }}>{totals.total_estimated_hours}h</div>
        </div>
      </Card>
      <Card style={{ borderRadius: '4px', flex: 1 }}>
        <div>
          <div style={{ fontSize: 14, color: '#888' }}>Utilization (%)</div>
          <div style={{ fontSize: 24, fontWeight: 600 }}>{totals.total_utilization}%</div>
        </div>
      </Card>
    </Flex>
  );
};

export default TotalTimeUtilization;