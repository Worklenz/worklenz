import {
  Button,
  ConfigProvider,
  Flex,
  Select,
  Typography,
  message,
  Alert,
  Card,
  Row,
  Col,
  Statistic,
  Tooltip,
  Input,
  Modal,
  CaretDownFilled,
  DownOutlined,
  CalculatorOutlined,
  SettingOutlined,
  EditOutlined,
} from '@/shared/antd-imports';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  fetchProjectFinances,
  setActiveTab,
  setActiveGroup,
  updateProjectFinanceCurrency,
  fetchProjectFinancesSilent,
  setBillableFilter,
} from '@/features/projects/finance/project-finance.slice';
import { changeCurrency, toggleImportRatecardsDrawer } from '@/features/finance/finance-slice';
import { updateProjectCurrency, getProject } from '@/features/project/project.slice';
import { projectFinanceApiService } from '@/api/project-finance-ratecard/project-finance.api.service';
import { RootState } from '@/app/store';
import FinanceTableWrapper from '@/components/projects/project-finance/finance-table-wrapper/FinanceTableWrapper';
import ImportRatecardsDrawer from '@/components/projects/import-ratecards-drawer/ImportRateCardsDrawer';
import { useAuthService } from '@/hooks/useAuth';
import { hasFinanceEditPermission } from '@/utils/finance-permissions';
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '@/shared/currencies';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import RateCardTable from '@/components/projects/project-finance/ratecard-table/RateCardTable';
import ProjectBudgetSettingsDrawer from '@/components/projects/project-budget-settings-drawer/ProjectBudgetSettingsDrawer';
import { hasBusinessFeatureAccess } from '@/utils/subscription-utils';

const ProjectViewFinance = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const dispatch = useAppDispatch();
  const { t } = useTranslation('project-view-finance');
  const [exporting, setExporting] = useState(false);
  const [updatingCurrency, setUpdatingCurrency] = useState(false);
  const [updatingBudget, setUpdatingBudget] = useState(false);
  const [budgetModalVisible, setBudgetModalVisible] = useState(false);
  const [budgetValue, setBudgetValue] = useState<string>('');
  const [budgetSettingsDrawerVisible, setBudgetSettingsDrawerVisible] = useState(false);
  const { socket } = useSocket();

  const {
    activeTab,
    activeGroup,
    billableFilter,
    loading,
    taskGroups,
    project: financeProject,
  } = useAppSelector((state: RootState) => state.projectFinancesReducer);
  const { refreshTimestamp, project } = useAppSelector((state: RootState) => state.projectReducer);
  const phaseList = useAppSelector(state => state.phaseReducer.phaseList);

  // Auth and permissions
  const auth = useAuthService();
  const currentSession = auth.getCurrentSession();
  const hasEditPermission = hasFinanceEditPermission(currentSession, project);
  const hasBusinessAccess = hasBusinessFeatureAccess(currentSession);

  // Get project-specific currency from finance API response, fallback to project reducer, then default
  const projectCurrency = (
    financeProject?.currency ||
    project?.currency ||
    DEFAULT_CURRENCY
  ).toLowerCase();

  // Show loading state for currency selector until finance data is loaded
  const currencyLoading = loading || updatingCurrency || !financeProject;

  // Calculate project budget statistics
  const budgetStatistics = useMemo(() => {
    if (!taskGroups || taskGroups.length === 0) {
      const manualBudget = project?.budget || 0;
      const hasManualBudget = !!(project?.budget && project.budget > 0);
      return {
        totalEstimatedHours: 0,
        totalFixedCost: 0,
        totalTimeBasedCost: 0,
        totalBudget: manualBudget,
        totalActualCost: 0,
        totalVariance: manualBudget,
        budgetUtilization: 0,
        manualBudget,
        hasManualBudget,
      };
    }

    // Optimized calculation that avoids double counting in nested hierarchies
    const calculateTaskTotalsFlat = (tasks: any[]): any => {
      let totals = {
        totalEstimatedHours: 0,
        totalFixedCost: 0,
        totalTimeBasedCost: 0,
      };

      for (const task of tasks) {
        if (task.sub_tasks && task.sub_tasks.length > 0) {
          totals.totalEstimatedHours += (task.estimated_seconds || 0) / 3600;
          totals.totalFixedCost += task.fixed_cost || 0;
          totals.totalTimeBasedCost += task.actual_cost_from_logs || 0;
        } else {
          totals.totalEstimatedHours += (task.estimated_seconds || 0) / 3600;
          totals.totalFixedCost += task.fixed_cost || 0;
          totals.totalTimeBasedCost += task.actual_cost_from_logs || 0;
        }
      }
      return totals;
    };

    const totals = taskGroups.reduce(
      (
        acc: { totalEstimatedHours: any; totalFixedCost: any; totalTimeBasedCost: any },
        group: { tasks: any[] }
      ) => {
        const groupTotals = calculateTaskTotalsFlat(group.tasks);
        return {
          totalEstimatedHours: acc.totalEstimatedHours + groupTotals.totalEstimatedHours,
          totalFixedCost: acc.totalFixedCost + groupTotals.totalFixedCost,
          totalTimeBasedCost: acc.totalTimeBasedCost + groupTotals.totalTimeBasedCost,
        };
      },
      {
        totalEstimatedHours: 0,
        totalFixedCost: 0,
        totalTimeBasedCost: 0,
      }
    );

    const manualBudget = project?.budget || 0;
    const hasManualBudget = !!(project?.budget && project.budget > 0);

    const totalActualCost = totals.totalTimeBasedCost + totals.totalFixedCost;
    const totalVariance = manualBudget - totalActualCost;
    const budgetUtilization = manualBudget > 0 ? (totalActualCost / manualBudget) * 100 : 0;

    return {
      totalEstimatedHours: totals.totalEstimatedHours,
      totalFixedCost: totals.totalFixedCost,
      totalTimeBasedCost: totals.totalTimeBasedCost,
      totalBudget: manualBudget,
      totalActualCost,
      totalVariance,
      budgetUtilization,
      manualBudget,
      hasManualBudget,
    };
  }, [taskGroups, project?.budget]);

  // Silent refresh function for socket events
  const refreshFinanceData = useCallback(
    (resetExpansions = false) => {
      if (projectId) {
        dispatch(
          fetchProjectFinancesSilent({
            projectId,
            groupBy: activeGroup,
            billableFilter,
            resetExpansions,
          })
        );
      }
    },
    [projectId, activeGroup, billableFilter, dispatch]
  );

  // Socket event handlers
  const handleTaskEstimationChange = useCallback(() => {
    refreshFinanceData(true); // Reset expansions when task estimation changes
  }, [refreshFinanceData]);

  const handleTaskTimerStop = useCallback(() => {
    refreshFinanceData(true); // Reset expansions when timer stops (time logged changes)
  }, [refreshFinanceData]);

  const handleTaskProgressUpdate = useCallback(() => {
    refreshFinanceData(true); // Reset expansions when task progress updates
  }, [refreshFinanceData]);

  const handleTaskBillableChange = useCallback(() => {
    refreshFinanceData(true); // Reset expansions when billable status changes
  }, [refreshFinanceData]);

  // Additional socket event handlers for task drawer updates
  const handleTaskNameChange = useCallback(() => {
    refreshFinanceData(true); // Reset expansions when task name changes from drawer
  }, [refreshFinanceData]);

  const handleTaskStatusChange = useCallback(() => {
    refreshFinanceData(true); // Reset expansions when task status changes from drawer
  }, [refreshFinanceData]);

  const handleTaskPriorityChange = useCallback(() => {
    refreshFinanceData(true); // Reset expansions when task priority changes from drawer
  }, [refreshFinanceData]);

  const handleTaskPhaseChange = useCallback(() => {
    refreshFinanceData(true); // Reset expansions when task phase changes from drawer
  }, [refreshFinanceData]);

  const handleTaskAssigneesChange = useCallback(() => {
    refreshFinanceData(true); // Reset expansions when task assignees change from drawer
  }, [refreshFinanceData]);

  const handleTaskStartDateChange = useCallback(() => {
    refreshFinanceData(true); // Reset expansions when task start date changes from drawer
  }, [refreshFinanceData]);

  const handleTaskEndDateChange = useCallback(() => {
    refreshFinanceData(true); // Reset expansions when task end date changes from drawer
  }, [refreshFinanceData]);

  const handleProjectUpdatesAvailable = useCallback(() => {
    refreshFinanceData(true); // Reset expansions when project updates are available (includes task deletion)
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
      {
        event: SocketEvents.TASK_TIME_ESTIMATION_CHANGE.toString(),
        handler: handleTaskEstimationChange,
      },
      { event: SocketEvents.TASK_TIMER_STOP.toString(), handler: handleTaskTimerStop },
      { event: SocketEvents.TASK_PROGRESS_UPDATED.toString(), handler: handleTaskProgressUpdate },
      { event: SocketEvents.TASK_BILLABLE_CHANGE.toString(), handler: handleTaskBillableChange },
      // Task drawer update events
      { event: SocketEvents.TASK_NAME_CHANGE.toString(), handler: handleTaskNameChange },
      { event: SocketEvents.TASK_STATUS_CHANGE.toString(), handler: handleTaskStatusChange },
      { event: SocketEvents.TASK_PRIORITY_CHANGE.toString(), handler: handleTaskPriorityChange },
      { event: SocketEvents.TASK_PHASE_CHANGE.toString(), handler: handleTaskPhaseChange },
      { event: SocketEvents.TASK_ASSIGNEES_CHANGE.toString(), handler: handleTaskAssigneesChange },
      { event: SocketEvents.TASK_START_DATE_CHANGE.toString(), handler: handleTaskStartDateChange },
      { event: SocketEvents.TASK_END_DATE_CHANGE.toString(), handler: handleTaskEndDateChange },
      {
        event: SocketEvents.PROJECT_UPDATES_AVAILABLE.toString(),
        handler: handleProjectUpdatesAvailable,
      },
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
  }, [
    socket,
    handleTaskEstimationChange,
    handleTaskTimerStop,
    handleTaskProgressUpdate,
    handleTaskBillableChange,
    handleTaskNameChange,
    handleTaskStatusChange,
    handleTaskPriorityChange,
    handleTaskPhaseChange,
    handleTaskAssigneesChange,
    handleTaskStartDateChange,
    handleTaskEndDateChange,
    handleProjectUpdatesAvailable,
  ]);

  const handleExport = async () => {
    if (!projectId) {
      message.error('Project ID not found');
      return;
    }

    try {
      setExporting(true);
      const blob = await projectFinanceApiService.exportFinanceData(
        projectId,
        activeGroup,
        billableFilter
      );

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

  const handleBudgetUpdate = async () => {
    if (!projectId || !hasEditPermission) {
      message.error('You do not have permission to change the project budget');
      return;
    }

    const budget = parseFloat(budgetValue);
    if (isNaN(budget) || budget < 0) {
      message.error('Please enter a valid budget amount');
      return;
    }

    try {
      setUpdatingBudget(true);
      await projectFinanceApiService.updateProjectBudget(projectId, budget);

      // Refresh the project data to get updated budget
      refreshFinanceData();

      // Also refresh the main project data to update budget statistics
      dispatch(getProject(projectId));

      message.success('Project budget updated successfully');
      setBudgetModalVisible(false);
    } catch (error) {
      console.error('Budget update failed:', error);
      message.error('Failed to update project budget');
    } finally {
      setUpdatingBudget(false);
    }
  };

  const handleBudgetEdit = () => {
    setBudgetValue((project?.budget || 0).toString());
    setBudgetModalVisible(true);
  };

  const handleBudgetCancel = () => {
    setBudgetModalVisible(false);
    setBudgetValue('');
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
      {!hasBusinessAccess && (
        <Alert
          message="Business Plan Required"
          description="Project finance features are available only on Business and Enterprise plans. Upgrade your plan to access these features."
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Finance Header */}
      <ConfigProvider wave={{ disabled: true }}>
        <Flex gap={16} align="center" justify="space-between">
          <Flex gap={16} align="center">
            <Flex>
              <Tooltip title={!hasBusinessAccess ? 'Available only on Business plan' : ''}>
                <Button
                  className={`${activeTab === 'finance' && 'border-[#1890ff] text-[#1890ff]'} rounded-r-none`}
                  onClick={() => hasBusinessAccess && dispatch(setActiveTab('finance'))}
                  disabled={!hasBusinessAccess}
                >
                  {t('financeText')}
                </Button>
              </Tooltip>
              <Tooltip title={!hasBusinessAccess ? 'Available only on Business plan' : ''}>
                <Button
                  className={`${activeTab === 'ratecard' && 'border-[#1890ff] text-[#1890ff]'} rounded-l-none`}
                  onClick={() => hasBusinessAccess && dispatch(setActiveTab('ratecard'))}
                  disabled={!hasBusinessAccess}
                >
                  {t('ratecardSingularText')}
                </Button>
              </Tooltip>
            </Flex>

            {activeTab === 'finance' && hasBusinessAccess && (
              <Flex align="center" gap={16} style={{ marginInlineStart: 12 }}>
                <Flex align="center" gap={4}>
                  {t('groupByText')}:
                  <Select
                    value={activeGroup}
                    options={groupDropdownMenuItems}
                    onChange={value =>
                      dispatch(setActiveGroup(value as 'status' | 'priority' | 'phases'))
                    }
                    suffixIcon={<CaretDownFilled />}
                  />
                </Flex>
                <Flex align="center" gap={4}>
                  {t('filterText')}:
                  <Select
                    value={billableFilter}
                    options={billableFilterOptions}
                    onChange={value =>
                      dispatch(setBillableFilter(value as 'all' | 'billable' | 'non-billable'))
                    }
                    suffixIcon={<CaretDownFilled />}
                    style={{ minWidth: 140 }}
                  />
                </Flex>
              </Flex>
            )}
          </Flex>

          {activeTab === 'finance' ? (
            <Tooltip title={!hasBusinessAccess ? 'Available only on Business plan' : ''}>
              <Button
                type="primary"
                icon={<DownOutlined />}
                iconPosition="end"
                loading={exporting}
                onClick={handleExport}
                disabled={!hasBusinessAccess}
              >
                {t('exportButton')}
              </Button>
            </Tooltip>
          ) : (
            <Flex gap={8} align="center">
              <Flex gap={8} align="center">
                <Typography.Text>{t('currencyText')}</Typography.Text>
                <Select
                  value={projectCurrency}
                  loading={currencyLoading}
                  disabled={!hasEditPermission || !hasBusinessAccess}
                  options={CURRENCY_OPTIONS}
                  onChange={handleCurrencyChange}
                />
              </Flex>
              <Tooltip title={!hasBusinessAccess ? 'Available only on Business plan' : ''}>
                <Button
                  type="primary"
                  onClick={() => dispatch(toggleImportRatecardsDrawer())}
                  disabled={!hasBusinessAccess}
                >
                  {t('importButton')}
                </Button>
              </Tooltip>
            </Flex>
          )}
        </Flex>
      </ConfigProvider>

      {/* Tab Content */}
      <div
        style={{
          opacity: hasBusinessAccess ? 1 : 0.6,
          pointerEvents: hasBusinessAccess ? 'auto' : 'none',
        }}
      >
        {activeTab === 'finance' ? (
          <div>
            {!hasEditPermission && hasBusinessAccess && (
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
                <Flex align="center" justify="space-between">
                  <Flex align="center" gap={8}>
                    <CalculatorOutlined />
                    <Typography.Text strong>{t('projectBudgetOverviewText')}</Typography.Text>
                    {!budgetStatistics.hasManualBudget && (
                      <Typography.Text type="warning" style={{ fontSize: '12px' }}>
                        {t('budgetStatistics.noManualBudgetSet')}
                      </Typography.Text>
                    )}
                  </Flex>
                  {hasEditPermission && (
                    <Tooltip title="Budget & Calculation Settings">
                      <Button
                        type="text"
                        icon={<SettingOutlined />}
                        size="small"
                        onClick={() => setBudgetSettingsDrawerVisible(true)}
                        style={{ color: '#666' }}
                      />
                    </Tooltip>
                  )}
                </Flex>
              }
              style={{ marginBottom: 16 }}
              loading={loading}
              size="small"
            >
              <Row gutter={[12, 8]}>
                <Col xs={12} sm={8} md={6} lg={4} xl={3}>
                  <Tooltip title={t('budgetOverviewTooltips.manualBudget')}>
                    <div style={{ textAlign: 'center', position: 'relative' }}>
                      <Statistic
                        title={
                          <Flex align="center" justify="center" gap={4}>
                            <span>{t('budgetStatistics.manualBudget')}</span>
                            {hasEditPermission && (
                              <Button
                                type="text"
                                size="small"
                                icon={<EditOutlined />}
                                onClick={handleBudgetEdit}
                                style={{
                                  padding: '0 4px',
                                  height: '16px',
                                  fontSize: '12px',
                                  color: '#666',
                                }}
                              />
                            )}
                          </Flex>
                        }
                        value={budgetStatistics.totalBudget}
                        precision={2}
                        prefix={projectCurrency.toUpperCase()}
                        valueStyle={{
                          color: budgetStatistics.hasManualBudget ? '#1890ff' : '#d9d9d9',
                          fontSize: '16px',
                        }}
                      />
                    </div>
                  </Tooltip>
                </Col>
                <Col xs={12} sm={8} md={6} lg={4} xl={3}>
                  <Tooltip title={t('budgetOverviewTooltips.totalActualCost')}>
                    <Statistic
                      title={t('budgetStatistics.totalActualCost')}
                      value={budgetStatistics.totalActualCost}
                      precision={2}
                      prefix={projectCurrency.toUpperCase()}
                      valueStyle={{ color: '#52c41a', fontSize: '16px' }}
                      style={{ textAlign: 'center' }}
                    />
                  </Tooltip>
                </Col>
                <Col xs={12} sm={8} md={6} lg={4} xl={3}>
                  <Tooltip title={t('budgetOverviewTooltips.variance')}>
                    <Statistic
                      title={t('budgetStatistics.variance')}
                      value={Math.abs(budgetStatistics.totalVariance)}
                      precision={2}
                      prefix={budgetStatistics.totalVariance >= 0 ? '+' : '-'}
                      suffix={` ${projectCurrency.toUpperCase()}`}
                      valueStyle={{
                        color:
                          budgetStatistics.totalVariance < 0
                            ? '#ff4d4f'
                            : budgetStatistics.totalVariance > 0
                              ? '#52c41a'
                              : '#666666',
                        fontSize: '16px',
                        fontWeight: 'bold',
                      }}
                      style={{ textAlign: 'center' }}
                    />
                  </Tooltip>
                </Col>
                <Col xs={12} sm={8} md={6} lg={4} xl={3}>
                  <Tooltip title={t('budgetOverviewTooltips.utilization')}>
                    <Statistic
                      title={t('budgetStatistics.budgetUtilization')}
                      value={budgetStatistics.budgetUtilization}
                      precision={1}
                      suffix="%"
                      valueStyle={{
                        color:
                          budgetStatistics.budgetUtilization > 100
                            ? '#ff4d4f'
                            : budgetStatistics.budgetUtilization > 80
                              ? '#faad14'
                              : '#52c41a',
                        fontSize: '16px',
                      }}
                      style={{ textAlign: 'center' }}
                    />
                  </Tooltip>
                </Col>
                <Col xs={12} sm={8} md={6} lg={4} xl={3}>
                  <Tooltip title={t('budgetOverviewTooltips.estimatedHours')}>
                    <Statistic
                      title={t('budgetStatistics.estimatedHours')}
                      value={budgetStatistics.totalEstimatedHours}
                      precision={1}
                      suffix="h"
                      valueStyle={{ color: '#722ed1', fontSize: '16px' }}
                      style={{ textAlign: 'center' }}
                    />
                  </Tooltip>
                </Col>
                <Col xs={12} sm={8} md={6} lg={4} xl={3}>
                  <Tooltip title={t('budgetOverviewTooltips.fixedCosts')}>
                    <Statistic
                      title={t('budgetStatistics.fixedCosts')}
                      value={budgetStatistics.totalFixedCost}
                      precision={2}
                      prefix={projectCurrency.toUpperCase()}
                      valueStyle={{ color: '#fa8c16', fontSize: '16px' }}
                      style={{ textAlign: 'center' }}
                    />
                  </Tooltip>
                </Col>
                <Col xs={12} sm={8} md={6} lg={4} xl={3}>
                  <Tooltip title={t('budgetOverviewTooltips.timeBasedCost')}>
                    <Statistic
                      title={t('budgetStatistics.timeBasedCost')}
                      value={budgetStatistics.totalTimeBasedCost}
                      precision={2}
                      prefix={projectCurrency.toUpperCase()}
                      valueStyle={{ color: '#13c2c2', fontSize: '16px' }}
                      style={{ textAlign: 'center' }}
                    />
                  </Tooltip>
                </Col>
                <Col xs={12} sm={8} md={6} lg={4} xl={3}>
                  <Tooltip title={t('budgetOverviewTooltips.remainingBudget')}>
                    <Statistic
                      title={t('budgetStatistics.remainingBudget')}
                      value={Math.abs(budgetStatistics.totalVariance)}
                      precision={2}
                      prefix={budgetStatistics.totalVariance >= 0 ? '+' : '-'}
                      suffix={` ${projectCurrency.toUpperCase()}`}
                      valueStyle={{
                        color: budgetStatistics.totalVariance >= 0 ? '#52c41a' : '#ff4d4f',
                        fontSize: '16px',
                        fontWeight: 'bold',
                      }}
                      style={{ textAlign: 'center' }}
                    />
                  </Tooltip>
                </Col>
              </Row>
            </Card>

            <FinanceTableWrapper activeTablesList={taskGroups} loading={loading} />
          </div>
        ) : (
          <Flex vertical gap={8}>
            {!hasEditPermission && hasBusinessAccess && (
              <Alert
                message="Limited Access"
                description="You can view rate card data but cannot edit rates or manage member assignments. Only project managers, team admins, and team owners can make changes."
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}
            <RateCardTable />
            <Typography.Text type="danger" style={{ display: 'block', marginTop: '10px' }}>
              {t('ratecardImportantNotice')}
            </Typography.Text>
            <ImportRatecardsDrawer />
          </Flex>
        )}
      </div>

      {/* Budget Edit Modal */}
      <Modal
        title={t('budgetModal.title')}
        open={budgetModalVisible}
        onOk={handleBudgetUpdate}
        onCancel={handleBudgetCancel}
        confirmLoading={updatingBudget}
        okText={t('budgetModal.saveButton')}
        cancelText={t('budgetModal.cancelButton')}
      >
        <div style={{ marginBottom: 16 }}>
          <Typography.Text type="secondary">{t('budgetModal.description')}</Typography.Text>
        </div>
        <Input
          type="number"
          min={0}
          step={0.01}
          value={budgetValue}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBudgetValue(e.target.value)}
          placeholder={t('budgetModal.placeholder')}
          prefix={projectCurrency.toUpperCase()}
          size="large"
          autoFocus
        />
      </Modal>

      {/* Budget Settings Drawer */}
      <ProjectBudgetSettingsDrawer
        visible={budgetSettingsDrawerVisible}
        onClose={() => setBudgetSettingsDrawerVisible(false)}
        projectId={projectId!}
      />
    </Flex>
  );
};

export default ProjectViewFinance;
