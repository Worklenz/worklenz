import { Button, ConfigProvider, Flex, Select, Typography, message } from 'antd';
import GroupByFilterDropdown from './group-by-filter-dropdown';
import { DownOutlined } from '@ant-design/icons';
import { useAppDispatch } from '../../../../../hooks/useAppDispatch';
import { useAppSelector } from '../../../../../hooks/useAppSelector';

import { useTranslation } from 'react-i18next';
import { changeCurrency, toggleImportRatecardsDrawer } from '@/features/finance/finance-slice';
import { projectFinanceApiService } from '@/api/project-finance-ratecard/project-finance.api.service';
import { useParams } from 'react-router-dom';
import { useState } from 'react';

type ProjectViewFinanceHeaderProps = {
  activeTab: 'finance' | 'ratecard';
  setActiveTab: (tab: 'finance' | 'ratecard') => void;
  activeGroup: 'status' | 'priority' | 'phases';
  setActiveGroup: (group: 'status' | 'priority' | 'phases') => void;
};

const ProjectViewFinanceHeader = ({
  activeTab,
  setActiveTab,
  activeGroup,
  setActiveGroup,
}: ProjectViewFinanceHeaderProps) => {
  // localization
  const { t } = useTranslation('project-view-finance');
  const { projectId } = useParams<{ projectId: string }>();
  const [exporting, setExporting] = useState(false);

  const dispatch = useAppDispatch();
  const { project } = useAppSelector(state => state.projectReducer);

  const handleExport = async () => {
    if (!projectId) {
      message.error('Project ID not found');
      return;
    }

    try {
      setExporting(true);
      const blob = await projectFinanceApiService.exportFinanceData(projectId, activeGroup);
      
      // Get project name from Redux state
      const projectName = project?.name || 'Unknown_Project';
      
      // Create filename with project name, date and time
      const sanitizedProjectName = projectName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
      const dateTime = new Date().toISOString().replace(/[:.]/g, '-').split('T');
      const date = dateTime[0];
      const time = dateTime[1].split('.')[0];
      const filename = `${sanitizedProjectName}_Finance_Data_${date}_${time}.xlsx`;
      
      // Create download link
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

  return (
    <ConfigProvider wave={{ disabled: true }}>
      <Flex gap={16} align="center" justify="space-between">
        <Flex gap={16} align="center">
          <Flex>
            <Button
              className={`${activeTab === 'finance' && 'border-[#1890ff] text-[#1890ff]'} rounded-r-none`}
              onClick={() => setActiveTab('finance')}
            >
              {t('financeText')}
            </Button>
            <Button
              className={`${activeTab === 'ratecard' && 'border-[#1890ff] text-[#1890ff]'} rounded-l-none`}
              onClick={() => setActiveTab('ratecard')}
            >
              {t('ratecardSingularText')}
            </Button>
          </Flex>

          {activeTab === 'finance' && (
            <GroupByFilterDropdown
              activeGroup={activeGroup}
              setActiveGroup={setActiveGroup}
            />
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
  );
};

export default ProjectViewFinanceHeader;
