import React, { useEffect, useState } from 'react';
import { Drawer, Typography, Spin } from 'antd';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../../../hooks/useAppSelector';
import { useAppDispatch } from '../../../hooks/useAppDispatch';
import { themeWiseColor } from '../../../utils/themeWiseColor';
import { closeFinanceDrawer } from '../finance-slice';
import { projectFinanceApiService } from '../../../api/project-finance-ratecard/project-finance.api.service';
import { ITaskBreakdownResponse } from '../../../types/project/project-finance.types';

const FinanceDrawer = () => {
  const [taskBreakdown, setTaskBreakdown] = useState<ITaskBreakdownResponse | null>(null);
  const [loading, setLoading] = useState(false);

  // Get task and drawer state from Redux store
  const selectedTask = useAppSelector((state) => state.financeReducer.selectedTask);
  const isDrawerOpen = useAppSelector((state) => state.financeReducer.isFinanceDrawerOpen);

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
  const themeMode = useAppSelector((state) => state.themeReducer.mode);

  const dispatch = useAppDispatch();
  const currency = useAppSelector(
    (state) => state.financeReducer.currency
  ).toUpperCase();

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
      destroyOnClose={true}
      width={480}
    >
      <div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <Spin size="large" />
          </div>
        ) : (
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
                  backgroundColor: themeWiseColor(
                    '#F5F5F5',
                    '#1d1d1d',
                    themeMode
                  ),
                }}
              >
                <th
                  style={{
                    textAlign: 'left',
                    padding: 8,
                  }}
                ></th>
                <th
                  style={{
                    textAlign: 'right',
                    padding: 8,
                  }}
                >
                  {t('labourHoursColumn')}
                </th>
                <th
                  style={{
                    textAlign: 'right',
                    padding: 8,
                  }}
                >
                  {t('costColumn')} ({currency})
                </th>
              </tr>
            </thead>

            <tbody>
              {taskBreakdown?.grouped_members?.map((group: any) => (
                <React.Fragment key={group.jobRole}>
                  {/* Group Header */}
                  <tr
                    style={{
                      backgroundColor: themeWiseColor(
                        '#D9D9D9',
                        '#000',
                        themeMode
                      ),
                      height: 56,
                    }}
                    className="border-b-[1px] font-semibold"
                  >
                    <td style={{ padding: 8 }}>{group.jobRole}</td>
                    <td
                      style={{
                        textAlign: 'right',
                        padding: 8,
                      }}
                    >
                      {group.estimated_hours?.toFixed(2) || '0.00'}
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        padding: 8,
                      }}
                    >
                      {group.estimated_cost?.toFixed(2) || '0.00'}
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
                        {member.estimated_hours?.toFixed(2) || '0.00'}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          padding: 8,
                        }}
                      >
                        {member.estimated_cost?.toFixed(2) || '0.00'}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Drawer>
  );
};

export default FinanceDrawer;
