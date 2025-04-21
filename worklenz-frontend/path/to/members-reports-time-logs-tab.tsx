import React, { useState } from 'react';
import { Flex, Skeleton } from 'antd';
import { useTranslation } from 'react-i18next';
import { useTimeLogs } from '../contexts/TimeLogsContext';
import { BillableFilter } from './BillableFilter';
import { TimeLogCard } from './TimeLogCard';
import { EmptyListPlaceholder } from './EmptyListPlaceholder';
import { TaskDrawer } from './TaskDrawer';
import MembersReportsDrawer from './members-reports-drawer';

const MembersReportsTimeLogsTab: React.FC = () => {
  const { t } = useTranslation();
  const { timeLogsData, billable, setBillable, exportTimeLogs, exporting } = useTimeLogs();

  return (
    <Flex vertical gap={24}>
      <BillableFilter billable={billable} onBillableChange={setBillable} />
      
      <button onClick={exportTimeLogs} disabled={exporting}>
        {exporting ? t('exporting') : t('exportTimeLogs')}
      </button>

      <Skeleton active loading={exporting} paragraph={{ rows: 10 }}>
        {timeLogsData.length > 0 ? (
          <Flex vertical gap={24}>
            {timeLogsData.map((logs, index) => (
              <TimeLogCard key={index} data={logs} />
            ))}
          </Flex>
        ) : (
          <EmptyListPlaceholder text={t('timeLogsEmptyPlaceholder')} />
        )}
      </Skeleton>

      {createPortal(<TaskDrawer />, document.body)}
      <MembersReportsDrawer memberId={/* pass the memberId here */} exportTimeLogs={exportTimeLogs} />
    </Flex>
  );
};

export default MembersReportsTimeLogsTab; 