import { Form, Select, Typography } from '@/shared/antd-imports';
import React from 'react';
import { useAppSelector } from '../../../../../../../../hooks/useAppSelector';
import { themeWiseColor } from '../../../../../../../../utils/themeWiseColor';
import { useAppDispatch } from '../../../../../../../../hooks/useAppDispatch';
import { setDecimals } from '../../../../../../../../features/projects/singleProject/task-list-custom-columns/task-list-custom-columns-slice';

const FormattedTypeNumberColumn = () => {
  // Get theme details from the theme reducer
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  const dispatch = useAppDispatch();

  // get initial data from task list custom column slice
  const decimals: number = useAppSelector(state => state.taskListCustomColumnsReducer.decimals);
  const previewValue: number = useAppSelector(
    state => state.taskListCustomColumnsReducer.previewValue
  );

  return (
    <>
      <Form.Item name="decimals" label={<Typography.Text>Decimals</Typography.Text>}>
        <Select
          options={[1, 2, 3, 4].map(item => ({
            key: item,
            value: item,
            label: item,
          }))}
          defaultValue={decimals}
          onChange={value => dispatch(setDecimals(value))}
          style={{
            border: `1px solid ${themeWiseColor('#d9d9d9', '#424242', themeMode)}`,
            borderRadius: 4,
          }}
        />
      </Form.Item>

      <Form.Item name="previewValue" label={<Typography.Text>Preview</Typography.Text>}>
        <Typography.Text>{previewValue.toFixed(decimals)}</Typography.Text>
      </Form.Item>
    </>
  );
};

export default FormattedTypeNumberColumn;
