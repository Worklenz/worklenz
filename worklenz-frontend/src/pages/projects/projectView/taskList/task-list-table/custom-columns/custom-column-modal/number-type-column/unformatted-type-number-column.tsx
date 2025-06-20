import { Form, Typography } from '@/components/ui';
import React from 'react';
import { useAppSelector } from '../../../../../../../../@/hooks/use-app-selector';

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
