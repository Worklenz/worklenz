import { Button, Drawer, Form, Input, message, Typography } from '@/shared/antd-imports';
import React from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { nanoid } from '@reduxjs/toolkit';
import { addJobTitle, toggleCreateJobTitleDrawer } from './jobSlice';
import { JobType } from '../../../types/job.types';
import { useTranslation } from 'react-i18next';

const CreateJobTitlesDrawer = () => {
  // localization
  const { t } = useTranslation('settings/job-titles');

  const isDrawerOpen = useAppSelector(state => state.jobReducer.isCreateJobTitleDrawerOpen);
  const dispatch = useAppDispatch();

  const [form] = Form.useForm();

  // this function for handle form submit
  const handleFormSubmit = async (values: any) => {
    try {
      const newJobTitle: JobType = {
        jobId: nanoid(),
        jobTitle: values.name,
      };

      dispatch(addJobTitle(newJobTitle));
      dispatch(toggleCreateJobTitleDrawer());
      form.resetFields();
      message.success(t('createJobTitleSuccessMessage'));
    } catch (error) {
      message.error(t('createJobTitleErrorMessage'));
    }
  };

  return (
    <Drawer
      title={
        <Typography.Text style={{ fontWeight: 500, fontSize: 16 }}>
          {t('createJobTitleDrawerTitle')}
        </Typography.Text>
      }
      open={isDrawerOpen}
      onClose={() => dispatch(toggleCreateJobTitleDrawer())}
    >
      <Form form={form} layout="vertical" onFinish={handleFormSubmit}>
        <Form.Item
          name="name"
          label={t('nameLabel')}
          rules={[
            {
              required: true,
              message: t('nameRequiredError'),
            },
          ]}
        >
          <Input placeholder={t('namePlaceholder')} />
        </Form.Item>

        <Form.Item>
          <Button type="primary" style={{ width: '100%' }} htmlType="submit">
            {t('createButton')}
          </Button>
        </Form.Item>
      </Form>
    </Drawer>
  );
};

export default CreateJobTitlesDrawer;
