import { Form, Select, Typography } from '@/shared/antd-imports';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { setDecimals } from '@/features/projects/singleProject/task-list-custom-columns/task-list-custom-columns-slice';

const PercentageTypeNumberColumn = () => {
  const { t } = useTranslation('task-list-table');
  const dispatch = useAppDispatch();

  // get initial data from task list custom column slice
  const decimals: number = useAppSelector(state => state.taskListCustomColumnsReducer.decimals);
  const previewValue: number = useAppSelector(
    state => state.taskListCustomColumnsReducer.previewValue
  );

  return (
    <>
      <Form.Item
        name={'decimals'}
        label={t('customColumns.fieldTypeForms.decimals')}
        style={{ width: 120, flexShrink: 0 }}
      >
        <Select
          options={[1, 2, 3, 4].map(item => ({
            key: item,
            value: item,
            label: item,
          }))}
          defaultValue={decimals}
          onChange={value => dispatch(setDecimals(value))}
        />
      </Form.Item>

      <Form.Item name={'previewValue'} label={t('customColumns.fieldTypeForms.preview')}>
        <Typography.Text>{previewValue.toFixed(decimals)}%</Typography.Text>
      </Form.Item>
    </>
  );
};

export default PercentageTypeNumberColumn;
