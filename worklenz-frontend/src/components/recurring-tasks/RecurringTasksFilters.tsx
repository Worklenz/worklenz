import React from 'react';
import { Flex } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useGetProjectsQuery } from '@/api/projects/projects.v1.api.service';
import { teamMembersApiService } from '@/api/team-members/teamMembers.api.service';
import { ITeamMemberViewModel } from '@/types/teamMembers/teamMembersGetResponse.types';
import { IRecurringMode, ITaskRecurring } from '@/types/tasks/task-recurring-schedule';
import PlannerMultiFilterDropdown from '@/features/schedule/PlannerMultiFilterDropdown';

export interface RecurringTasksFiltersValue {
  projectIds?: string[];
  assigneeIds?: string[];
  recurringModes?: IRecurringMode[];
  scheduleTypes?: ITaskRecurring[];
}

interface RecurringTasksFiltersProps {
  value: RecurringTasksFiltersValue;
  onChange: (value: RecurringTasksFiltersValue) => void;
}

export const RecurringTasksFilters: React.FC<RecurringTasksFiltersProps> = ({
  value,
  onChange,
}) => {
  const { t } = useTranslation('recurring-tasks');

  const { data: projectsData } = useGetProjectsQuery({
    index: 1,
    size: 200,
    field: 'name',
    order: 'asc',
    search: '',
    filter: null,
    statuses: '',
    categories: '',
    priorities: '',
  });

  const [members, setMembers] = React.useState<ITeamMemberViewModel[]>([]);

  React.useEffect(() => {
    teamMembersApiService
      .getAll()
      .then(res => setMembers(res.body || []))
      .catch(() => setMembers([]));
  }, []);

  const projectOptions = (projectsData?.body?.data || []).map(p => ({
    value: p.id as string,
    label: p.name as string,
  }));

  const memberOptions = members.map(m => ({
    value: m.id as string,
    label: m.name as string,
  }));

  const recurTypeOptions = [
    {
      value: IRecurringMode.CreateTask,
      label: t('recurTypeCreateTask', { defaultValue: 'Create New Task' }),
    },
    {
      value: IRecurringMode.ChangeStatus,
      label: t('recurTypeChangeStatus', { defaultValue: 'Change Status' }),
    },
  ];

  const recurrenceOptions = [
    { value: ITaskRecurring.Daily, label: t('recurrenceDaily', { defaultValue: 'Daily' }) },
    { value: ITaskRecurring.Weekly, label: t('recurrenceWeekly', { defaultValue: 'Weekly' }) },
    { value: ITaskRecurring.Monthly, label: t('recurrenceMonthly', { defaultValue: 'Monthly' }) },
    { value: ITaskRecurring.Yearly, label: t('recurrenceYearly', { defaultValue: 'Yearly' }) },
    {
      value: ITaskRecurring.EveryXDays,
      label: t('recurrenceEveryXDays', { defaultValue: 'Every X Days' }),
    },
    {
      value: ITaskRecurring.EveryXWeeks,
      label: t('recurrenceEveryXWeeks', { defaultValue: 'Every X Weeks' }),
    },
    {
      value: ITaskRecurring.EveryXMonths,
      label: t('recurrenceEveryXMonths', { defaultValue: 'Every X Months' }),
    },
  ];

  return (
    <Flex gap={8} wrap="wrap" align="center">
      <PlannerMultiFilterDropdown
        label={t('filterProject', { defaultValue: 'Projects' })}
        options={projectOptions}
        selected={value.projectIds || []}
        onChange={projectIds => onChange({ ...value, projectIds })}
      />
      <PlannerMultiFilterDropdown
        label={t('filterAssignee', { defaultValue: 'Assignees' })}
        options={memberOptions}
        selected={value.assigneeIds || []}
        onChange={assigneeIds => onChange({ ...value, assigneeIds })}
      />
      <PlannerMultiFilterDropdown
        label={t('filterRecurType', { defaultValue: 'Recur Type' })}
        options={recurTypeOptions}
        selected={value.recurringModes || []}
        onChange={recurringModes =>
          onChange({ ...value, recurringModes: recurringModes as IRecurringMode[] })
        }
      />
      <PlannerMultiFilterDropdown
        label={t('filterRecurrence', { defaultValue: 'Recurrence' })}
        options={recurrenceOptions}
        selected={value.scheduleTypes || []}
        onChange={scheduleTypes =>
          onChange({ ...value, scheduleTypes: scheduleTypes as ITaskRecurring[] })
        }
      />
    </Flex>
  );
};
