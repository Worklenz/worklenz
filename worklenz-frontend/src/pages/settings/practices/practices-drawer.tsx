import { Button, Drawer, Form, Input, message, Typography } from '@/shared/antd-imports';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { practicesApiService } from '@/api/settings/practices/practices.api.service';

type PracticeDrawerProps = {
  drawerOpen: boolean;
  practiceId: string | null;
  drawerClosed: () => void;
};

const PracticeDrawer = ({
  drawerOpen = false,
  practiceId = null,
  drawerClosed,
}: PracticeDrawerProps) => {
  const { t } = useTranslation('settings/practices');
  const [form] = Form.useForm();

  useEffect(() => {
    if (!drawerOpen) return;

    if (practiceId) {
      getPracticeById(practiceId);
      return;
    }

    form.resetFields();
  }, [practiceId, drawerOpen, form]);

  const getPracticeById = async (id: string) => {
    try {
      const response = await practicesApiService.getPracticeById(id);
      if (response.done) {
        form.setFieldsValue({ name: response.body.name });
      }
    } catch {
      message.error(
        t('fetchPracticeErrorMessage', { defaultValue: 'Failed to fetch practice' })
      );
    }
  };

  const handleFormSubmit = async (values: { name: string }) => {
    try {
      if (practiceId) {
        const response = await practicesApiService.updatePractice(practiceId, {
          name: values.name,
        });
        if (response.done) {
          drawerClosed();
        }
      } else {
        const response = await practicesApiService.createPractice({ name: values.name });
        if (response.done) {
          drawerClosed();
        }
      }
    } catch {
      message.error(
        practiceId
          ? t('updatePracticeErrorMessage', { defaultValue: 'Failed to update practice' })
          : t('createPracticeErrorMessage', { defaultValue: 'Failed to create practice' })
      );
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
          {practiceId
            ? t('updatePracticeDrawerTitle', { defaultValue: 'Update Practice' })
            : t('createPracticeDrawerTitle', { defaultValue: 'Create Practice' })}
        </Typography.Text>
      }
      open={drawerOpen}
      onClose={handleClose}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={handleFormSubmit}>
        <Form.Item
          name="name"
          label={t('nameLabel', { defaultValue: 'Name' })}
          rules={[
            {
              required: true,
              message: t('nameRequiredError', { defaultValue: 'Please enter practice name' }),
            },
          ]}
        >
          <Input placeholder={t('namePlaceholder', { defaultValue: 'Enter practice name' })} />
        </Form.Item>

        <Form.Item>
          <Button type="primary" style={{ width: '100%' }} htmlType="submit">
            {practiceId
              ? t('updateButton', { defaultValue: 'Update' })
              : t('createButton', { defaultValue: 'Create' })}
          </Button>
        </Form.Item>
      </Form>
    </Drawer>
  );
};

export default PracticeDrawer;
