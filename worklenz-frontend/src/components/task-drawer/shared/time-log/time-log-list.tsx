import { Flex } from '@/shared/antd-imports';
import React, { useState } from 'react';
import TimeLogItem from './time-log-item';
import { ITaskLogViewModel } from '@/types/tasks/task-log-view.types';

type TimeLogListProps = {
  timeLoggedList: ITaskLogViewModel[];
  onRefresh?: () => void;
  isGuest?: boolean;
};

const TimeLogList = ({ timeLoggedList, onRefresh, isGuest = false }: TimeLogListProps) => {
  return (
    <Flex vertical gap={6}>
      {timeLoggedList.map(log => (
        <TimeLogItem key={log.id} log={log} onDelete={onRefresh} isGuest={isGuest} />
      ))}
    </Flex>
  );
};

export default TimeLogList;
