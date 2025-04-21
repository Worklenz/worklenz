import { Form, Typography } from 'antd';
import React from 'react';
import { useAppSelector } from '../../../../../../../../hooks/useAppSelector';

const UnformattedTypeNumberColumn = () => {
  // get initial data from task list custom column slice
  const previewValue: number = useAppSelector(
    state => state.taskListCustomColumnsReducer.previewValue
  );

  return (
    <Form.Item name={'previewValue'} label={<Typography.Text>Preview</Typography.Text>}>
      {previewValue}
    </Form.Item>
  );
};

export default UnformattedTypeNumberColumn;
