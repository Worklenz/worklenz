import { ConfigProvider, Select, Typography } from 'antd';
import { colors } from '@/styles/colors';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import { getStatusIcon } from '@/utils/projectUtils';
import { useEffect, useState } from 'react';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { setProjectStatus } from '@/features/reporting/projectReports/project-reports-slice';
import logger from '@/utils/errorLogger';

interface ProjectStatusCellProps {
  currentStatus: string;
  projectId: string;
}

const ProjectStatusCell = ({ currentStatus, projectId }: ProjectStatusCellProps) => {
  const { t } = useTranslation('reporting-projects');
  const dispatch = useAppDispatch();
  const { socket } = useSocket();
  const { projectStatuses } = useAppSelector(state => state.projectStatusesReducer);
  const [selectedStatus, setSelectedStatus] = useState(currentStatus);

  // Find current status object
  const currentStatusObject = projectStatuses.find(status => status.id === selectedStatus);

  const statusOptions = projectStatuses.map(status => ({
    value: status.id,
    label: (
      <Typography.Text
        style={{ display: 'flex', alignItems: 'center', gap: 4 }}
        className="group-hover:text-[#1890ff]"
      >
        {getStatusIcon(status.icon || '', status.color_code || '')}
        {t(`${status.name}`)}
      </Typography.Text>
    ),
  }));

  const handleStatusChange = (value: string) => {
    try {
      if (!value || !projectId) {
        throw new Error('Invalid status value or project ID');
      }

      const newStatus = projectStatuses.find(status => status.id === value);
      if (!newStatus) {
        throw new Error('Status not found');
      }

      // Update local state immediately
      setSelectedStatus(value);

      // Update Redux store
      dispatch(setProjectStatus({ projectId, status: newStatus }));

      // Emit socket event
      socket?.emit(
        SocketEvents.PROJECT_STATUS_CHANGE.toString(),
        JSON.stringify({
          project_id: projectId,
          status_id: value,
        })
      );
    } catch (error) {
      logger.error('Error changing project status:', error);
    }
  };

  // Keep local state in sync with props
  useEffect(() => {
    setSelectedStatus(currentStatus);
  }, [currentStatus]);

  return (
    <ConfigProvider
      theme={{
        components: {
          Select: {
            selectorBg: colors.transparent,
          },
        },
      }}
    >
      <Select
        variant="borderless"
        options={statusOptions}
        value={selectedStatus}
        onChange={handleStatusChange}
      />
    </ConfigProvider>
  );
};

export default ProjectStatusCell;
