import { Badge, Button, Flex, Tooltip, Progress, Tag, Spin } from '@/shared/antd-imports';
import React, { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '@/hooks/useAppSelector';
import CustomAvatar from '../../CustomAvatar';
import { toggleScheduleDrawer } from '../../../features/schedule/scheduleSlice';
import { CaretDownOutlined, CaretRightFilled, LoadingOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';

type WorkloadStatus = 'available' | 'normal' | 'fully-allocated' | 'overallocated';

type GranttChartMembersTabelProps = {
  members: any[];
  expandedMemberId: string | null;
  onToggleProject: (memberId: string) => void;
  getMemberProjects: (memberId: string) => any[];
  isProjectsLoading: boolean;
  membersScrollRef: any;
  syncVerticalScroll: (source: 'timeline' | 'members') => void;
};

const GranttMembersTable = React.memo(
  ({
    members,
    expandedMemberId,
    onToggleProject,
    getMemberProjects,
    isProjectsLoading,
    membersScrollRef,
    syncVerticalScroll,
  }: GranttChartMembersTabelProps) => {
    // localization
    const { t } = useTranslation('schedule');

    // get theme details
    const themeMode = useAppSelector(state => state.themeReducer.mode);
    const { workingHours } = useAppSelector(state => state.scheduleReducer);

    const dispatch = useAppDispatch();
    const navigate = useNavigate();

    const navigateToProject = useCallback(
      (projectId: string) => {
        navigate(`/worklenz/projects/${projectId}?tab=tasks-list&pinned_tab=tasks-list`);
      },
      [navigate]
    );

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
          {members.map(member => {
            const memberId = member.team_member_id || member.id;
            const isExpanded = expandedMemberId === memberId;
            const projects = getMemberProjects(memberId);

            return (
              <Flex vertical key={memberId}>
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
                    <CustomAvatar avatarName={member?.name}   avatarUrl={member?.avatar_url} size={32} />
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
                        {/* {(() => {
                          const workload = calculateMemberWorkload(member);
                          return (
                            <Tag
                              color={getStatusColor(workload.status)}
                              style={{ fontSize: '10px', margin: 0 }}
                            >
                              {workload.utilizationPercent.toFixed(0)}%
                            </Tag>
                          );
                        })()} */}
                      </Flex>
                      <Tooltip
                        title={(() => {
                          const workload = calculateMemberWorkload(member);
                          return (
                            <div style={{ fontSize: '12px' }}>
                              <div>Projects: {workload.projectCount}</div>
                              {/* <div>Allocated: {workload.totalAllocatedHours}h</div> */}
                              {/* <div>Available: {workload.availableHours}h</div> */}
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
                  <Button
                    size="small"
                    type="text"
                    onClick={() => onToggleProject(memberId)}
                    loading={isProjectsLoading && expandedMemberId === memberId}
                  >
                    {isExpanded ? <CaretDownOutlined /> : <CaretRightFilled />}
                  </Button>
                </Flex>

                {isExpanded &&
                  projects.length > 0 &&
                  (() => {
                    // Group projects by project ID and collect all segments to find earliest start and latest end
                    const groupedProjects = projects.reduce(
                      (acc: Record<string, any>, project: any) => {
                        if (!acc[project.id]) {
                          acc[project.id] = {
                            ...project,
                            allSegments: [project],
                          };
                        } else {
                          acc[project.id].allSegments.push(project);
                          // Update to earliest start date (from segments)
                          if (
                            project?.date_union?.start &&
                            (!acc[project.id].date_union?.start ||
                              project.date_union.start < acc[project.id].date_union.start)
                          ) {
                            acc[project.id].date_union.start = project.date_union.start;
                          }
                          // Update to latest end date (from segments)
                          if (
                            project?.date_union?.end &&
                            (!acc[project.id].date_union?.end ||
                              project.date_union.end > acc[project.id].date_union.end)
                          ) {
                            acc[project.id].date_union.end = project.date_union.end;
                          }
                        }
                        return acc;
                      },
                      {}
                    );

                    return Object.values(groupedProjects).map((project: any, index: any) => {
                      // Use project dates from projects table only
                      const startDate = project?.project_dates?.start;
                      const endDate = project?.project_dates?.end;
                      const hasStartDate = !!startDate;
                      const hasEndDate = !!endDate;
                      const totalHours = project.allSegments.reduce(
                        (sum: number, seg: any) => sum + (seg.total_hours || 0),
                        0
                      );
                      const totalTasks = project.allSegments.reduce(
                        (sum: number, seg: any) => sum + (seg.task_count || 0),
                        0
                      );

                      return (
                        <Flex
                          gap={8}
                          align="center"
                          key={project.id || index}
                          onClick={() => project.id && navigateToProject(project.id)}
                          style={{
                            paddingInline: 12,
                            position: 'sticky',
                            height: 65,
                            cursor: project.id ? 'pointer' : 'default',
                          }}
                        >
                          <Badge color={project.color_code || '#1890ff'} />
                          <Tooltip
                            title={
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <span>
                                  {t('startDate', { defaultValue: 'Start Date' })}:{' '}
                                  {hasStartDate
                                    ? startDate
                                    : t('notSet', { defaultValue: 'Not set' })}
                                </span>
                                <span>
                                  {t('endDate', { defaultValue: 'End Date' })}:{' '}
                                  {hasEndDate ? endDate : t('notSet', { defaultValue: 'Not set' })}
                                </span>
                                {totalTasks > 0 && (
                                  <span>
                                    {t('tasks', { defaultValue: 'Tasks' })}: {totalTasks}
                                  </span>
                                )}
                                {totalHours > 0 && (
                                  <span>
                                    {t('allocatedHours', { defaultValue: 'Allocated Hours' })}:{' '}
                                    {totalHours.toFixed(1)}h
                                  </span>
                                )}
                              </div>
                            }
                          >
                            <span
                              style={{
                                cursor: project.id ? 'pointer' : 'default',
                                color: 'inherit',
                              }}
                            >
                              {project.name}
                            </span>
                          </Tooltip>
                        </Flex>
                      );
                    });
                  })()}

                {isExpanded && projects.length === 0 && !isProjectsLoading && (
                  <Flex
                    align="center"
                    justify="center"
                    style={{
                      paddingInline: 12,
                      height: 65,
                      color: themeMode === 'dark' ? '#666' : '#999',
                    }}
                  >
                    {t('noProjects', { defaultValue: 'No projects assigned' })}
                  </Flex>
                )}
              </Flex>
            );
          })}
        </Flex>
      </Flex>
    );
  }
);

export default GranttMembersTable;
