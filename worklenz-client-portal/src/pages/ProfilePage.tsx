import React, { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Typography,
  Form,
  Input,
  Button,
  Row,
  Col,
  Spin,
  Alert,
  UserOutlined,
  LockOutlined
} from '@/shared/antd-imports';
import { App } from 'antd';
import clientPortalAPI from '@/services/api';
import { ClientProfile } from '@/types';

// Type for the flat API response from getClientProfile endpoint
interface ClientProfileApiResponse {
  id: string;
  email: string;
  name: string;
  role: string;
  clientId: string;
  clientName: string;
  companyName: string | null;
  createdAt: string;
  lastLogin: string | null;
}

interface ProfileFormValues {
  name: string;
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}

const { Title } = Typography;

const ProfilePage: React.FC = () => {
  const { message } = App.useApp();
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [form] = Form.useForm();

  const fetchProfile = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await clientPortalAPI.getProfile();

      if (response.done) {
        const rawData = response.body as ClientProfileApiResponse;

        // Transform flat API response to nested ClientProfile structure
        const transformedProfile: ClientProfile = {
          client: {
            id: rawData.clientId,
            name: rawData.clientName,
            email: rawData.email,
            companyName: rawData.companyName || '',
            phone: '',
            address: '',
            contactPerson: '',
            status: 'active',
            createdAt: rawData.createdAt
          },
          user: {
            id: rawData.id,
            name: rawData.name,
            email: rawData.email,
            role: rawData.role,
            status: 'active',
            createdAt: rawData.createdAt,
            lastLogin: rawData.lastLogin || undefined
          },
          statistics: {
            projectCount: 0,
            requestCount: 0,
            invoiceCount: 0,
            unpaidInvoiceCount: 0
          }
        };

        setProfile(transformedProfile);

        // Populate form with current data
        form.setFieldsValue({
          name: rawData.name,
        });
      } else {
        setError('Failed to load profile');
      }
    } catch (err) {
      setError('Failed to load profile. Please try again later.');
      console.error('Profile API error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [form]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleUpdateProfile = async (values: ProfileFormValues) => {
    try {
      setIsUpdating(true);

      // Transform form values to match backend API expectations
      const updateData = {
        name: values.name,
        currentPassword: values.currentPassword,
        newPassword: values.newPassword
      };

      const response = await clientPortalAPI.updateProfile(updateData);

      if (response.done) {
        message.success('Profile updated successfully');
        // Clear password fields after successful update
        form.setFieldsValue({
          currentPassword: undefined,
          newPassword: undefined,
          confirmPassword: undefined
        });
        await fetchProfile(); // Refresh profile data
      } else {
        message.error(response.message || 'Failed to update profile');
      }
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || 'Failed to update profile. Please try again.';
      message.error(errorMessage);
      console.error('Update profile API error:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
        <div style={{ marginTop: '16px' }}>Loading profile...</div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        message="Error"
        description={error}
        type="error"
        showIcon
        action={
          <Button onClick={fetchProfile}>
            Try Again
          </Button>
        }
      />
    );
  }

  if (!profile) {
    return (
      <Alert
        message="Profile Not Found"
        description="Your profile information could not be loaded."
        type="warning"
        showIcon
      />
    );
  }

  return (
    <div>
      <Title level={2}>
        <UserOutlined /> Profile
      </Title>
      <p>Manage your profile information and account settings</p>

      {/* Profile Form */}
      <Row gutter={[16, 16]}>
        <Col xs={24} md={16} lg={12}>
          <Card title="Edit Profile">
            <Form
              form={form}
              layout="vertical"
              onFinish={handleUpdateProfile}
              disabled={isUpdating}
            >
              <Form.Item
                label="Display Name"
                name="name"
                rules={[{ required: true, message: 'Please enter your name' }]}
              >
                <Input prefix={<UserOutlined />} placeholder="Your name" size="large" />
              </Form.Item>

              <Title level={4} style={{ marginTop: 32, marginBottom: 16 }}>Change Password</Title>

              <Form.Item
                label="Current Password"
                name="currentPassword"
                rules={[
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value && getFieldValue('newPassword')) {
                        return Promise.reject(new Error('Please enter your current password'));
                      }
                      return Promise.resolve();
                    },
                  }),
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="Enter current password"
                  size="large"
                />
              </Form.Item>

              <Form.Item
                label="New Password"
                name="newPassword"
                dependencies={['currentPassword']}
                rules={[
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value && getFieldValue('currentPassword')) {
                        return Promise.reject(new Error('Please enter new password'));
                      }
                      if (value && !getFieldValue('currentPassword')) {
                        return Promise.reject(new Error('Please enter your current password'));
                      }
                      if (value && value.length < 6) {
                        return Promise.reject(new Error('Password must be at least 6 characters'));
                      }
                      return Promise.resolve();
                    },
                  }),
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="Enter new password (min 6 characters)"
                  size="large"
                />
              </Form.Item>

              <Form.Item
                label="Confirm New Password"
                name="confirmPassword"
                dependencies={['newPassword']}
                rules={[
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      const newPassword = getFieldValue('newPassword');
                      if (newPassword && !value) {
                        return Promise.reject(new Error('Please confirm your new password'));
                      }
                      if (value && value !== newPassword) {
                        return Promise.reject(new Error('Passwords do not match'));
                      }
                      return Promise.resolve();
                    },
                  }),
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="Confirm new password"
                  size="large"
                />
              </Form.Item>

              <Form.Item style={{ marginTop: 32, marginBottom: 0 }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={isUpdating}
                  icon={<UserOutlined />}
                  size="large"
                >
                  Update Profile
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default ProfilePage;