import React, { useEffect, useState } from 'react';
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
  Descriptions,
  Space,
  Statistic,
  message,
  UserOutlined, 
  MailOutlined, 
  PhoneOutlined,
  TeamOutlined,
  ProjectOutlined,
  FileTextOutlined,
  FileDoneOutlined,
  LockOutlined
} from '@/shared/antd-imports';
import clientPortalAPI from '@/services/api';
import { ClientProfile } from '@/types';

const { Title } = Typography;

const ProfilePage: React.FC = () => {
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await clientPortalAPI.getProfile();

      if (response.done) {
        setProfile(response.body as ClientProfile);
        // Populate form with current data
        form.setFieldsValue({
          clientName: (response.body as ClientProfile).client.name,
          clientPhone: (response.body as ClientProfile).client.phone,
          clientAddress: (response.body as ClientProfile).client.address,
          contactPerson: (response.body as ClientProfile).client.contactPerson,
          userName: (response.body as ClientProfile).user?.name,
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
  };

  const handleUpdateProfile = async (values: any) => {
    try {
      setIsUpdating(true);
      
      const response = await clientPortalAPI.updateProfile(values);

      if (response.done) {
        message.success('Profile updated successfully');
        await fetchProfile(); // Refresh profile data
      } else {
        message.error('Failed to update profile');
      }
    } catch (err) {
      message.error('Failed to update profile. Please try again.');
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

      <Row gutter={[16, 16]}>
        {/* Profile Statistics */}
        <Col xs={24} lg={8}>
          <Card title="Account Statistics">
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Statistic
                  title="Projects"
                  value={profile.statistics.projectCount}
                  prefix={<ProjectOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="Requests"
                  value={profile.statistics.requestCount}
                  prefix={<FileTextOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="Invoices"
                  value={profile.statistics.invoiceCount}
                  prefix={<FileDoneOutlined />}
                  valueStyle={{ color: '#722ed1' }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="Unpaid"
                  value={profile.statistics.unpaidInvoiceCount}
                  prefix={<FileDoneOutlined />}
                  valueStyle={{ color: '#cf1322' }}
                />
              </Col>
            </Row>
          </Card>

          {/* Account Information */}
          <Card title="Account Information" style={{ marginTop: 16 }}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Account Created">
                {new Date(profile.client.createdAt).toLocaleDateString()}
              </Descriptions.Item>
              <Descriptions.Item label="Account Status">
                <span style={{ 
                  color: profile.client.status === 'active' ? '#52c41a' : '#faad14',
                  textTransform: 'capitalize'
                }}>
                  {profile.client.status}
                </span>
              </Descriptions.Item>
              {profile.user?.lastLogin && (
                <Descriptions.Item label="Last Login">
                  {new Date(profile.user.lastLogin).toLocaleString()}
                </Descriptions.Item>
              )}
              {profile.user?.role && (
                <Descriptions.Item label="Role">
                  <span style={{ textTransform: 'capitalize' }}>
                    {profile.user.role}
                  </span>
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>
        </Col>

        {/* Profile Form */}
        <Col xs={24} lg={16}>
          <Card title="Edit Profile">
            <Form
              form={form}
              layout="vertical"
              onFinish={handleUpdateProfile}
              disabled={isUpdating}
            >
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label="Client Name"
                    name="clientName"
                    rules={[{ required: true, message: 'Please enter client name' }]}
                  >
                    <Input prefix={<TeamOutlined />} placeholder="Client name" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label="Contact Person"
                    name="contactPerson"
                  >
                    <Input prefix={<UserOutlined />} placeholder="Contact person" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label="Phone"
                    name="clientPhone"
                  >
                    <Input prefix={<PhoneOutlined />} placeholder="Phone number" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label="Email"
                    name="clientEmail"
                  >
                    <Input 
                      prefix={<MailOutlined />} 
                      value={profile.client.email}
                      disabled
                      placeholder="Email address" 
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                label="Address"
                name="clientAddress"
              >
                <Input.TextArea 
                  placeholder="Company address"
                  rows={3}
                />
              </Form.Item>

              {profile.user && (
                <>
                  <Title level={4} style={{ marginTop: 24 }}>User Account</Title>
                  
                  <Row gutter={16}>
                    <Col xs={24} sm={12}>
                      <Form.Item
                        label="Display Name"
                        name="userName"
                        rules={[{ required: true, message: 'Please enter your name' }]}
                      >
                        <Input prefix={<UserOutlined />} placeholder="Your name" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item
                        label="Email"
                        name="userEmail"
                      >
                        <Input 
                          prefix={<MailOutlined />} 
                          value={profile.user.email}
                          disabled
                          placeholder="User email" 
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Title level={4} style={{ marginTop: 24 }}>Change Password</Title>
                  <Row gutter={16}>
                    <Col xs={24} sm={12}>
                      <Form.Item
                        label="Current Password"
                        name="currentPassword"
                      >
                        <Input.Password 
                          prefix={<LockOutlined />} 
                          placeholder="Current password" 
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
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
                          placeholder="New password" 
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                </>
              )}

              <Form.Item style={{ marginTop: 32 }}>
                <Space>
                  <Button 
                    type="primary" 
                    htmlType="submit" 
                    loading={isUpdating}
                    icon={<UserOutlined />}
                  >
                    Update Profile
                  </Button>
                  <Button onClick={() => form.resetFields()}>
                    Reset
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default ProfilePage;