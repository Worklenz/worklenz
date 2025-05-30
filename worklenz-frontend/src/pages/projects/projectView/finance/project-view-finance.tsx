import { Button, ConfigProvider, Flex, Select, Typography, message } from 'antd';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CaretDownFilled, DownOutlined } from '@ant-design/icons';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { fetchProjectFinances, setActiveTab, setActiveGroup } from '@/features/projects/finance/project-finance.slice';
import { changeCurrency, toggleImportRatecardsDrawer } from '@/features/finance/finance-slice';
import { projectFinanceApiService } from '@/api/project-finance-ratecard/project-finance.api.service';
import { RootState } from '@/app/store';
import FinanceTableWrapper from './finance-tab/finance-table/finance-table-wrapper';
import RatecardTable from './ratecard-tab/reatecard-table/ratecard-table';
import ImportRatecardsDrawer from '@/features/finance/ratecard-drawer/import-ratecards-drawer';

const ProjectViewFinance = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const dispatch = useAppDispatch();
  const { t } = useTranslation('project-view-finance');
  const [exporting, setExporting] = useState(false);
  
  const { activeTab, activeGroup, loading, taskGroups } = useAppSelector((state: RootState) => state.projectFinances);
  const { refreshTimestamp, project } = useAppSelector((state: RootState) => state.projectReducer);
  const phaseList = useAppSelector((state) => state.phaseReducer.phaseList);

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
                  defaultValue={'lkr'}
                  options={[
                    { value: 'lkr', label: 'LKR' },
                    { value: 'usd', label: 'USD' },
                    { value: 'inr', label: 'INR' },
                  ]}
                  onChange={(value) => dispatch(changeCurrency(value))}
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
          <FinanceTableWrapper activeTablesList={taskGroups} loading={loading} />
        </div>
      ) : (
        <Flex vertical gap={8}>
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
