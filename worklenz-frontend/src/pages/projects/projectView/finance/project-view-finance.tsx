import { Button, ConfigProvider, Flex, Select, Typography, message, Alert, Card, Row, Col, Statistic } from 'antd';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CaretDownFilled, DownOutlined, CalculatorOutlined } from '@ant-design/icons';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { fetchProjectFinances, setActiveTab, setActiveGroup, updateProjectFinanceCurrency, fetchProjectFinancesSilent, setBillableFilter } from '@/features/projects/finance/project-finance.slice';
import { changeCurrency, toggleImportRatecardsDrawer } from '@/features/finance/finance-slice';
import { updateProjectCurrency } from '@/features/project/project.slice';
import { projectFinanceApiService } from '@/api/project-finance-ratecard/project-finance.api.service';
import { RootState } from '@/app/store';
import FinanceTableWrapper from './finance-tab/finance-table/finance-table-wrapper';
import RatecardTable from './ratecard-tab/reatecard-table/ratecard-table';
import ImportRatecardsDrawer from '@/features/finance/ratecard-drawer/import-ratecards-drawer';
import { useAuthService } from '@/hooks/useAuth';
import { hasFinanceEditPermission } from '@/utils/finance-permissions';
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '@/shared/constants/currencies';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';

const ProjectViewFinance = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const dispatch = useAppDispatch();
  const { t } = useTranslation('project-view-finance');
  const [exporting, setExporting] = useState(false);
  const [updatingCurrency, setUpdatingCurrency] = useState(false);
  const { socket } = useSocket();
  
  const { activeTab, activeGroup, billableFilter, loading, taskGroups, project: financeProject } = useAppSelector((state: RootState) => state.projectFinances);
  const { refreshTimestamp, project } = useAppSelector((state: RootState) => state.projectReducer);
  const phaseList = useAppSelector((state) => state.phaseReducer.phaseList);

  // Auth and permissions
  const auth = useAuthService();
  const currentSession = auth.getCurrentSession();
  const hasEditPermission = hasFinanceEditPermission(currentSession, project);

  // Get project-specific currency from finance API response, fallback to project reducer, then default
  const projectCurrency = (financeProject?.currency || project?.currency || DEFAULT_CURRENCY).toLowerCase();

  // Show loading state for currency selector until finance data is loaded
  const currencyLoading = loading || updatingCurrency || !financeProject;

  // Calculate project budget statistics
  const budgetStatistics = useMemo(() => {
    if (!taskGroups || taskGroups.length === 0) {
      return {
        totalEstimatedCost: 0,
        totalFixedCost: 0,
        totalBudget: 0,
        totalActualCost: 0,
        totalVariance: 0,
        budgetUtilization: 0
      };
    }

    const totals = taskGroups.reduce((acc, group) => {
      group.tasks.forEach(task => {
        acc.totalEstimatedCost += task.estimated_cost || 0;
        acc.totalFixedCost += task.fixed_cost || 0;
        acc.totalBudget += task.total_budget || 0;
        acc.totalActualCost += task.total_actual || 0;
        acc.totalVariance += task.variance || 0;
      });
      return acc;
    }, {
      totalEstimatedCost: 0,
      totalFixedCost: 0,
      totalBudget: 0,
      totalActualCost: 0,
      totalVariance: 0
    });

    const budgetUtilization = totals.totalBudget > 0 
      ? (totals.totalActualCost / totals.totalBudget) * 100 
      : 0;

    return {
      ...totals,
      budgetUtilization
    };
  }, [taskGroups]);

  // Silent refresh function for socket events
  const refreshFinanceData = useCallback(() => {
    if (projectId) {
      dispatch(fetchProjectFinancesSilent({ projectId, groupBy: activeGroup, billableFilter }));
    }
  }, [projectId, activeGroup, billableFilter, dispatch]);

  // Socket event handlers
  const handleTaskEstimationChange = useCallback(() => {
    refreshFinanceData();
  }, [refreshFinanceData]);

  const handleTaskTimerStop = useCallback(() => {
    refreshFinanceData();
  }, [refreshFinanceData]);

  const handleTaskProgressUpdate = useCallback(() => {
    refreshFinanceData();
  }, [refreshFinanceData]);

  const handleTaskBillableChange = useCallback(() => {
    refreshFinanceData();
  }, [refreshFinanceData]);

  useEffect(() => {
    if (projectId) {
      dispatch(fetchProjectFinances({ projectId, groupBy: activeGroup, billableFilter }));
    }
  }, [projectId, activeGroup, billableFilter, dispatch, refreshTimestamp]);

  // Socket event listeners for finance data refresh
  useEffect(() => {
    if (!socket) return;

    const eventHandlers = [
      { event: SocketEvents.TASK_TIME_ESTIMATION_CHANGE.toString(), handler: handleTaskEstimationChange },
      { event: SocketEvents.TASK_TIMER_STOP.toString(), handler: handleTaskTimerStop },
      { event: SocketEvents.TASK_PROGRESS_UPDATED.toString(), handler: handleTaskProgressUpdate },
      { event: SocketEvents.TASK_BILLABLE_CHANGE.toString(), handler: handleTaskBillableChange },
    ];

    // Register all event listeners
    eventHandlers.forEach(({ event, handler }) => {
      socket.on(event, handler);
    });

    // Cleanup function
    return () => {
      eventHandlers.forEach(({ event, handler }) => {
        socket.off(event, handler);
      });
    };
  }, [socket, handleTaskEstimationChange, handleTaskTimerStop, handleTaskProgressUpdate, handleTaskBillableChange]);

  const handleExport = async () => {
    if (!projectId) {
      message.error('Project ID not found');
      return;
    }

    try {
      setExporting(true);
      const blob = await projectFinanceApiService.exportFinanceData(projectId, activeGroup, billableFilter);
      
      const projectName = project?.name || 'Unknown_Project';
      const sanitizedProjectName = projectName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
      const dateTime = new Date().toISOString().replace(/[:.]/g, '-').split('T');
      const date = dateTime[0];
      const time = dateTime[1].split('.')[0];
      const filename = `${sanitizedProjectName}_Finance_Data_${date}_${time}.xlsx`;
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      message.success('Finance data exported successfully');
    } catch (error) {
      console.error('Export failed:', error);
      message.error('Failed to export finance data');
    } finally {
      setExporting(false);
    }
  };

  const handleCurrencyChange = async (currency: string) => {
    if (!projectId || !hasEditPermission) {
      message.error('You do not have permission to change the project currency');
      return;
    }

    try {
      setUpdatingCurrency(true);
      const upperCaseCurrency = currency.toUpperCase();
      await projectFinanceApiService.updateProjectCurrency(projectId, upperCaseCurrency);
      
      // Update both global currency state and project-specific currency
      dispatch(changeCurrency(currency));
      dispatch(updateProjectCurrency(upperCaseCurrency));
      dispatch(updateProjectFinanceCurrency(upperCaseCurrency));
      
      message.success('Project currency updated successfully');
    } catch (error) {
      console.error('Currency update failed:', error);
      message.error('Failed to update project currency');
    } finally {
      setUpdatingCurrency(false);
    }
  };

  const groupDropdownMenuItems = [
    { key: 'status', value: 'status', label: t('statusText') },
    { key: 'priority', value: 'priority', label: t('priorityText') },
    {
      key: 'phases',
      value: 'phases',
      label: phaseList.length > 0 ? project?.phase_label || t('phaseText') : t('phaseText'),
    },
  ];

  const billableFilterOptions = [
    { key: 'billable', value: 'billable', label: t('billableOnlyText') },
    { key: 'non-billable', value: 'non-billable', label: t('nonBillableOnlyText') },
    { key: 'all', value: 'all', label: t('allTasksText') },
  ];

  return (
    <Flex vertical gap={16} style={{ overflowX: 'hidden' }}>
      {/* Finance Header */}
      <ConfigProvider wave={{ disabled: true }}>
        <Flex gap={16} align="center" justify="space-between">
          <Flex gap={16} align="center">
            <Flex>
              <Button
                className={`${activeTab === 'finance' && 'border-[#1890ff] text-[#1890ff]'} rounded-r-none`}
                onClick={() => dispatch(setActiveTab('finance'))}
              >
                {t('financeText')}
              </Button>
              <Button
                className={`${activeTab === 'ratecard' && 'border-[#1890ff] text-[#1890ff]'} rounded-l-none`}
                onClick={() => dispatch(setActiveTab('ratecard'))}
              >
                {t('ratecardSingularText')}
              </Button>
            </Flex>

            {activeTab === 'finance' && (
              <Flex align="center" gap={16} style={{ marginInlineStart: 12 }}>
                <Flex align="center" gap={4}>
                  {t('groupByText')}:
                  <Select
                    value={activeGroup}
                    options={groupDropdownMenuItems}
                    onChange={(value) => dispatch(setActiveGroup(value as 'status' | 'priority' | 'phases'))}
                    suffixIcon={<CaretDownFilled />}
                  />
                </Flex>
                <Flex align="center" gap={4}>
                  {t('filterText')}:
                  <Select
                    value={billableFilter}
                    options={billableFilterOptions}
                    onChange={(value) => dispatch(setBillableFilter(value as 'all' | 'billable' | 'non-billable'))}
                    suffixIcon={<CaretDownFilled />}
                    style={{ minWidth: 140 }}
                  />
                </Flex>
              </Flex>
            )}
          </Flex>

          {activeTab === 'finance' ? (
            <Button 
              type="primary" 
              icon={<DownOutlined />} 
              iconPosition="end"
              loading={exporting}
              onClick={handleExport}
            >
              {t('exportButton')}
            </Button>
          ) : (
            <Flex gap={8} align="center">
              <Flex gap={8} align="center">
                <Typography.Text>{t('currencyText')}</Typography.Text>
                <Select
                  value={projectCurrency}
                  loading={currencyLoading}
                  disabled={!hasEditPermission}
                  options={CURRENCY_OPTIONS}
                  onChange={handleCurrencyChange}
                />
              </Flex>
              <Button
                type="primary"
                onClick={() => dispatch(toggleImportRatecardsDrawer())}
              >
                {t('importButton')}
              </Button>
            </Flex>
          )}
        </Flex>
      </ConfigProvider>

      {/* Tab Content */}
      {activeTab === 'finance' ? (
        <div>
          {!hasEditPermission && (
            <Alert
              message="Limited Access"
              description="You can view finance data but cannot edit fixed costs. Only project managers, team admins, and team owners can make changes."
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}
          
          {/* Budget Statistics */}
          <Card 
            title={
              <Flex align="center" gap={8}>
                <CalculatorOutlined />
                <Typography.Text strong>Project Budget Overview</Typography.Text>
              </Flex>
            }
            style={{ marginBottom: 16 }}
            loading={loading}
            size="small"
          >
            <Row gutter={[12, 8]}>
              <Col xs={12} sm={8} md={6} lg={4} xl={3}>
                <Statistic
                  title="Total Budget"
                  value={budgetStatistics.totalBudget}
                  precision={2}
                  prefix={projectCurrency.toUpperCase()}
                  valueStyle={{ color: '#1890ff', fontSize: '16px' }}
                  style={{ textAlign: 'center' }}
                />
              </Col>
              <Col xs={12} sm={8} md={6} lg={4} xl={3}>
                <Statistic
                  title="Actual Cost"
                  value={budgetStatistics.totalActualCost}
                  precision={2}
                  prefix={projectCurrency.toUpperCase()}
                  valueStyle={{ color: '#52c41a', fontSize: '16px' }}
                  style={{ textAlign: 'center' }}
                />
              </Col>
              <Col xs={12} sm={8} md={6} lg={4} xl={3}>
                <Statistic
                  title="Variance"
                  value={Math.abs(budgetStatistics.totalVariance)}
                  precision={2}
                  prefix={projectCurrency.toUpperCase()}
                  suffix={budgetStatistics.totalVariance < 0 ? ' under' : budgetStatistics.totalVariance > 0 ? ' over' : ''}
                  valueStyle={{ 
                    color: budgetStatistics.totalVariance > 0 ? '#ff4d4f' : '#52c41a',
                    fontSize: '16px'
                  }}
                  style={{ textAlign: 'center' }}
                />
              </Col>
              <Col xs={12} sm={8} md={6} lg={4} xl={3}>
                <Statistic
                  title="Utilization"
                  value={budgetStatistics.budgetUtilization}
                  precision={1}
                  suffix="%"
                  valueStyle={{ 
                    color: budgetStatistics.budgetUtilization > 100 ? '#ff4d4f' : 
                           budgetStatistics.budgetUtilization > 80 ? '#faad14' : '#52c41a',
                    fontSize: '16px'
                  }}
                  style={{ textAlign: 'center' }}
                />
              </Col>
              <Col xs={12} sm={8} md={6} lg={4} xl={3}>
                <Statistic
                  title="Estimated"
                  value={budgetStatistics.totalEstimatedCost}
                  precision={2}
                  prefix={projectCurrency.toUpperCase()}
                  valueStyle={{ color: '#722ed1', fontSize: '16px' }}
                  style={{ textAlign: 'center' }}
                />
              </Col>
              <Col xs={12} sm={8} md={6} lg={4} xl={3}>
                <Statistic
                  title="Fixed Cost"
                  value={budgetStatistics.totalFixedCost}
                  precision={2}
                  prefix={projectCurrency.toUpperCase()}
                  valueStyle={{ color: '#fa8c16', fontSize: '16px' }}
                  style={{ textAlign: 'center' }}
                />
              </Col>
              <Col xs={12} sm={8} md={6} lg={4} xl={3}>
                <Statistic
                  title="Time Logs"
                  value={budgetStatistics.totalActualCost - budgetStatistics.totalFixedCost}
                  precision={2}
                  prefix={projectCurrency.toUpperCase()}
                  valueStyle={{ color: '#13c2c2', fontSize: '16px' }}
                  style={{ textAlign: 'center' }}
                />
              </Col>
              <Col xs={12} sm={8} md={6} lg={4} xl={3}>
                <Statistic
                  title="Remaining"
                  value={budgetStatistics.totalBudget - budgetStatistics.totalActualCost}
                  precision={2}
                  prefix={budgetStatistics.totalBudget - budgetStatistics.totalActualCost >= 0 ? '+' : ''}
                  suffix={projectCurrency.toUpperCase()}
                  valueStyle={{ 
                    color: budgetStatistics.totalBudget - budgetStatistics.totalActualCost >= 0 ? '#52c41a' : '#ff4d4f',
                    fontSize: '16px'
                  }}
                  style={{ textAlign: 'center' }}
                />
              </Col>
            </Row>
          </Card>
          
          <FinanceTableWrapper activeTablesList={taskGroups} loading={loading} />
        </div>
      ) : (
        <Flex vertical gap={8}>
          {!hasEditPermission && (
            <Alert
              message="Limited Access"
              description="You can view rate card data but cannot edit rates or manage member assignments. Only project managers, team admins, and team owners can make changes."
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}
          <RatecardTable />
          <Typography.Text
            type="danger"
            style={{ display: 'block', marginTop: '10px' }}
          >
            {t('ratecardImportantNotice')}
          </Typography.Text>
          <ImportRatecardsDrawer />
        </Flex>
      )}
    </Flex>
  );
};

export default ProjectViewFinance;
