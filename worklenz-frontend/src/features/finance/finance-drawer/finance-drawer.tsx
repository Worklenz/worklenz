import React, { useEffect, useState } from 'react';
import { Drawer, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../../../hooks/useAppSelector';
import { useAppDispatch } from '../../../hooks/useAppDispatch';
import { themeWiseColor } from '../../../utils/themeWiseColor';
import { toggleFinanceDrawer } from '../finance-slice';

const FinanceDrawer = ({ task }: { task: any }) => {
  const [selectedTask, setSelectedTask] = useState(task);

  useEffect(() => {
    setSelectedTask(task);
  }, [task]);

  // localization
  const { t } = useTranslation('project-view-finance');

  // get theme data from theme reducer
  const themeMode = useAppSelector((state) => state.themeReducer.mode);

  const isDrawerOpen = useAppSelector(
    (state) => state.financeReducer.isFinanceDrawerOpen
  );
  const dispatch = useAppDispatch();
  const currency = useAppSelector(
    (state) => state.financeReducer.currency
  ).toUpperCase();

  // function handle drawer close
  const handleClose = () => {
    setSelectedTask(null);
    dispatch(toggleFinanceDrawer());
  };

  // group members by job roles and calculate labor hours and costs
  const groupedMembers =
    selectedTask?.members?.reduce((acc: any, member: any) => {
      const memberHours = selectedTask.hours / selectedTask.members.length;
      const memberCost = memberHours * member.hourlyRate;

      if (!acc[member.jobRole]) {
        acc[member.jobRole] = {
          jobRole: member.jobRole,
          laborHours: 0,
          cost: 0,
          members: [],
        };
      }

      acc[member.jobRole].laborHours += memberHours;
      acc[member.jobRole].cost += memberCost;
      acc[member.jobRole].members.push({
        name: member.name,
        laborHours: memberHours,
        cost: memberCost,
      });

      return acc;
    }, {}) || {};

  return (
    <Drawer
      title={
        <Typography.Text style={{ fontWeight: 500, fontSize: 16 }}>
          {selectedTask?.task || t('noTaskSelected')}
        </Typography.Text>
      }
      open={isDrawerOpen}
      onClose={handleClose}
      destroyOnClose={true}
      width={480}
    >
      <div>
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

          <div className="mb-4"></div>

          <tbody>
            {Object.values(groupedMembers).map((group: any) => (
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
                    {group.laborHours}
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      padding: 8,
                    }}
                  >
                    {group.cost}
                  </td>
                </tr>
                {/* Member Rows */}
                {group.members.map((member: any, index: number) => (
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
                      {member.laborHours}
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        padding: 8,
                      }}
                    >
                      {member.cost}
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </Drawer>
  );
};

export default FinanceDrawer;
