import { Button, Drawer, Form, Input, message, Typography } from '@/shared/antd-imports';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { jobTitlesApiService } from '@/api/settings/job-titles/job-titles.api.service';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_settings_job_titles_create } from '@/shared/worklenz-analytics-events';

type JobTitleDrawerProps = {
  drawerOpen: boolean;
  jobTitleId: string | null;
  drawerClosed: () => void;
};

const JobTitleDrawer = ({
  drawerOpen = false,
  jobTitleId = null,
  drawerClosed,
}: JobTitleDrawerProps) => {
  const { t } = useTranslation('settings/job-titles');
  const [form] = Form.useForm();
  const { trackMixpanelEvent } = useMixpanelTracking();

  useEffect(() => {
    if (jobTitleId) {
      getJobTitleById(jobTitleId);
    } else {
      form.resetFields();
    }
  }, [jobTitleId, form]);

  const getJobTitleById = async (id: string) => {
    try {
      const response = await jobTitlesApiService.getJobTitleById(id);
      if (response.done) {
        form.setFieldsValue({ name: response.body.name });
      }
    } catch (error) {
      message.error(t('fetchJobTitleErrorMessage'));
    }
  };

  const handleFormSubmit = async (values: { name: string }) => {
    try {
      if (jobTitleId) {
        const response = await jobTitlesApiService.updateJobTitle(jobTitleId, {
          name: values.name,
        });
        if (response.done) {
          drawerClosed();
        }
      } else {
        trackMixpanelEvent(evt_settings_job_titles_create);
        const response = await jobTitlesApiService.createJobTitle({ name: values.name });
        if (response.done) {
          drawerClosed();
        }
      }
    } catch (error) {
      message.error(jobTitleId ? t('updateJobTitleErrorMessage') : t('createJobTitleErrorMessage'));
    }
  };

  const handleClose = () => {
    form.resetFields();
    drawerClosed();
  };

  return (
    <Drawer
      title={
        <Typography.Text style={{ fontWeight: 500, fontSize: 16 }}>
          {jobTitleId ? t('updateJobTitleDrawerTitle') : t('createJobTitleDrawerTitle')}
        </Typography.Text>
      }
      open={drawerOpen}
      onClose={handleClose}
      destroyOnClose
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
            {jobTitleId ? t('updateButton') : t('createButton')}
          </Button>
        </Form.Item>
      </Form>
    </Drawer>
  );
};

export default JobTitleDrawer;
