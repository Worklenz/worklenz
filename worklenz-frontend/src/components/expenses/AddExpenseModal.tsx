import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Select, Input, Button, theme, appMessage } from '@/shared/antd-imports';
import { useGetProjectsByTeamQuery } from '@/api/home-page/home-page.api.service';
import { projectFinanceApiService } from '@/ee/api/project-finance-ratecard/project-finance.api.service';
import { IProjectFinanceTask } from '@/ee/types/project/project-finance.types';
import { IProject } from '@/types/project/project.types';
import { TASK_FIXED_COST_CHANGED_EVENT } from '@/shared/constants';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAuthService } from '@/hooks/useAuth';
import { hasBusinessFeatureAccess } from '@/ee/utils/subscription-utils';
import { showUpgradePrompt } from '@/features/admin-center/admin-center.slice';

interface AddExpenseModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({ open, onClose, onSuccess }) => {
  const { token } = theme.useToken();
  const dispatch = useAppDispatch();
  const authService = useAuthService();
  const hasBusinessAccess = hasBusinessFeatureAccess(authService.getCurrentSession());
  const { t } = useTranslation('home');
  const te = (key: string, defaultValue: string) => t(`addExpense.${key}`, { defaultValue });

  const { data: projectListData } = useGetProjectsByTeamQuery();
  const projects = useMemo(() => projectListData?.body || [], [projectListData]);

  const [selProjectId, setSelProjectId] = useState<string | undefined>(undefined);
  const [selTaskId, setSelTaskId] = useState<string | undefined>(undefined);
  const [tasks, setTasks] = useState<IProjectFinanceTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [currency, setCurrency] = useState<string | undefined>(undefined);
  const [amount, setAmount] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelProjectId(undefined);
    setSelTaskId(undefined);
    setTasks([]);
    setCurrency(undefined);
    setAmount('');
  }, [open]);

  const handleProjectChange = (projectId: string) => {
    setSelProjectId(projectId);
    setSelTaskId(undefined);
    setTasks([]);
    setCurrency(undefined);
    setTasksLoading(true);
    projectFinanceApiService
      .getProjectTasks(projectId, 'status', 'all')
      .then(res => {
        if (res.done) {
          // Only leaf tasks can hold a fixed cost directly — parent tasks with
          // subtasks have their fixed cost derived from their children.
          const leafTasks = (res.body.groups || [])
            .flatMap(g => g.tasks)
            .filter(task => !task.sub_tasks_count);
          setTasks(leafTasks);
          setCurrency(res.body.project?.currency || 'usd');
        }
      })
      .catch(() => {
        setTasks([]);
        appMessage.error(te('loadTasksError', 'Unable to load tasks and currency for this project.'));
      })
      .finally(() => setTasksLoading(false));
  };

  const projectOptions = projects.map((p: IProject) => ({ value: p.id, label: p.name }));
  const taskOptions = tasks.map(task => ({ value: task.id, label: task.name }));

  const handleSubmit = async () => {
    const amt = parseFloat(amount);
    const project = projects.find((p: IProject) => p.id === selProjectId);
    const task = tasks.find(t => t.id === selTaskId);
    if (!project || !task || !amt || amt <= 0) return;

    if (!hasBusinessAccess) {
      dispatch(
        showUpgradePrompt({
          title: te('upgradePromptTitle', 'Expenses'),
          description: te(
            'upgradePromptDescription',
            'Track fixed costs against tasks and roll them up into your Finance reports. Available on the Business plan.'
          ),
        })
      );
      return;
    }

    setSubmitting(true);
    try {
      // The fixed-cost API sets an absolute value on the task, so we add this
      // expense's amount on top of whatever fixed cost the task already has.
      // task.fixed_cost is a snapshot from when the project was selected in
      // this modal — re-fetch the task's current value right before computing
      // the new total so a concurrent edit elsewhere (another tab, another
      // user, Project Finance's inline editor) in the meantime isn't silently
      // clobbered by a stale base. This narrows the race window rather than
      // eliminating it outright — doing that properly would need an atomic
      // increment endpoint, which is out of scope here.
      const breakdown = await projectFinanceApiService.getTaskBreakdown(task.id);
      const currentFixedCost = breakdown.done ? breakdown.body.task.fixed_cost || 0 : task.fixed_cost || 0;
      const newFixedCost = currentFixedCost + amt;
      await projectFinanceApiService.updateTaskFixedCost(task.id, newFixedCost);
      appMessage.success(te('successMessage', 'Fixed cost added to task'));
      document.dispatchEvent(new CustomEvent(TASK_FIXED_COST_CHANGED_EVENT));
      onSuccess();
      onClose();
    } catch (error) {
      appMessage.error(te('errorMessage', 'Failed to add fixed cost to task'));
    } finally {
      setSubmitting(false);
    }
  };

  const fldLbl: React.CSSProperties = {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    marginBottom: 5,
    color: token.colorTextSecondary,
  };

  return (
    <Modal open={open} onCancel={onClose} title={te('modalTitle', 'Add Expense')} footer={null} width={440} destroyOnClose>
      <div style={{ marginBottom: 14 }}>
        <label style={fldLbl}>{te('projectLabel', 'Project')}</label>
        <Select
          showSearch
          style={{ width: '100%' }}
          placeholder={te('projectPlaceholder', 'Select project…')}
          optionFilterProp="label"
          options={projectOptions}
          value={selProjectId}
          onChange={handleProjectChange}
        />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={fldLbl}>{te('taskLabel', 'Task')}</label>
        <Select
          showSearch
          style={{ width: '100%' }}
          placeholder={selProjectId ? te('taskPlaceholderWithProject', 'Search task…') : te('taskPlaceholderNoProject', 'Select a project first')}
          disabled={!selProjectId}
          loading={tasksLoading}
          optionFilterProp="label"
          options={taskOptions}
          value={selTaskId}
          onChange={setSelTaskId}
          notFoundContent={tasksLoading ? te('taskLoading', 'Loading…') : te('noTasksFound', 'No tasks found')}
          allowClear
        />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={fldLbl}>
          {te('amountLabel', 'Amount')} {currency ? `(${currency.toUpperCase()})` : ''}
        </label>
        <Input
          type="number"
          placeholder={te('amountPlaceholder', '0.00')}
          value={amount}
          onChange={e => setAmount(e.target.value)}
          disabled={!selTaskId}
        />
      </div>

      <Button
        type="primary"
        block
        size="large"
        loading={submitting}
        disabled={!selProjectId || !selTaskId || !amount || parseFloat(amount) <= 0}
        onClick={handleSubmit}
      >
        {te('submitButton', 'Add Task Expense')}
      </Button>
    </Modal>
  );
};

export default AddExpenseModal;
