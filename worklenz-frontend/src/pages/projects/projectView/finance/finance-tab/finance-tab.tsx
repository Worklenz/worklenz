import FinanceTableWrapper from './finance-table/finance-table-wrapper';
import { IProjectFinanceGroup } from '@/types/project/project-finance.types';

interface FinanceTabProps {
  groupType: 'status' | 'priority' | 'phases';
  taskGroups: IProjectFinanceGroup[];
  loading: boolean;
}

const FinanceTab = ({
  groupType,
  taskGroups = [],
  loading
}: FinanceTabProps) => {

  return (
    <div>
      <FinanceTableWrapper activeTablesList={taskGroups} loading={loading} />
    </div>
  );
};

export default FinanceTab;
