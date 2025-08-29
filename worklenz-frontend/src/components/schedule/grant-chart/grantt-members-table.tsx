import { Badge, Button, Flex, Tooltip, Progress, Tag } from '@/shared/antd-imports';
import React, { useCallback, useMemo } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import CustomAvatar from '../../CustomAvatar';
import {
  fetchMemberProjects,
  toggleScheduleDrawer,
} from '../../../features/schedule/scheduleSlice';
import { CaretDownOutlined, CaretRightFilled } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';

type WorkloadStatus = 'available' | 'normal' | 'fully-allocated' | 'overallocated';

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
    const { workingHours } = useAppSelector(state => state.scheduleReducer);

    const dispatch = useAppDispatch();

    // Calculate member workload statistics
    const calculateMemberWorkload = useMemo(() => {
      return (member: any) => {
        if (!member.projects || member.projects.length === 0) {
          return {
            totalAllocatedHours: 0,
            utilizationPercent: 0,
            status: 'available' as WorkloadStatus,
            availableHours: workingHours,
            projectCount: 0,
          };
        }

        const totalAllocatedHours = member.projects.reduce((sum: number, project: any) => {
          return sum + (project.allocated_hours || 0);
        }, 0);

        const utilizationPercent =
          workingHours > 0 ? (totalAllocatedHours / workingHours) * 100 : 0;

        let status: WorkloadStatus = 'available';
        if (utilizationPercent > 100) status = 'overallocated';
        else if (utilizationPercent === 100) status = 'fully-allocated';
        else if (utilizationPercent >= 75) status = 'normal';

        return {
          totalAllocatedHours,
          utilizationPercent,
          status,
          availableHours: workingHours,
          projectCount: member.projects.length,
        };
      };
    }, [workingHours]);

    const getStatusColor = (status: WorkloadStatus) => {
      switch (status) {
        case 'available':
          return '#52c41a'; // Green
        case 'normal':
          return '#1890ff'; // Blue
        case 'fully-allocated':
          return '#faad14'; // Orange
        case 'overallocated':
          return '#f5222d'; // Red
        default:
          return '#d9d9d9'; // Gray
      }
    };

    const getStatusText = (status: WorkloadStatus) => {
      switch (status) {
        case 'available':
          return t('available') || 'Available';
        case 'normal':
          return t('normal') || 'Normal';
        case 'fully-allocated':
          return t('fullyAllocated') || 'Fully Allocated';
        case 'overallocated':
          return t('overAllocated') || 'Over Allocated';
        default:
          return t('unknown') || 'Unknown';
      }
    };

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
                <Flex gap={12} align="center" style={{ flex: 1 }}>
                  <CustomAvatar avatarName={member?.name} size={32} />
                  <Flex vertical gap={4} style={{ flex: 1 }}>
                    <Flex align="center" gap={8}>
                      <Button
                        type="text"
                        size="small"
                        style={{ padding: 0, fontWeight: 500 }}
                        onClick={handleToggleDrawer}
                      >
                        {member.name}
                      </Button>
                      {(() => {
                        const workload = calculateMemberWorkload(member);
                        return (
                          <Tag
                            color={getStatusColor(workload.status)}
                            size="small"
                            style={{ fontSize: '10px', margin: 0 }}
                          >
                            {workload.utilizationPercent.toFixed(0)}%
                          </Tag>
                        );
                      })()}
                    </Flex>
                    <Tooltip
                      title={(() => {
                        const workload = calculateMemberWorkload(member);
                        return (
                          <div style={{ fontSize: '12px' }}>
                            <div>Projects: {workload.projectCount}</div>
                            <div>Allocated: {workload.totalAllocatedHours}h</div>
                            <div>Available: {workload.availableHours}h</div>
                            <div>Status: {getStatusText(workload.status)}</div>
                          </div>
                        );
                      })()}
                    >
                      <Progress
                        percent={(() => {
                          const workload = calculateMemberWorkload(member);
                          return Math.min(workload.utilizationPercent, 100);
                        })()}
                        size="small"
                        strokeColor={(() => {
                          const workload = calculateMemberWorkload(member);
                          return getStatusColor(workload.status);
                        })()}
                        showInfo={false}
                        style={{ width: '100%', margin: 0 }}
                      />
                    </Tooltip>
                  </Flex>
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
