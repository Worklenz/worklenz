import React, { ReactNode } from 'react';
import PhaseHeader from '../../../../../../features/projects/singleProject/phase/PhaseHeader';

export type CustomTableColumnsType = {
  key: string;
  columnHeader: ReactNode | null;
  width: number;
};

const phaseHeader = React.createElement(PhaseHeader);

export const columnList: CustomTableColumnsType[] = [
  { key: 'taskId', columnHeader: 'key', width: 20 },
  { key: 'task', columnHeader: 'task', width: 400 },
  {
    key: 'description',
    columnHeader: 'description',
    width: 200,
  },
  {
    key: 'progress',
    columnHeader: 'progress',
    width: 60,
  },
  {
    key: 'status',
    columnHeader: 'status',
    width: 120,
  },
  {
    key: 'members',
    columnHeader: 'members',
    width: 150,
  },
  {
    key: 'labels',
    columnHeader: 'labels',
    width: 150,
  },
  {
    key: 'phases',
    columnHeader: phaseHeader,
    width: 150,
  },
  {
    key: 'priority',
    columnHeader: 'priority',
    width: 120,
  },
  {
    key: 'timeTracking',
    columnHeader: 'timeTracking',
    width: 150,
  },
  {
    key: 'estimation',
    columnHeader: 'estimation',
    width: 150,
  },
  {
    key: 'startDate',
    columnHeader: 'startDate',
    width: 150,
  },
  {
    key: 'dueDate',
    columnHeader: 'dueDate',
    width: 150,
  },
  {
    key: 'completedDate',
    columnHeader: 'completedDate',
    width: 150,
  },
  {
    key: 'createdDate',
    columnHeader: 'createdDate',
    width: 150,
  },
  {
    key: 'lastUpdated',
    columnHeader: 'lastUpdated',
    width: 150,
  },
  {
    key: 'reporter',
    columnHeader: 'reporter',
    width: 150,
  },
];
