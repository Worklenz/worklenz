import React from 'react';
import { Card, Typography, Tag, Space } from 'antd';
import { useAppSelector } from '@/hooks/useAppSelector';
import { RootState } from '@/app/store';
import dayjs from 'dayjs';

const { Text } = Typography;

interface HolidayDebugInfoProps {
  show?: boolean;
}

const HolidayDebugInfo: React.FC<HolidayDebugInfoProps> = ({ show = false }) => {
  const { holidays, loadingHolidays, holidaysDateRange, holidaySettings } = useAppSelector(
    (state: RootState) => state.adminCenterReducer
  );

  if (!show) return null;

  return (
    <Card
      size="small"
      title="Holiday Debug Info"
      style={{
        marginBottom: 16,
        fontSize: '12px',
        backgroundColor: '#f8f9fa',
        border: '1px dashed #ccc',
      }}
    >
      <Space direction="vertical" size="small" style={{ width: '100%' }}>
        <div>
          <Text strong>Holiday Settings:</Text>
          <div style={{ marginLeft: 8 }}>
            <Text>Country: {holidaySettings?.country_code || 'Not set'}</Text>
            <br />
            <Text>State: {holidaySettings?.state_code || 'Not set'}</Text>
            <br />
            <Text>Auto Sync: {holidaySettings?.auto_sync_holidays ? 'Yes' : 'No'}</Text>
          </div>
        </div>

        <div>
          <Text strong>Current Date Range:</Text>
          {holidaysDateRange ? (
            <div style={{ marginLeft: 8 }}>
              <Text>From: {holidaysDateRange.from}</Text>
              <br />
              <Text>To: {holidaysDateRange.to}</Text>
            </div>
          ) : (
            <Text> Not loaded</Text>
          )}
        </div>

        <div>
          <Text strong>Holidays Loaded:</Text>
          <Space wrap style={{ marginLeft: 8 }}>
            {loadingHolidays ? (
              <Tag color="blue">Loading...</Tag>
            ) : holidays.length > 0 ? (
              <>
                <Tag color="green">Total: {holidays.length}</Tag>
                <Tag color="orange">
                  Official: {holidays.filter(h => h.source === 'official').length}
                </Tag>
                <Tag color="purple">
                  Custom: {holidays.filter(h => h.source === 'custom').length}
                </Tag>
              </>
            ) : (
              <Tag color="red">No holidays loaded</Tag>
            )}
          </Space>
        </div>

        {holidays.length > 0 && (
          <div>
            <Text strong>Recent Holidays:</Text>
            <div style={{ marginLeft: 8, maxHeight: 100, overflow: 'auto' }}>
              {holidays.slice(0, 5).map((holiday, index) => (
                <div key={`${holiday.id}-${index}`} style={{ fontSize: '11px' }}>
                  <Tag size="small" color={holiday.source === 'official' ? 'blue' : 'orange'}>
                    {holiday.source}
                  </Tag>
                  {dayjs(holiday.date).format('MMM DD')}: {holiday.name}
                </div>
              ))}
              {holidays.length > 5 && (
                <Text type="secondary">... and {holidays.length - 5} more</Text>
              )}
            </div>
          </div>
        )}
      </Space>
    </Card>
  );
};

export default HolidayDebugInfo;
