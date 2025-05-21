import React from 'react';
import RatecardTable from './reatecard-table/ratecard-table';
import { Button, Flex, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import ImportRatecardsDrawer from '@/features/finance/ratecard-drawer/import-ratecards-drawer';

const RatecardTab = () => {
  // localization
  const { t } = useTranslation('project-view-finance');

  return (
    <Flex vertical gap={8}>
      <RatecardTable />

      <Typography.Text
        type="danger"
        style={{ display: 'block', marginTop: '10px' }}
      >
        {t('ratecardImportantNotice')}
      </Typography.Text>
      {/* <Button
        type="primary"
        style={{
          marginTop: '10px',
          width: 'fit-content',
          alignSelf: 'flex-end',
        }}
      >
        {t('saveButton')}
      </Button> */}

      {/* import ratecards drawer  */}
      <ImportRatecardsDrawer />
    </Flex>
  );
};

export default RatecardTab;
