import { Button, Drawer, Flex, Form, Input, message, Typography } from 'antd';
import { useAppSelector } from '../../../hooks/useAppSelector';
import { useAppDispatch } from '../../../hooks/useAppDispatch';
import { nanoid } from '@reduxjs/toolkit';
import { useTranslation } from 'react-i18next';
import { addClient, toggleAddClientDrawer } from './clients-slice';
import { CopyOutlined } from '@ant-design/icons';
import { TempClientPortalClientType } from '../../../types/client-portal/temp-client-portal.types';

const AddClientDrawer = () => {
  // localization
  const { t } = useTranslation('client-portal-clients');

  // get drawer state from client reducer
  const isDrawerOpen = useAppSelector(
    (state) => state.clientsPortalReducer.clientsReducer.isAddClientDrawerOpen
  );
  const dispatch = useAppDispatch();

  const [form] = Form.useForm();

  // this function for handle form submit
  const handleFormSubmit = async (values: any) => {
    try {
      const newClient: TempClientPortalClientType = {
        id: nanoid(),
        name: values.name,
        assigned_projects_count: 0,
        projects: [],
        team_members: [],
      };

      dispatch(addClient(newClient));
      dispatch(toggleAddClientDrawer());
      form.resetFields();
      message.success(t('createClientSuccessMessage'));
    } catch (error) {
      message.error(t('createClientErrorMessage'));
    }
  };

  // function to copy link to clipboard
  const copyLinkToClipboard = () => {
    const link = 'https://app.worklenz.com/worklenz/projects/10889d';
    navigator.clipboard.writeText(link);
    message.success(t('linkCopiedMessage'));
  };

  return (
    <Drawer
      title={
        <Typography.Text style={{ fontWeight: 500, fontSize: 16 }}>
          {t('addClientDrawerTitle')}
        </Typography.Text>
      }
      open={isDrawerOpen}
      onClose={() => dispatch(toggleAddClientDrawer())}
    >
      <Form form={form} layout="vertical" onFinish={handleFormSubmit}>
        <Form.Item
          name="email"
          label={t('emailLabel')}
          rules={[
            {
              required: true,
              message: t('emailRequiredError'),
            },
          ]}
        >
          <Input placeholder={t('emailPlaceholder')} />
        </Form.Item>

        <Form.Item name="link" label={t('copyLinkLabel')}>
          <Flex gap={4}>
            <Input
              disabled
              style={{ width: '100%' }}
              value={'https://app.worklenz.com/worklenz/projects/10889d'}
            />
            <Button
              type="default"
              icon={<CopyOutlined />}
              onClick={copyLinkToClipboard}
            />
          </Flex>
        </Form.Item>
      </Form>
    </Drawer>
  );
};

export default AddClientDrawer;
