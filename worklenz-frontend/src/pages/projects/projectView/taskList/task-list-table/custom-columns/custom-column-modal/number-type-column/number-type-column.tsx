import { Form, Select, Typography } from '@/shared/antd-imports';
import React from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import { themeWiseColor } from '@/utils/themeWiseColor';
import FormattedTypeNumberColumn from './formatted-type-number-column';
import UnformattedTypeNumberColumn from './unformatted-type-number-column';
import PercentageTypeNumberColumn from './percentage-type-number-column';
import WithLabelTypeNumberColumn from './with-label-type-number-column';
import {
  CustomFieldNumberTypes,
  setCustomFieldNumberType,
} from '@/features/projects/singleProject/task-list-custom-columns/task-list-custom-columns-slice';
import { useAppDispatch } from '@/hooks/useAppDispatch';

const NumberTypeColumn = () => {
  //   get theme details from theme reducer
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  const dispatch = useAppDispatch();

  // get initial data from task list custom column slice
  const numberType: CustomFieldNumberTypes = useAppSelector(
    state => state.taskListCustomColumnsReducer.customFieldNumberType
  );

  const numberTypesOptions = [
    { key: 'unformatted', value: 'unformatted', label: 'Unformatted' },
    { key: 'percentage', value: 'percentage', label: 'Percentage' },
    { key: 'withLabel', value: 'withLabel', label: 'With Label' },
    { key: 'formatted', value: 'formatted', label: 'Formatted' },
  ];

  return (
    <div className={numberType === 'withLabel' ? 'grid grid-cols-5 gap-x-4' : 'flex gap-4'}>
      <Form.Item
        name="numberType"
        label={<Typography.Text>Number Type</Typography.Text>}
        className={numberType === 'withLabel' ? 'col-span-2' : ''}
      >
        <Select
          options={numberTypesOptions}
          value={numberType}
          onChange={value => dispatch(setCustomFieldNumberType(value))}
          style={{
            minWidth: '100%',
            width: 150,
            border: `1px solid ${themeWiseColor('#d9d9d9', '#424242', themeMode)}`,
            borderRadius: 4,
          }}
        />
      </Form.Item>

      {numberType === 'formatted' && <FormattedTypeNumberColumn />}
      {numberType === 'unformatted' && <UnformattedTypeNumberColumn />}
      {numberType === 'percentage' && <PercentageTypeNumberColumn />}
      {numberType === 'withLabel' && <WithLabelTypeNumberColumn />}
    </div>
  );
};

export default NumberTypeColumn;
