import { Flex, Form, Select, Typography } from '@/shared/antd-imports';
import React from 'react';
import { themeWiseColor } from '../../../../../../../../utils/themeWiseColor';
import { useAppSelector } from '../../../../../../../../hooks/useAppSelector';
import { useAppDispatch } from '../../../../../../../../hooks/useAppDispatch';
import {
  setExpression,
  setFirstNumericColumn,
  setSecondNumericColumn,
} from '../../../../../../../../features/projects/singleProject/task-list-custom-columns/task-list-custom-columns-slice';

const FormulaTypeColumn = () => {
  // get theme details from the theme reducer
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  const dispatch = useAppDispatch();

  // get initial data from task list custom column slice
  const expression = useAppSelector(state => state.taskListCustomColumnsReducer.expression);

  // get columns from column slice and filter only numeric columns
  const columnsOptions = useAppSelector(
    state => state.projectViewTaskListColumnsReducer.columnList
  );

  // filter numeric columns only
  const numericColumns = columnsOptions.filter(
    column => column.customColumnObj?.fieldType === 'number'
  );

  // expression types options
  const expressionTypesOptions = [
    { key: 'add', value: 'add', label: '+ Add' },
    { key: 'substract', value: 'substract', label: '- Substract' },
    { key: 'divide', value: 'divide', label: '/ Divide' },
    { key: 'multiply', value: 'multiply', label: 'x Multiply' },
  ];

  return (
    <Flex gap={8} align="center" justify="space-between">
      <Form.Item
        name={'firstNumericColumn'}
        label={<Typography.Text>First Column</Typography.Text>}
      >
        {/* first numeric column */}
        <Select
          options={numericColumns.map(col => ({
            key: col.key,
            value: col.key,
            label: col.name,
          }))}
          onChange={value => dispatch(setFirstNumericColumn(value))}
          placeholder="Select first column"
          style={{
            minWidth: '100%',
            width: 150,
            border: `1px solid ${themeWiseColor('#d9d9d9', '#424242', themeMode)}`,
            borderRadius: 4,
          }}
        />
      </Form.Item>

      <Form.Item name={'expression'} label={<Typography.Text>Expression</Typography.Text>}>
        {/* expression type */}
        <Select
          options={expressionTypesOptions}
          value={expression}
          onChange={value => dispatch(setExpression(value))}
          style={{
            minWidth: '100%',
            width: 150,
            border: `1px solid ${themeWiseColor('#d9d9d9', '#424242', themeMode)}`,
            borderRadius: 4,
          }}
        />
      </Form.Item>

      <Form.Item
        name={'secondNumericColumn'}
        label={<Typography.Text>Second Column</Typography.Text>}
      >
        {/* second numeric column */}
        <Select
          options={numericColumns.map(col => ({
            key: col.key,
            value: col.key,
            label: col.name,
          }))}
          onChange={value => dispatch(setSecondNumericColumn(value))}
          placeholder="Select second column"
          style={{
            minWidth: '100%',
            width: 150,
            border: `1px solid ${themeWiseColor('#d9d9d9', '#424242', themeMode)}`,
            borderRadius: 4,
          }}
        />
      </Form.Item>
    </Flex>
  );
};

export default FormulaTypeColumn;
