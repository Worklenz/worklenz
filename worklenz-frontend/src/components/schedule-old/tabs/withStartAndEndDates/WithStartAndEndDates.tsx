import TaskGroupList from '@/pages/projects/projectView/taskList/groupTables/TaskGroupList';
import { TaskType } from '@/types/task.types';
import { useAppSelector } from '@/hooks/useAppSelector';
import GroupByFilterDropdown from '@/components/project-task-filters/filter-dropdowns/group-by-filter-dropdown';
import { useTranslation } from 'react-i18next';
import { ITaskListGroup } from '@/types/tasks/taskList.types';

const WithStartAndEndDates = () => {
  const dataSource: ITaskListGroup[] = useAppSelector(state => state.taskReducer.taskGroups);
  const groupBy = useAppSelector(state => state.taskReducer.groupBy);
  const { t } = useTranslation('schedule');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div
        style={{
          display: 'flex',
          gap: '5px',
          flexDirection: 'column',
          border: '1px solid rgba(0, 0, 0, 0.21)',
          padding: '20px',
          borderRadius: '15px',
        }}
      >
        <span style={{ fontSize: '24px', fontWeight: 'bold', color: 'rgba(112, 113, 114, 1)' }}>
          2024-11-04 - 2024-12-24
        </span>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            gap: '200px',
            color: 'rgba(121, 119, 119, 1)',
          }}
        >
          <div style={{ width: '50%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>{t('allocatedTime')}</span>
              <span>8 {t('hours')}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>{t('totalLogged')}</span>
              <span>7 {t('hours')}</span>
            </div>
          </div>
          <div style={{ width: '50%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>{t('loggedBillable')}</span>
              <span>5 {t('hours')}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>{t('loggedNonBillable')}</span>
              <span>2 {t('hours')}</span>
            </div>
          </div>
        </div>
      </div>
      <div>
        <GroupByFilterDropdown />
      </div>
      <div>
        <TaskGroupList taskGroups={dataSource} groupBy={groupBy} />
      </div>
    </div>
  );
};

export default WithStartAndEndDates;
