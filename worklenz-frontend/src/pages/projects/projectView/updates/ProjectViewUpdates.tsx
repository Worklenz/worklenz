import { Button, ConfigProvider, Flex, Form, Mentions, Space, Tooltip, Typography } from '@/shared/antd-imports';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../../../../hooks/useAppSelector';
import CustomAvatar from '../../../../components/CustomAvatar';
import { colors } from '../../../../styles/colors';
import { relative } from 'path';

const ProjectViewUpdates = () => {
  const [characterLength, setCharacterLength] = useState<number>(0);
  const [isCommentBoxExpand, setIsCommentBoxExpand] = useState<boolean>(false);

  // localization
  const { t } = useTranslation('projectViewUpdatesTab');

  const [form] = Form.useForm();

  // get member list from project members slice
  const projectMembersList = useAppSelector(state => state.projectMemberReducer.membersList);

  // function to handle cancel
  const handleCancel = () => {
    form.resetFields(['comment']);
    setCharacterLength(0);
    setIsCommentBoxExpand(false);
  };

  // mentions options
  const mentionsOptions = projectMembersList
    ? projectMembersList.map(member => ({
        value: member.memberName,
        label: member.memberName,
      }))
    : [];

  return (
    <Flex gap={24} vertical>
      <Flex vertical>
        <Flex gap={8}>
          <CustomAvatar avatarName="Sachintha Prasd" />
          <Flex vertical>
            <Space>
              <Typography.Text style={{ fontSize: 13, color: colors.lightGray }}>
                Sachintha Prasad
              </Typography.Text>
              <Tooltip title="Nov 25,2024,10.45.54 AM">
                <Typography.Text style={{ fontSize: 13, color: colors.deepLightGray }}>
                  7 hours ago
                </Typography.Text>
              </Tooltip>
            </Space>
            <Typography.Paragraph>Hello this is a test message</Typography.Paragraph>
            <ConfigProvider
              wave={{ disabled: true }}
              theme={{
                components: {
                  Button: {
                    defaultColor: colors.lightGray,
                    defaultHoverColor: colors.darkGray,
                  },
                },
              }}
            >
              <Button
                type="text"
                style={{
                  width: 'fit-content',
                  border: 'none',
                  backgroundColor: 'transparent',
                  padding: 0,
                  fontSize: 13,
                  height: 24,
                }}
              >
                {t('deleteButton')}
              </Button>
            </ConfigProvider>
          </Flex>
        </Flex>
      </Flex>

      <Form form={form}>
        <Form.Item name={'comment'}>
          <Mentions
            placeholder={t('inputPlaceholder')}
            options={mentionsOptions}
            autoSize
            maxLength={2000}
            onClick={() => setIsCommentBoxExpand(true)}
            onChange={e => setCharacterLength(e.length)}
            style={{
              minHeight: isCommentBoxExpand ? 180 : 60,
              paddingBlockEnd: 24,
            }}
          />

          <span
            style={{
              position: 'absolute',
              bottom: 4,
              right: 12,
              color: colors.lightGray,
            }}
          >{`${characterLength}/2000`}</span>
        </Form.Item>

        {isCommentBoxExpand && (
          <Form.Item>
            <Flex gap={8} justify="flex-end">
              <Button onClick={handleCancel}>{t('cancelButton')}</Button>
              <Button type="primary" disabled={characterLength === 0}>
                {t('addButton')}
              </Button>
            </Flex>
          </Form.Item>
        )}
      </Form>
    </Flex>
  );
};

export default ProjectViewUpdates;
