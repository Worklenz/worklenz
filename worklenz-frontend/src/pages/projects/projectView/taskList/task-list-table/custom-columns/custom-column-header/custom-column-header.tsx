import { SettingOutlined } from '@/shared/antd-imports';
import { Button, Flex, Tooltip, Typography } from '@/shared/antd-imports';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import CustomColumnModal from '../custom-column-modal/custom-column-modal';

type CustomColumnHeaderProps = {
  columnKey: string;
  columnName: string;
};

const CustomColumnHeader = ({ columnKey, columnName }: CustomColumnHeaderProps) => {
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  // localization
  const { t } = useTranslation('task-list-table');

  //   function to open modal
  const handleModalOpen = () => {
    setIsModalOpen(true);
  };

  //   fuction to handle cancel
  const handleCancel = () => {
    setIsModalOpen(false);
  };

  return (
    <Flex gap={8} align="center" justify="space-between">
      <Typography.Text ellipsis={{ expanded: false }}>{columnName}</Typography.Text>

      <Tooltip title={t('editTooltip')}>
        <Button
          icon={<SettingOutlined />}
          style={{
            background: 'transparent',
            border: 'none',
            boxShadow: 'none',
            fontSize: 12,
          }}
          onClick={handleModalOpen}
        />
      </Tooltip>

      {/* <CustomColumnModal
        modalType="edit"
        isModalOpen={isModalOpen}
        handleCancel={handleCancel}
        columnId={columnKey}
      /> */}
    </Flex>
  );
};

export default CustomColumnHeader;
