import React, { useRef, useState } from 'react';
import { Button, Drawer, Form, Input, InputRef, Typography } from '@/shared/antd-imports';
import { fetchTeams } from '@features/teams/teamSlice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useTranslation } from 'react-i18next';
import logger from '@/utils/errorLogger';
import { teamsApiService } from '@/api/teams/teams.api.service';

interface AddTeamDrawerProps {
  isDrawerOpen: boolean;
  onClose: () => void;
  reloadTeams: () => void;
}

const AddTeamDrawer: React.FC<AddTeamDrawerProps> = ({ isDrawerOpen, onClose, reloadTeams }) => {
  const { t } = useTranslation('admin-center/teams');
  const dispatch = useAppDispatch();
  const [form] = Form.useForm();
  const [creating, setCreating] = useState(false);
  const addTeamNameInputRef = useRef<InputRef>(null);

  const handleFormSubmit = async (values: any) => {
    if (!values.name || values.name.trim() === '') return;

    try {
      setCreating(true);
      const newTeam = {
        name: values.name,
      };
      const res = await teamsApiService.createTeam(newTeam);
      if (res.done) {
        onClose();
        reloadTeams();
        dispatch(fetchTeams());
      }
    } catch (error) {
      logger.error('Error adding team', error);
    } finally {
      setCreating(false);
    }

    form.resetFields();
  };

  return (
    <Drawer
      title={
        <Typography.Text style={{ fontWeight: 500, fontSize: 16 }}>
          {t('drawerTitle')}
        </Typography.Text>
      }
      open={isDrawerOpen}
      destroyOnClose
      afterOpenChange={() => {
        setTimeout(() => {
          addTeamNameInputRef.current?.focus();
        }, 100);
      }}
      onClose={onClose}
    >
      <Form form={form} layout="vertical" onFinish={handleFormSubmit}>
        <Form.Item
          name="name"
          label={t('label')}
          rules={[
            {
              required: true,
              message: t('message'),
            },
          ]}
        >
          <Input placeholder={t('drawerPlaceholder')} ref={addTeamNameInputRef} />
        </Form.Item>

        <Form.Item>
          <Button type="primary" style={{ width: '100%' }} htmlType="submit" loading={creating}>
            {t('create')}
          </Button>
        </Form.Item>
      </Form>
    </Drawer>
  );
};

export default AddTeamDrawer;
