import { Badge, Card, Dropdown, Flex, Menu, MenuProps, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { DownOutlined } from '@ant-design/icons';
import { colors } from '@/styles/colors';
import './project-health-cell.css';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import { IProjectHealth } from '@/types/project/projectHealth.types';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { setProjectHealth } from '@/features/reporting/projectReports/project-reports-slice';
import { useAppDispatch } from '@/hooks/useAppDispatch';

interface HealthStatusDataType {
  value: string;
  label: string;
  color: string;
  projectId: string;
}

const ProjectHealthCell = ({ value, label, color, projectId }: HealthStatusDataType) => {
  const { t } = useTranslation('reporting-projects');
  const dispatch = useAppDispatch();
  const { socket, connected } = useSocket();
  const { projectHealths } = useAppSelector(state => state.projectHealthReducer);

  const projectHealth = projectHealths.find(status => status.id === value) || {
    color_code: color,
    id: value,
    name: label,
  };

  const healthOptions = projectHealths.map(status => ({
    key: status.id,
    value: status.id,
    label: (
      <Typography.Text style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <Badge color={status.color_code} /> {t(`${status.name}`)}
      </Typography.Text>
    ),
  }));

  const handleHealthChangeResponse = (data: IProjectHealth) => {
    dispatch(setProjectHealth(data));
  };

  const onClick: MenuProps['onClick'] = e => {
    if (!e.key || !projectId) return;

    socket?.emit(
      SocketEvents.PROJECT_HEALTH_CHANGE.toString(),
      JSON.stringify({
        project_id: projectId,
        health_id: e.key,
      })
    );
  };

  // dropdown items
  const projectHealthCellItems: MenuProps['items'] = [
    {
      key: '1',
      label: (
        <Card className="project-health-dropdown-card" bordered={false}>
          <Menu className="project-health-menu" items={healthOptions} onClick={onClick} />
        </Card>
      ),
    },
  ];

  useEffect(() => {
    if (socket && connected) {
      socket.on(SocketEvents.PROJECT_HEALTH_CHANGE.toString(), handleHealthChangeResponse);

      return () => {
        socket.removeListener(
          SocketEvents.PROJECT_HEALTH_CHANGE.toString(),
          handleHealthChangeResponse
        );
      };
    }
  }, [socket, connected]);

  return (
    <Dropdown
      overlayClassName="project-health-dropdown"
      menu={{ items: projectHealthCellItems }}
      placement="bottomRight"
      trigger={['click']}
    >
      <Flex
        gap={6}
        align="center"
        style={{
          width: 'fit-content',
          borderRadius: 24,
          paddingInline: 8,
          height: 30,
          backgroundColor: projectHealth?.color_code || colors.transparent,
          color: colors.darkGray,
          cursor: 'pointer',
        }}
      >
        <Typography.Text
          style={{
            textTransform: 'capitalize',
            color: colors.darkGray,
            fontSize: 13,
          }}
        >
          {projectHealth?.name}
        </Typography.Text>

        <DownOutlined />
      </Flex>
    </Dropdown>
  );
};

export default ProjectHealthCell;
