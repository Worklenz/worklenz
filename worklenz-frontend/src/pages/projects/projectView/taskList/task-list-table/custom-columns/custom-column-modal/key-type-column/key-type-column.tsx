import { Flex, Form, Input, Typography } from '@/shared/antd-imports';
import React, { useState } from 'react';

const KeyTypeColumn = () => {
  const [keyLabel, setKeyLabel] = useState<string>('MK');

  return (
    <Flex gap={16}>
      <Form.Item name="customKeyLabel" label="Label">
        <Input
          value={keyLabel}
          placeholder="ex-:MK"
          maxLength={5}
          style={{ textTransform: 'uppercase' }}
          onChange={e => setKeyLabel(e.currentTarget.value)}
        />
      </Form.Item>

      <Form.Item name="customKeyPreviewValue" label="Preview">
        <Typography.Text style={{ textTransform: 'uppercase' }}>
          {keyLabel.length === 0 ? 'MK' : keyLabel}-1
        </Typography.Text>
      </Form.Item>
    </Flex>
  );
};

export default KeyTypeColumn;
