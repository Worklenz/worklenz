import { Flex, Form, Input, Typography } from '@/shared/antd-imports';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

const KeyTypeColumn = () => {
  const { t } = useTranslation('task-list-table');
  const [keyLabel, setKeyLabel] = useState<string>('MK');

  return (
    <Flex gap={16}>
      <Form.Item name="customKeyLabel" label={t('customColumns.fieldTypeForms.label')}>
        <Input
          value={keyLabel}
          placeholder={t('customColumns.fieldTypeForms.keyLabelPlaceholder')}
          maxLength={5}
          style={{ textTransform: 'uppercase' }}
          onChange={e => setKeyLabel(e.currentTarget.value)}
        />
      </Form.Item>

      <Form.Item name="customKeyPreviewValue" label={t('customColumns.fieldTypeForms.preview')}>
        <Typography.Text style={{ textTransform: 'uppercase' }}>
          {keyLabel.length === 0 ? 'MK' : keyLabel}-1
        </Typography.Text>
      </Form.Item>
    </Flex>
  );
};

export default KeyTypeColumn;
