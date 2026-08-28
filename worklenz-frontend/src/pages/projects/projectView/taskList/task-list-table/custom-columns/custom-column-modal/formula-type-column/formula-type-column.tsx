import { Flex, Form, Select } from '@/shared/antd-imports';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  setExpression,
  setFirstNumericColumn,
  setSecondNumericColumn,
} from '@/features/projects/singleProject/task-list-custom-columns/task-list-custom-columns-slice';

const FormulaTypeColumn = () => {
  const { t } = useTranslation('task-list-table');
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
    { key: 'add', value: 'add', label: t('customColumns.fieldTypeForms.expressionOptions.add') },
    {
      key: 'substract',
      value: 'substract',
      label: t('customColumns.fieldTypeForms.expressionOptions.subtract'),
    },
    {
      key: 'divide',
      value: 'divide',
      label: t('customColumns.fieldTypeForms.expressionOptions.divide'),
    },
    {
      key: 'multiply',
      value: 'multiply',
      label: t('customColumns.fieldTypeForms.expressionOptions.multiply'),
    },
  ];

  return (
    <Flex gap={16}>
      <Form.Item
        name={'firstNumericColumn'}
        label={t('customColumns.fieldTypeForms.firstColumn')}
        style={{ flex: 1, minWidth: 0 }}
      >
        <Select
          options={numericColumns.map(col => ({
            key: col.key,
            value: col.key,
            label: col.name,
          }))}
          onChange={value => dispatch(setFirstNumericColumn(value))}
          placeholder={t('customColumns.fieldTypeForms.selectFirstColumn')}
        />
      </Form.Item>

      <Form.Item
        name={'expression'}
        label={t('customColumns.fieldTypeForms.expression')}
        style={{ flex: 1, minWidth: 0 }}
      >
        <Select
          options={expressionTypesOptions}
          value={expression}
          onChange={value => dispatch(setExpression(value))}
        />
      </Form.Item>

      <Form.Item
        name={'secondNumericColumn'}
        label={t('customColumns.fieldTypeForms.secondColumn')}
        style={{ flex: 1, minWidth: 0 }}
      >
        <Select
          options={numericColumns.map(col => ({
            key: col.key,
            value: col.key,
            label: col.name,
          }))}
          onChange={value => dispatch(setSecondNumericColumn(value))}
          placeholder={t('customColumns.fieldTypeForms.selectSecondColumn')}
        />
      </Form.Item>
    </Flex>
  );
};

export default FormulaTypeColumn;
