import { Button, ConfigProvider, Flex, Select, Typography, message, Alert } from 'antd';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CaretDownFilled, DownOutlined } from '@ant-design/icons';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { fetchProjectFinances, setActiveTab, setActiveGroup } from '@/features/projects/finance/project-finance.slice';
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

const ProjectViewFinance = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const dispatch = useAppDispatch();
  const { t } = useTranslation('project-view-finance');
  const [exporting, setExporting] = useState(false);
  const [updatingCurrency, setUpdatingCurrency] = useState(false);
  
  const { activeTab, activeGroup, loading, taskGroups, project: financeProject } = useAppSelector((state: RootState) => state.projectFinances);
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

  useEffect(() => {
    if (projectId) {
      dispatch(fetchProjectFinances({ projectId, groupBy: activeGroup }));
    }
  }, [projectId, activeGroup, dispatch, refreshTimestamp]);

  const handleExport = async () => {
    if (!projectId) {
      message.error('Project ID not found');
      return;
    }

    try {
      setExporting(true);
      const blob = await projectFinanceApiService.exportFinanceData(projectId, activeGroup);
      
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
              <Flex align="center" gap={4} style={{ marginInlineStart: 12 }}>
                {t('groupByText')}:
                <Select
                  value={activeGroup}
                  options={groupDropdownMenuItems}
                  onChange={(value) => dispatch(setActiveGroup(value as 'status' | 'priority' | 'phases'))}
                  suffixIcon={<CaretDownFilled />}
                />
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
