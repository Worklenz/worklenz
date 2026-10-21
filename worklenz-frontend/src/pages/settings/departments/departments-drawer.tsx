import { Button, Drawer, Form, Input, message, Typography } from '@/shared/antd-imports';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { departmentsApiService } from '@/api/settings/departments/departments.api.service';

type DepartmentDrawerProps = {
  drawerOpen: boolean;
  departmentId: string | null;
  drawerClosed: () => void;
};

const DepartmentDrawer = ({
  drawerOpen = false,
  departmentId = null,
  drawerClosed,
}: DepartmentDrawerProps) => {
  const { t } = useTranslation('settings/departments');
  const [form] = Form.useForm();

  useEffect(() => {
    if (!drawerOpen) return;

    if (departmentId) {
      getDepartmentById(departmentId);
      return;
    }

    form.resetFields();
  }, [departmentId, drawerOpen, form]);

  const getDepartmentById = async (id: string) => {
    try {
      const response = await departmentsApiService.getDepartmentById(id);
      if (response.done) {
        form.setFieldsValue({ name: response.body.name });
      }
    } catch {
      message.error(
        t('fetchDepartmentErrorMessage', { defaultValue: 'Failed to fetch department' })
      );
    }
  };

  const handleFormSubmit = async (values: { name: string }) => {
    try {
      if (departmentId) {
        const response = await departmentsApiService.updateDepartment(departmentId, {
          name: values.name,
        });
        if (response.done) {
          drawerClosed();
        }
      } else {
        const response = await departmentsApiService.createDepartment({ name: values.name });
        if (response.done) {
          drawerClosed();
        }
      }
    } catch {
      message.error(
        departmentId
          ? t('updateDepartmentErrorMessage', { defaultValue: 'Failed to update department' })
          : t('createDepartmentErrorMessage', { defaultValue: 'Failed to create department' })
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
          {departmentId
            ? t('updateDepartmentDrawerTitle', { defaultValue: 'Update Department' })
            : t('createDepartmentDrawerTitle', { defaultValue: 'Create Department' })}
        </Typography.Text>
      }
      open={drawerOpen}
      onClose={handleClose}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={handleFormSubmit}>
        <Form.Item
          name="name"
          label={t('nameLabel', { defaultValue: 'Name' })}
          rules={[
            {
              required: true,
              message: t('nameRequiredError', { defaultValue: 'Please enter department name' }),
            },
          ]}
        >
          <Input placeholder={t('namePlaceholder', { defaultValue: 'Enter department name' })} />
        </Form.Item>

        <Form.Item>
          <Button type="primary" style={{ width: '100%' }} htmlType="submit">
            {departmentId
              ? t('updateButton', { defaultValue: 'Update' })
              : t('createButton', { defaultValue: 'Create' })}
          </Button>
        </Form.Item>
      </Form>
    </Drawer>
  );
};

export default DepartmentDrawer;
