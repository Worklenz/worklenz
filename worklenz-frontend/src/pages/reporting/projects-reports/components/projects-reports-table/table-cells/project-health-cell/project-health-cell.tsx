import { Badge, Card, Dropdown, Flex, Menu, MenuProps, Typography } from '@/shared/antd-imports';
import { useEffect, useState, useMemo, useCallback, memo } from 'react';
import { DownOutlined } from '@/shared/antd-imports';
import { colors } from '@/styles/colors';
import './project-health-cell.css';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { themeWiseColor } from '@utils/themeWiseColor';

interface HealthStatusDataType {
  value: string;
  label: string;
  color: string;
  projectId: string;
}

const ProjectHealthCell = memo(({ value, label, color, projectId }: HealthStatusDataType) => {
  const { t } = useTranslation('reporting-projects');
  const { socket } = useSocket();
  const { projectHealths, loading } = useAppSelector(state => state.projectHealthReducer);
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  const projectHealth = projectHealths.find(status => status.id === value) || {
    color_code: color,
    id: value,
    name: label,
  };

  const onClick: MenuProps['onClick'] = useCallback(
    (e: { key: string }) => {
      if (!e.key || !projectId) return;

      socket?.emit(
        SocketEvents.PROJECT_HEALTH_CHANGE.toString(),
        JSON.stringify({
          project_id: projectId,
          health_id: e.key,
        })
      );
    },
    [socket, projectId]
  );

  const healthOptions = useMemo(
    () =>
      projectHealths.map(status => ({
        key: status.id,
        value: status.id,
        label: (
          <Typography.Text style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Badge color={status.color_code} /> {t(`${status.name}`, { defaultValue: status.name })}
          </Typography.Text>
        ),
      })),
    [projectHealths, t]
  );

  // dropdown items
  const projectHealthCellItems: MenuProps['items'] = useMemo(
    () => [
      {
        key: '1',
        label: (
          <Card className="project-health-dropdown-card" bordered={false}>
            <Menu className="project-health-menu" items={healthOptions} onClick={onClick} />
          </Card>
        ),
      },
    ],
    [healthOptions, onClick]
  );
  if (loading || projectHealths.length === 0) {
    return (
      <Flex
        gap={6}
        align="center"
        style={{
          width: 'fit-content',
          borderRadius: 24,
          paddingInline: 8,
          height: 30,
          backgroundColor: projectHealth?.color_code || colors.transparent,
 color: themeWiseColor(colors.darkGray, colors.white, themeMode),       
    cursor: 'default',
        }}
      >
        <Typography.Text
          style={{
            textTransform: 'capitalize',
            color: themeWiseColor(colors.darkGray, colors.white, themeMode),
            fontSize: 13,
          }}
        >
          {projectHealth?.name}
        </Typography.Text>
        <DownOutlined />
      </Flex>
    );
  }

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
          color: themeWiseColor(colors.darkGray, colors.white, themeMode),  
          cursor: 'pointer',
        }}
      >
        <Typography.Text
          style={{
            textTransform: 'capitalize',
 color: themeWiseColor(colors.darkGray, colors.white, themeMode),
             fontSize: 13,
          }}
        >
          {projectHealth?.name}
        </Typography.Text>

        <DownOutlined />
      </Flex>
    </Dropdown>
  );
});

export default ProjectHealthCell;
