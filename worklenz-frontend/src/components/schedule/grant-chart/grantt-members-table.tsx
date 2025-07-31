import { Badge, Button, Flex, Tooltip } from 'antd';
import React, { useCallback } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import CustomAvatar from '../../CustomAvatar';
import {
  fetchMemberProjects,
  toggleScheduleDrawer,
} from '../../../features/schedule/scheduleSlice';
import { CaretDownOutlined, CaretRightFilled } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';

type GranttChartMembersTabelProps = {
  members: any[];
  expandedProject: string | null;
  setExpandedProject: (id: string | null) => void;
  membersScrollRef: any;
  syncVerticalScroll: (source: 'timeline' | 'members') => void;
};

const GranttMembersTable = React.memo(
  ({
    members,
    expandedProject,
    setExpandedProject,
    membersScrollRef,
    syncVerticalScroll,
  }: GranttChartMembersTabelProps) => {
    // localization
    const { t } = useTranslation('schedule');

    // get theme details
    const themeMode = useAppSelector(state => state.themeReducer.mode);

    const dispatch = useAppDispatch();

    const handleToggleDrawer = useCallback(() => {
      dispatch(toggleScheduleDrawer());
    }, [dispatch]);

    const handleToggleProject = useCallback(
      (id: string) => {
        if (expandedProject != id) {
          dispatch(fetchMemberProjects({ id }));
        }
        setExpandedProject(expandedProject === id ? null : id);
      },
      [expandedProject, setExpandedProject]
    );

    return (
      <Flex
        vertical
        style={{
          width: 370,
          marginBlockStart: 60,
          borderTop: themeMode === 'dark' ? '1px solid #303030' : '1px solid #e5e7eb',
        }}
      >
        {/* right side of the table */}
        <div
          id="members-header"
          style={{
            position: 'fixed',
            top: 0,
            zIndex: 100,
            width: 370,
            height: '60px',
            backgroundColor: themeMode === 'dark' ? '#141414' : '#fff',
          }}
        ></div>

        <Flex
          vertical
          ref={membersScrollRef}
          onScroll={() => syncVerticalScroll('members')}
          style={{
            maxHeight: 'calc(100vh - 278px)',
            overflow: 'auto',
          }}
        >
          {members.map(member => (
            <Flex vertical key={member.id}>
              <Flex
                gap={8}
                align="center"
                justify="space-between"
                style={{
                  paddingInline: 12,
                  height: 90,
                }}
              >
                <Flex gap={8} align="center">
                  <CustomAvatar avatarName={member?.name} size={32} />
                  <Button
                    type="text"
                    size="small"
                    style={{ padding: 0 }}
                    onClick={handleToggleDrawer}
                  >
                    {member.name}
                  </Button>
                </Flex>
                <Button size="small" type="text" onClick={() => handleToggleProject(member.id)}>
                  {expandedProject === member.id ? <CaretDownOutlined /> : <CaretRightFilled />}
                </Button>
              </Flex>

              {expandedProject === member.id &&
                member.projects.map((project: any, index: any) => {
                  return (
                    <Flex
                      gap={8}
                      align="center"
                      key={index}
                      style={{
                        paddingInline: 12,
                        position: 'sticky',
                        height: 65,
                      }}
                    >
                      <Badge color="red" />
                      <Tooltip
                        title={
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span>
                              {t('startDate')}: {project?.date_union?.start}
                            </span>
                            <span>
                              {t('endDate')}: {project?.date_union?.end}
                            </span>
                          </div>
                        }
                      >
                        {project.name}
                      </Tooltip>
                    </Flex>
                  );
                })}
            </Flex>
          ))}
        </Flex>
      </Flex>
    );
  }
);

export default GranttMembersTable;
