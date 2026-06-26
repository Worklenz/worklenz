import React, { useEffect, useState } from 'react';
import { Drawer, Typography, Spin } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { themeWiseColor } from '@/utils/themeWiseColor';
import { closeFinanceDrawer } from '@/features/projects/finance/finance-slice';
import { projectFinanceApiService } from '@/api/project-finance-ratecard/project-finance.api.service';
import { ITaskBreakdownResponse } from '@/types/project/project-finance.types';

const FinanceDrawer = () => {
  const [taskBreakdown, setTaskBreakdown] = useState<ITaskBreakdownResponse | null>(null);
  const [loading, setLoading] = useState(false);

  // Get task and drawer state from Redux store
  const selectedTask = useAppSelector(state => state.financeReducer.selectedTask);
  const isDrawerOpen = useAppSelector(state => state.financeReducer.isFinanceDrawerOpen);

  useEffect(() => {
    if (selectedTask?.id && isDrawerOpen) {
      fetchTaskBreakdown(selectedTask.id);
    } else {
      setTaskBreakdown(null);
    }
  }, [selectedTask, isDrawerOpen]);

  const fetchTaskBreakdown = async (taskId: string) => {
    try {
      setLoading(true);
      const response = await projectFinanceApiService.getTaskBreakdown(taskId);
      setTaskBreakdown(response.body);
    } catch (error) {
      console.error('Error fetching task breakdown:', error);
    } finally {
      setLoading(false);
    }
  };

  // localization
  const { t } = useTranslation('project-view-finance');

  // get theme data from theme reducer
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  const dispatch = useAppDispatch();

  // Get project currency from project finances, fallback to finance reducer currency
  const projectCurrency = useAppSelector(state => state.projectFinancesReducer.project?.currency);
  const fallbackCurrency = useAppSelector(state => state.financeReducer.currency);
  const currency = (projectCurrency || fallbackCurrency || 'USD').toUpperCase();

  // function handle drawer close
  const handleClose = () => {
    setTaskBreakdown(null);
    dispatch(closeFinanceDrawer());
  };

  return (
    <Drawer
      title={
        <Typography.Text style={{ fontWeight: 500, fontSize: 16 }}>
          {taskBreakdown?.task?.name || selectedTask?.name || t('noTaskSelected')}
        </Typography.Text>
      }
      open={isDrawerOpen}
      onClose={handleClose}
      destroyOnHidden={true}
      width={640}
    >
      <div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <Spin size="large" />
          </div>
        ) : (
          <>
            {/* Task Summary */}
            {taskBreakdown?.task && (
              <div
                style={{
                  marginBottom: 24,
                  padding: 16,
                  backgroundColor: themeWiseColor('#f9f9f9', '#1a1a1a', themeMode),
                  borderRadius: 8,
                }}
              >
                <Typography.Text
                  strong
                  style={{ fontSize: 16, display: 'block', marginBottom: 12 }}
                >
                  Task Overview
                </Typography.Text>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: 16,
                  }}
                >
                  <div>
                    <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                      Estimated Hours
                    </Typography.Text>
                    <Typography.Text strong style={{ fontSize: 16 }}>
                      {taskBreakdown.task.estimated_hours?.toFixed(2) || '0.00'}
                    </Typography.Text>
                  </div>
                  <div>
                    <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                      Total Logged Hours
                    </Typography.Text>
                    <Typography.Text strong style={{ fontSize: 16 }}>
                      {taskBreakdown.task.logged_hours?.toFixed(2) || '0.00'}
                    </Typography.Text>
                  </div>
                  <div>
                    <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                      Estimated Labor Cost ({currency})
                    </Typography.Text>
                    <Typography.Text strong style={{ fontSize: 16 }}>
                      {taskBreakdown.task.estimated_labor_cost?.toFixed(2) || '0.00'}
                    </Typography.Text>
                  </div>
                  <div>
                    <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                      Actual Labor Cost ({currency})
                    </Typography.Text>
                    <Typography.Text strong style={{ fontSize: 16 }}>
                      {taskBreakdown.task.actual_labor_cost?.toFixed(2) || '0.00'}
                    </Typography.Text>
                  </div>
                  <div>
                    <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                      Fixed Cost ({currency})
                    </Typography.Text>
                    <Typography.Text strong style={{ fontSize: 16 }}>
                      {taskBreakdown.task.fixed_cost?.toFixed(2) || '0.00'}
                    </Typography.Text>
                  </div>
                  <div>
                    <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                      Total Actual Cost ({currency})
                    </Typography.Text>
                    <Typography.Text strong style={{ fontSize: 16 }}>
                      {taskBreakdown.task.total_actual_cost?.toFixed(2) || '0.00'}
                    </Typography.Text>
                  </div>
                </div>
              </div>
            )}

            {/* Member Breakdown Table */}
            <Typography.Text strong style={{ fontSize: 14, display: 'block', marginBottom: 12 }}>
              Member Time Logs & Costs
            </Typography.Text>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                marginBottom: '16px',
              }}
            >
              <thead>
                <tr
                  style={{
                    height: 48,
                    backgroundColor: themeWiseColor('#F5F5F5', '#1d1d1d', themeMode),
                  }}
                >
                  <th
                    style={{
                      textAlign: 'left',
                      padding: 8,
                    }}
                  >
                    Role / Member
                  </th>
                  <th
                    style={{
                      textAlign: 'right',
                      padding: 8,
                    }}
                  >
                    Logged Hours
                  </th>
                  <th
                    style={{
                      textAlign: 'right',
                      padding: 8,
                    }}
                  >
                    Hourly Rate ({currency})
                  </th>
                  <th
                    style={{
                      textAlign: 'right',
                      padding: 8,
                    }}
                  >
                    Actual Cost ({currency})
                  </th>
                </tr>
              </thead>

              <tbody>
                {taskBreakdown?.grouped_members?.map((group: any) => (
                  <React.Fragment key={group.jobRole}>
                    {/* Group Header */}
                    <tr
                      style={{
                        backgroundColor: themeWiseColor('#D9D9D9', '#000', themeMode),
                        height: 56,
                      }}
                      className="border-b-[1px] font-semibold"
                    >
                      <td style={{ padding: 8, fontWeight: 'bold' }}>{group.jobRole}</td>
                      <td
                        style={{
                          textAlign: 'right',
                          padding: 8,
                          fontWeight: 'bold',
                        }}
                      >
                        {group.logged_hours?.toFixed(2) || '0.00'}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          padding: 8,
                          fontWeight: 'bold',
                          color: '#999',
                        }}
                      >
                        -
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          padding: 8,
                          fontWeight: 'bold',
                        }}
                      >
                        {group.actual_cost?.toFixed(2) || '0.00'}
                      </td>
                    </tr>
                    {/* Member Rows */}
                    {group.members?.map((member: any, index: number) => (
                      <tr
                        key={`${group.jobRole}-${index}`}
                        className="border-b-[1px]"
                        style={{ height: 56 }}
                      >
                        <td
                          style={{
                            padding: 8,
                            paddingLeft: 32,
                          }}
                        >
                          {member.name}
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            padding: 8,
                          }}
                        >
                          {member.logged_hours?.toFixed(2) || '0.00'}
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            padding: 8,
                          }}
                        >
                          {member.hourly_rate?.toFixed(2) || '0.00'}
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            padding: 8,
                          }}
                        >
                          {member.actual_cost?.toFixed(2) || '0.00'}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </Drawer>
  );
};

export default FinanceDrawer;
