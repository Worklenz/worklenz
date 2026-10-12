import { Modal, Button, Flex, Typography, Empty, Spin, message } from '@/shared/antd-imports';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useGetClientProjectsQuery,
  useConvertTicketToTaskMutation,
} from '../../../api/client-portal/client-portal-api';
import { useAppDispatch } from '../../../hooks/useAppDispatch';
import { setSelectedTaskId, setShowTaskDrawer, fetchTask } from '@/features/task-drawer/task-drawer.slice';
import { setProjectId } from '@/features/project/project.slice';

interface ConvertToTaskModalProps {
  ticket: { id: string; subject: string; client_id: string; client_name?: string } | null;
  onClose: () => void;
}

const ConvertToTaskModal: React.FC<ConvertToTaskModalProps> = ({ ticket, onClose }) => {
  const { t } = useTranslation('client-portal-tickets');
  const dispatch = useAppDispatch();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  useEffect(() => {
    if (ticket) setSelectedProjectId(null);
  }, [ticket]);

  const { data: projectsData, isFetching } = useGetClientProjectsQuery(
    { clientId: ticket?.client_id || '' },
    { skip: !ticket?.client_id }
  );
  const projects = projectsData?.projects ?? [];

  const [convertToTask, { isLoading: isConverting }] = useConvertTicketToTaskMutation();

  if (!ticket) return null;

  const handleConfirm = async () => {
    if (!selectedProjectId) {
      message.error(t('selectProjectRequired', { defaultValue: 'Select a project first.' }));
      return;
    }
    try {
      const result = await convertToTask({ id: ticket.id, project_id: selectedProjectId }).unwrap();
      const taskId = result.body?.task_id;
      const projectId = result.body?.project_id || selectedProjectId;
      message.success(
        t('convertToTaskSuccess', {
          subject: ticket.subject,
          defaultValue: '"{{subject}}" added as a task.',
        })
      );
      onClose();
      if (taskId) {
        dispatch(setSelectedTaskId(taskId));
        dispatch(fetchTask({ taskId, projectId }));
        dispatch(setProjectId(projectId));
        dispatch(setShowTaskDrawer(true));
      }
    } catch (err) {
      const errorData = (err as { data?: { message?: string } })?.data;
      message.error(errorData?.message || t('convertToTaskError', { defaultValue: 'Failed to convert ticket to task' }));
    }
  };

  return (
    <Modal
      open={Boolean(ticket)}
      onCancel={onClose}
      title={t('convertToTaskButton', { defaultValue: 'Convert to Task' })}
      footer={
        <Flex justify="flex-end" gap={8}>
          <Button size="small" onClick={onClose}>
            {t('cancelButton', { defaultValue: 'Cancel' })}
          </Button>
          <Button
            type="primary"
            size="small"
            onClick={handleConfirm}
            disabled={!selectedProjectId}
            loading={isConverting}
          >
            {t('addAsTaskButton', { defaultValue: 'Add as Task' })}
          </Button>
        </Flex>
      }
      width={480}
    >
      <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
        {t('convertToTaskDescription', {
          subject: ticket.subject,
          client: ticket.client_name,
          defaultValue: 'Add "{{subject}}" as a task on one of {{client}}’s projects.',
        })}
      </Typography.Paragraph>

      {isFetching ? (
        <Flex justify="center" style={{ padding: '24px 0' }}>
          <Spin />
        </Flex>
      ) : projects.length > 0 ? (
        <Flex vertical gap={8}>
          {projects.map(project => (
            <Flex
              key={project.id}
              align="center"
              justify="space-between"
              onClick={() => setSelectedProjectId(project.id)}
              style={{
                border: `1px solid ${selectedProjectId === project.id ? '#1677ff' : 'var(--border-color, #d9d9d9)'}`,
                borderRadius: 8,
                padding: '10px 12px',
                cursor: 'pointer',
                background: selectedProjectId === project.id ? 'rgba(22,119,255,.06)' : 'transparent',
              }}
            >
              <Typography.Text strong style={{ fontSize: 13 }}>
                {project.name}
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 11.5 }}>
                {project.completedTasks}/{project.totalTasks}{' '}
                {t('tasksLabel', { defaultValue: 'tasks' })}
              </Typography.Text>
            </Flex>
          ))}
        </Flex>
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('noProjectsForClient', {
            client: ticket.client_name,
            defaultValue: 'No projects found for this client.',
          })}
        />
      )}
    </Modal>
  );
};

export default ConvertToTaskModal;
