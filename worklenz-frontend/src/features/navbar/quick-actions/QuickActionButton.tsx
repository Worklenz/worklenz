import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  PlusOutlined,
  UserOutlined,
  ProjectOutlined,
  CheckSquareOutlined,
  DollarOutlined,
  ClockCircleOutlined,
  UserAddOutlined,
  UsergroupAddOutlined,
} from '@ant-design/icons';
import { theme } from '@/shared/antd-imports';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAuthService } from '@/hooks/useAuth';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { useTranslation } from 'react-i18next';
import { toggleInviteMemberDrawer } from '../../settings/member/memberSlice';
import { toggleAddClientDrawer } from '@/ee/features/clients-portal/clients/clients-slice';
import { evt_projects_create_click } from '@/shared/worklenz-analytics-events';
import { LogTimeModal } from '@/components/time-entries/LogTimeModal';
import { AddExpenseModal } from '@/components/expenses/AddExpenseModal';
import { CreateProjectModal } from '@/components/projects/create-project-modal/create-project-modal';
import HomeAddTaskModal from '@/pages/home/task-list/HomeAddTaskModal';
import AddGuestModal from '@/components/common/add-guest/AddGuestModal';
import { IMyTask } from '@/types/home/my-tasks.types';
import {
  setSelectedTaskId,
  setShowTaskDrawer,
  fetchTask,
} from '@/features/task-drawer/task-drawer.slice';
import { setProjectId } from '@/features/project/project.slice';

interface QuickActionItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  disabled?: boolean;
}

const { useToken } = theme;

interface QuickActionButtonProps {
  canInviteMembers?: boolean;
  isInviteRestricted?: boolean;
  isGuest?: boolean;
}

const QuickActionButton: React.FC<QuickActionButtonProps> = ({
  canInviteMembers = false,
  isInviteRestricted = false,
  isGuest = false,
}) => {
  const { t } = useTranslation('navbar');
  const dispatch = useAppDispatch();
  const authService = useAuthService();
  const { trackMixpanelEvent } = useMixpanelTracking();
  const isOwnerOrAdmin = authService.isOwnerOrAdmin();
  const { token } = useToken();

  const [open, setOpen] = useState(false);
  const [logTimeOpen, setLogTimeOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [guestModalOpen, setGuestModalOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const ALL_ITEMS = useMemo<QuickActionItem[]>(() => [
    { key: 'new-task',    label: t('quickActions.task', { defaultValue: 'New Task' }),        icon: <CheckSquareOutlined /> },
    { key: 'log-time',    label: t('quickActions.logTime', { defaultValue: 'Log Time' }),    icon: <ClockCircleOutlined /> },
    { key: 'new-project', label: t('quickActions.project', { defaultValue: 'New Project' }),     icon: <ProjectOutlined /> },
    { key: 'new-client',  label: t('quickActions.client', { defaultValue: 'New Client' }),      icon: <UserOutlined /> },
    { key: 'add-expense', label: t('quickActions.addExpense', { defaultValue: 'Add Expense' }), icon: <DollarOutlined /> },
    { key: 'add-guest',   label: t('quickActions.addGuest', { defaultValue: 'Add Guest' }), icon: <UsergroupAddOutlined /> },
  ], [t]);

  const MEMBER_ITEMS = useMemo<QuickActionItem[]>(() => [
    { key: 'new-task',    label: t('quickActions.task', { defaultValue: 'New Task' }),    icon: <CheckSquareOutlined /> },
    { key: 'log-time',    label: t('quickActions.logTime', { defaultValue: 'Log Time' }), icon: <ClockCircleOutlined /> },
  ], [t]);

  // Hide the New button for guest users after all hooks have run.
  if (isGuest) {
    return null;
  }

  const handleAction = (key: string) => {
    setOpen(false);
    switch (key) {
      case 'new-project':
        trackMixpanelEvent(evt_projects_create_click);
        setCreateProjectOpen(true);
        break;
      case 'new-task':
        setTaskModalOpen(true);
        break;
      case 'new-client':
        dispatch(toggleAddClientDrawer());
        break;
      case 'log-time':
        setLogTimeOpen(true);
        break;
      case 'add-expense':
        setExpenseOpen(true);
        break;
      case 'add-guest':
        setGuestModalOpen(true);
        break;
      case 'invite-member':
        if (isInviteRestricted) return;
        dispatch(toggleInviteMemberDrawer());
        break;
    }
  };

  // Mirrors TasksList.tsx's handleTaskCreated — after the modal creates a task, open the drawer for it
  const handleTaskCreated = (task: IMyTask) => {
    if (!task?.id) return;
    dispatch(setSelectedTaskId(task.id));
    dispatch(fetchTask({ taskId: task.id, projectId: task.project_id || '' }));
    dispatch(setProjectId(task.project_id || ''));
    dispatch(setShowTaskDrawer(true));
  };

  const items = isOwnerOrAdmin ? ALL_ITEMS : MEMBER_ITEMS;
  const allItems = canInviteMembers
    ? [
        ...items,
        {
          key: 'invite-member',
          label: t('quickActions.inviteMember', { defaultValue: 'Invite Member' }),
          icon: <UserAddOutlined />,
          disabled: isInviteRestricted,
        },
      ]
    : items;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          height: 34,
          padding: '4px 16px 4px 4px',
          borderRadius: 17,
          cursor: 'pointer',
          border: `1px solid ${token.colorBorderSecondary}`,
          background: 'transparent',
          fontSize: 13.5,
          fontWeight: 500,
          color: token.colorText,
          transition: 'background .15s',
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.background = token.colorFillTertiary;
          el.style.color = '#1677ff';
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.background = 'transparent';
          el.style.color = token.colorText;
        }}
      >
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 26,
            height: 26,
            borderRadius: '50%',
            background: token.colorPrimary,
            flexShrink: 0,
          }}
        >
          <PlusOutlined style={{ fontSize: 12, color: token.colorWhite ?? '#fff' }} />
        </span>
        {t('quickActions.new', { defaultValue: 'New' })}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            background: token.colorBgElevated,
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: 8,
            boxShadow: token.boxShadowSecondary,
            minWidth: 180,
            zIndex: 9999,
            padding: 4,
            lineHeight: 'normal',
          }}
        >
          {allItems.map((item, index) => (
            <div
              key={item.key}
              onClick={() => !item.disabled && handleAction(item.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 12px',
                lineHeight: '20px',
                cursor: item.disabled ? 'not-allowed' : 'pointer',
                fontSize: 13,
                borderRadius: 5,
                transition: 'background .1s',
                whiteSpace: 'nowrap',
                color: item.disabled ? token.colorTextDisabled : token.colorText,
                marginTop: item.key === 'invite-member' ? 4 : 0,
                borderTop:
                  item.key === 'invite-member' ? `1px solid ${token.colorBorderSecondary}` : 'none',
                paddingTop: item.key === 'invite-member' ? 10 : 6,
              }}
              onMouseEnter={e =>
                !item.disabled &&
                ((e.currentTarget as HTMLDivElement).style.background = token.colorFillTertiary)
              }
              onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.background = 'transparent')}
            >
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: 14,
                  color: item.disabled ? token.colorTextDisabled : token.colorTextSecondary,
                }}
              >
                {item.icon}
              </span>
               {t(item.label)}
            </div>
          ))}
        </div>
      )}

      <LogTimeModal
        open={logTimeOpen}
        onClose={() => setLogTimeOpen(false)}
        onSuccess={() => {}}
      />

      <AddExpenseModal
        open={expenseOpen}
        onClose={() => setExpenseOpen(false)}
        onSuccess={() => {}}
      />

      <CreateProjectModal
        open={createProjectOpen}
        onClose={() => setCreateProjectOpen(false)}
      />

      <HomeAddTaskModal
        open={taskModalOpen}
        defaultDate={null}
        onClose={() => setTaskModalOpen(false)}
        onTaskCreated={handleTaskCreated}
      />

      <AddGuestModal
        open={guestModalOpen}
        onClose={() => setGuestModalOpen(false)}
      />
    </div>
  );
};

export default QuickActionButton;
