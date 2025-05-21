import { Button, ConfigProvider, Flex, Select, Typography } from 'antd';
import React from 'react';
import GroupByFilterDropdown from './group-by-filter-dropdown';
import { DownOutlined } from '@ant-design/icons';
import { useAppDispatch } from '../../../../../hooks/useAppDispatch';

import { useTranslation } from 'react-i18next';
import { changeCurrency, toggleImportRatecardsDrawer } from '@/features/finance/finance-slice';

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

  const dispatch = useAppDispatch();

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
          <Button type="primary" icon={<DownOutlined />} iconPosition="end">
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
