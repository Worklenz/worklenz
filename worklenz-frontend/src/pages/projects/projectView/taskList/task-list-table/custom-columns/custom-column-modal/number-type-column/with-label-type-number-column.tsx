import { Form, Input, Select, Typography } from '@/shared/antd-imports';
import React from 'react';
import { useAppSelector } from '../../../../../../../../hooks/useAppSelector';
import { themeWiseColor } from '../../../../../../../../utils/themeWiseColor';
import { useAppDispatch } from '../../../../../../../../hooks/useAppDispatch';
import {
  setDecimals,
  setLabel,
  setLabelPosition,
} from '../../../../../../../../features/projects/singleProject/task-list-custom-columns/task-list-custom-columns-slice';

const WithLabelTypeNumberColumn = () => {
  //   get theme details from theme reducer
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  const dispatch = useAppDispatch();

  // get initial data from task list custom column slice
  const decimals: number = useAppSelector(state => state.taskListCustomColumnsReducer.decimals);
  const label: string = useAppSelector(state => state.taskListCustomColumnsReducer.label);
  const labelPosition: 'left' | 'right' = useAppSelector(
    state => state.taskListCustomColumnsReducer.labelPosition
  );
  const previewValue: number = useAppSelector(
    state => state.taskListCustomColumnsReducer.previewValue
  );

  return (
    <>
      <Form.Item name={'label'} label={<Typography.Text>Label</Typography.Text>}>
        <Input value={label} onChange={e => dispatch(setLabel(e.currentTarget.value))} />
      </Form.Item>

      <Form.Item name={'labelPosition'} label={<Typography.Text>Position</Typography.Text>}>
        <Select
          options={[
            {
              key: 'left',
              value: 'left',
              label: 'Left',
            },
            { key: 'right', value: 'right', label: 'Right' },
          ]}
          defaultValue={labelPosition}
          value={labelPosition}
          onChange={value => dispatch(setLabelPosition(value))}
          style={{
            border: `1px solid ${themeWiseColor('#d9d9d9', '#424242', themeMode)}`,
            borderRadius: 4,
          }}
        />
      </Form.Item>

      <Form.Item name={'decimals'} label={<Typography.Text>Decimals</Typography.Text>}>
        <Select
          options={[1, 2, 3, 4].map(item => ({
            key: item,
            value: item,
            label: item,
          }))}
          value={decimals}
          onChange={value => dispatch(setDecimals(value))}
          style={{
            border: `1px solid ${themeWiseColor('#d9d9d9', '#424242', themeMode)}`,
            borderRadius: 4,
          }}
        />
      </Form.Item>

      <Form.Item
        name={'previewValue'}
        label={<Typography.Text>Preview</Typography.Text>}
        className="col-span-5"
      >
        <Typography.Text>
          {labelPosition === 'left'
            ? `${label} ${previewValue.toFixed(decimals)}`
            : `${previewValue.toFixed(decimals)} ${label} `}
        </Typography.Text>
      </Form.Item>
    </>
  );
};

export default WithLabelTypeNumberColumn;
