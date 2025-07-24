import { Button, Drawer, Form, Input, message, Typography } from '@/shared/antd-imports';
import React, { useEffect } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { toggleUpdateJobTitleDrawer, updateJobTitle } from './jobSlice';
import { JobType } from '../../../types/job.types';
import { useTranslation } from 'react-i18next';

type UpdateJobTitleDrawerProps = {
  selectedJobTitleId: string | null;
};

const UpdateJobTitleDrawer = ({ selectedJobTitleId }: UpdateJobTitleDrawerProps) => {
  // localization
  const { t } = useTranslation('settings/job-titles');

  // get data from client reducer
  const jobTitlesList = useAppSelector(state => state.jobReducer.jobsList);

  // get data of currentlt selectedClient
  const selectedJobTitle = jobTitlesList.find(job => job.jobId === selectedJobTitleId);

  const isDrawerOpen = useAppSelector(state => state.jobReducer.isUpdateJobTitleDrawerOpen);
  const dispatch = useAppDispatch();

  const [form] = Form.useForm();

  // Load the selected client details to the form when drawer opens
  useEffect(() => {
    if (selectedJobTitle) {
      form.setFieldsValue({
        name: selectedJobTitle.jobTitle,
      });
    }
  }, [selectedJobTitle, form]);

  // this function for handle form submit
  const handleFormSubmit = async (values: any) => {
    try {
      if (selectedJobTitle) {
        const updatedJobTitle: JobType = {
          ...selectedJobTitle,
          jobTitle: values.name,
        };

        dispatch(updateJobTitle(updatedJobTitle));
        dispatch(toggleUpdateJobTitleDrawer());
        message.success(t('updateJobTitleSuccessMessage'));
      }
    } catch (error) {
      message.error(t('updateJobTitleErrorMessage'));
    }
  };

  return (
    <Drawer
      title={
        <Typography.Text style={{ fontWeight: 500, fontSize: 16 }}>
          {t('updateJobTitleDrawerTitle')}
        </Typography.Text>
      }
      open={isDrawerOpen}
      onClose={() => dispatch(toggleUpdateJobTitleDrawer())}
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
            {t('updateButton')}
          </Button>
        </Form.Item>
      </Form>
    </Drawer>
  );
};

export default UpdateJobTitleDrawer;
