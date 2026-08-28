import { Flex, Form, Select } from '@/shared/antd-imports';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
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
  const { t } = useTranslation('task-list-table');
  const dispatch = useAppDispatch();

  // get initial data from task list custom column slice
  const numberType: CustomFieldNumberTypes = useAppSelector(
    state => state.taskListCustomColumnsReducer.customFieldNumberType
  );

  const numberTypesOptions = [
    { key: 'unformatted', value: 'unformatted', label: t('customColumns.fieldTypeForms.numberTypeOptions.unformatted') },
    { key: 'percentage', value: 'percentage', label: t('customColumns.fieldTypeForms.numberTypeOptions.percentage') },
    { key: 'withLabel', value: 'withLabel', label: t('customColumns.fieldTypeForms.numberTypeOptions.withLabel') },
    { key: 'formatted', value: 'formatted', label: t('customColumns.fieldTypeForms.numberTypeOptions.formatted') },
  ];

  return (
    <Flex gap={16} wrap="wrap">
      <Form.Item
        name="numberType"
        label={t('customColumns.fieldTypeForms.numberType')}
        style={{ width: 180, flexShrink: 0 }}
      >
        <Select
          options={numberTypesOptions}
          value={numberType}
          onChange={value => dispatch(setCustomFieldNumberType(value))}
        />
      </Form.Item>

      {numberType === 'formatted' && <FormattedTypeNumberColumn />}
      {numberType === 'unformatted' && <UnformattedTypeNumberColumn />}
      {numberType === 'percentage' && <PercentageTypeNumberColumn />}
      {numberType === 'withLabel' && <WithLabelTypeNumberColumn />}
    </Flex>
  );
};

export default NumberTypeColumn;
