import React from 'react';
import { Card, Typography, Spin, Alert, Collapse } from '@/shared/antd-imports';
import {
  useFetchScheduleMembersQuery,
  useFetchScheduleDatesQuery,
} from '@/api/schedule/scheduleApi';
import { useAppSelector } from '@/hooks/useAppSelector';

const { Text, Title } = Typography;
const { Panel } = Collapse;

interface ScheduleDataDebuggerProps {
  date: Date;
  type: string;
}

const ScheduleDataDebugger: React.FC<ScheduleDataDebuggerProps> = ({ date, type }) => {
  const {
    data: teamDataResponse,
    isLoading: teamLoading,
    error: teamError,
  } = useFetchScheduleMembersQuery();
  const {
    data: dateListResponse,
    isLoading: dateLoading,
    error: dateError,
  } = useFetchScheduleDatesQuery({
    date: date.toISOString(),
    type,
  });

  const oldTeamData = useAppSelector(state => state.scheduleReducer.teamData);
  const oldDateList = useAppSelector(state => state.scheduleReducer.dateList);

  return (
    <Card title="Schedule Data Debugger" size="small" style={{ marginBottom: 16 }}>
      <Collapse size="small">
        <Panel header="RTK Query Data" key="rtk">
          <div style={{ marginBottom: 16 }}>
            <Title level={5}>Team Data (RTK Query)</Title>
            {teamLoading ? (
              <Spin size="small" />
            ) : teamError ? (
              <Alert
                message="Error loading team data"
                description={JSON.stringify(teamError)}
                type="error"
              />
            ) : (
              <div>
                <Text>Count: {teamDataResponse?.body?.length || 0}</Text>
                <pre style={{ fontSize: '10px', maxHeight: '200px', overflow: 'auto' }}>
                  {JSON.stringify(teamDataResponse, null, 2)}
                </pre>
              </div>
            )}
          </div>

          <div style={{ marginBottom: 16 }}>
            <Title level={5}>Date List (RTK Query)</Title>
            {dateLoading ? (
              <Spin size="small" />
            ) : dateError ? (
              <Alert
                message="Error loading date data"
                description={JSON.stringify(dateError)}
                type="error"
              />
            ) : (
              <div>
                <Text>Days: {dateListResponse?.body?.date_data?.[0]?.days?.length || 0}</Text>
                <pre style={{ fontSize: '10px', maxHeight: '200px', overflow: 'auto' }}>
                  {JSON.stringify(dateListResponse, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </Panel>

        <Panel header="Old Redux Data" key="redux">
          <div style={{ marginBottom: 16 }}>
            <Title level={5}>Team Data (Old Redux)</Title>
            <Text>Count: {oldTeamData?.length || 0}</Text>
            <pre style={{ fontSize: '10px', maxHeight: '200px', overflow: 'auto' }}>
              {JSON.stringify(oldTeamData, null, 2)}
            </pre>
          </div>

          <div style={{ marginBottom: 16 }}>
            <Title level={5}>Date List (Old Redux)</Title>
            <Text>Days: {oldDateList?.date_data?.[0]?.days?.length || 0}</Text>
            <pre style={{ fontSize: '10px', maxHeight: '200px', overflow: 'auto' }}>
              {JSON.stringify(oldDateList, null, 2)}
            </pre>
          </div>
        </Panel>
      </Collapse>
    </Card>
  );
};

export default ScheduleDataDebugger;
