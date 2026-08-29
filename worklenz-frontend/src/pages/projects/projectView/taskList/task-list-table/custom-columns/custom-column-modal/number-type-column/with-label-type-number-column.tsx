import { Form, Input, Select, Typography } from '@/shared/antd-imports';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  setDecimals,
  setLabel,
  setLabelPosition,
} from '@/features/projects/singleProject/task-list-custom-columns/task-list-custom-columns-slice';

const WithLabelTypeNumberColumn = () => {
  const { t } = useTranslation('task-list-table');
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
      <Form.Item name={'label'} label={t('customColumns.fieldTypeForms.label')} style={{ width: 140, flexShrink: 0 }}>
        <Input value={label} onChange={e => dispatch(setLabel(e.currentTarget.value))} />
      </Form.Item>

      <Form.Item
        name={'labelPosition'}
        label={t('customColumns.fieldTypeForms.position')}
        style={{ width: 120, flexShrink: 0 }}
      >
        <Select
          options={[
            { key: 'left', value: 'left', label: t('customColumns.fieldTypeForms.left') },
            { key: 'right', value: 'right', label: t('customColumns.fieldTypeForms.right') },
          ]}
          defaultValue={labelPosition}
          value={labelPosition}
          onChange={value => dispatch(setLabelPosition(value))}
        />
      </Form.Item>

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
          value={decimals}
          onChange={value => dispatch(setDecimals(value))}
        />
      </Form.Item>

      <Form.Item name={'previewValue'} label={t('customColumns.fieldTypeForms.preview')}>
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
