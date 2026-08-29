import { Form } from '@/shared/antd-imports';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';

const UnformattedTypeNumberColumn = () => {
  const { t } = useTranslation('task-list-table');

  // get initial data from task list custom column slice
  const previewValue: number = useAppSelector(
    state => state.taskListCustomColumnsReducer.previewValue
  );

  return (
    <Form.Item name={'previewValue'} label={t('customColumns.fieldTypeForms.preview')}>
      {previewValue}
    </Form.Item>
  );
};

export default UnformattedTypeNumberColumn;
