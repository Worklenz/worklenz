import React, { useEffect, useMemo, useState } from 'react';
import FinanceTableWrapper from './finance-table/finance-table-wrapper';
import { fetchData } from '../../../../../utils/fetchData';

const FinanceTab = ({
  groupType,
}: {
  groupType: 'status' | 'priority' | 'phases';
}) => {
  // Save each table's list according to the groups
  const [statusTables, setStatusTables] = useState<any[]>([]);
  const [priorityTables, setPriorityTables] = useState<any[]>([]);
  const [activeTablesList, setActiveTablesList] = useState<any[]>([]);

  // Fetch data for status tables
  useMemo(() => {
    fetchData('/finance-mock-data/finance-task-status.json', setStatusTables);
  }, []);

  // Fetch data for priority tables
  useMemo(() => {
    fetchData(
      '/finance-mock-data/finance-task-priority.json',
      setPriorityTables
    );
  }, []);

  // Update activeTablesList based on groupType and fetched data
  useEffect(() => {
    if (groupType === 'status') {
      setActiveTablesList(statusTables);
    } else if (groupType === 'priority') {
      setActiveTablesList(priorityTables);
    }
  }, [groupType, priorityTables, statusTables]);

  return (
    <div>
      <FinanceTableWrapper activeTablesList={activeTablesList} />
    </div>
  );
};

export default FinanceTab;
