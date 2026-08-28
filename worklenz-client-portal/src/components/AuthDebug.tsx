import React from 'react';
import { Card, Button, Typography, Space, Tag, Divider } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { loginUser, logoutUser, refreshToken, validateInviteToken, acceptInvite, clearAuth } from '@/store/slices/authSlice';
import { TokenManager } from '@/utils/tokenManager';

const { Title, Text } = Typography;

const AuthDebug: React.FC = () => {
  const dispatch = useAppDispatch();
  const auth = useAppSelector((state) => state.auth);

  const handleTestLogin = async () => {
    await dispatch(loginUser({
      email: 'test@example.com',
      password: 'testpassword'
    }));
  };

  const handleTestLogout = async () => {
    await dispatch(logoutUser());
  };

  const handleTestRefresh = async () => {
    await dispatch(refreshToken());
  };

  const handleTestValidateInvite = async () => {
    await dispatch(validateInviteToken('test-invite-token-123'));
  };

  const handleTestAcceptInvite = async () => {
    await dispatch(acceptInvite({
      token: 'test-invite-token-123',
      name: 'Test User',
      email: 'test@example.com',
      password: 'testpassword'
    }));
  };

  const handleClearAuth = () => {
    dispatch(clearAuth());
    window.location.reload();
  };

  const handleClearLocalStorage = () => {
    localStorage.removeItem('clientToken');
    localStorage.removeItem('clientTokenExpiry');
    window.location.reload();
  };

  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  return (
    <Card 
      title="Authentication Debug Panel" 
      style={{ position: 'fixed', top: 20, right: 20, width: 400, zIndex: 1000 }}
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <div>
          <Title level={5}>Authentication State</Title>
          <Space direction="vertical" size="small">
            <div>
              <Text strong>Authenticated: </Text>
              <Tag color={auth.isAuthenticated ? 'green' : 'red'}>
                {auth.isAuthenticated ? 'Yes' : 'No'}
              </Tag>
            </div>
            <div>
              <Text strong>Loading: </Text>
              <Tag color={auth.isLoading ? 'orange' : 'blue'}>
                {auth.isLoading ? 'Yes' : 'No'}
              </Tag>
            </div>
            <div>
              <Text strong>Token: </Text>
              <Text code>{auth.token ? auth.token.substring(0, 20) + '...' : 'None'}</Text>
            </div>
            <div>
              <Text strong>User: </Text>
              <Text>{auth.user ? auth.user.name : 'None'}</Text>
            </div>
            <div>
              <Text strong>Error: </Text>
              <Text type="danger">{auth.error || 'None'}</Text>
            </div>
          </Space>
        </div>

        <Divider />

        <div>
          <Title level={5}>Token Management</Title>
          <Space direction="vertical" size="small">
            <div>
              <Text strong>Token Valid: </Text>
              <Tag color={TokenManager.isTokenValid() ? 'green' : 'red'}>
                {TokenManager.isTokenValid() ? 'Yes' : 'No'}
              </Tag>
            </div>
            <div>
              <Text strong>Should Refresh: </Text>
              <Tag color={TokenManager.shouldRefreshToken() ? 'orange' : 'blue'}>
                {TokenManager.shouldRefreshToken() ? 'Yes' : 'No'}
              </Tag>
            </div>
            <div>
              <Text strong>Time Until Expiry: </Text>
              <Text>{TokenManager.formatTimeUntilExpiry()}</Text>
            </div>
          </Space>
        </div>

        <Divider />

        <div>
          <Title level={5}>Invite State</Title>
          <Space direction="vertical" size="small">
            <div>
              <Text strong>Invite Token: </Text>
              <Text code>{auth.inviteToken || 'None'}</Text>
            </div>
            <div>
              <Text strong>Invite Valid: </Text>
              <Tag color={auth.inviteValid ? 'green' : 'red'}>
                {auth.inviteValid ? 'Yes' : 'No'}
              </Tag>
            </div>
            <div>
              <Text strong>Invite Loading: </Text>
              <Tag color={auth.inviteLoading ? 'orange' : 'blue'}>
                {auth.inviteLoading ? 'Yes' : 'No'}
              </Tag>
            </div>
          </Space>
        </div>

        <Divider />

        <div>
          <Title level={5}>Test Actions</Title>
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <Button 
              onClick={handleTestLogin} 
              loading={auth.isLoading}
              disabled={auth.isAuthenticated}
              block
            >
              Test Login
            </Button>
            <Button 
              onClick={handleTestLogout} 
              loading={auth.isLoading}
              disabled={!auth.isAuthenticated}
              block
            >
              Test Logout
            </Button>
            <Button 
              onClick={handleTestRefresh} 
              loading={auth.isLoading}
              disabled={!auth.isAuthenticated}
              block
            >
              Test Refresh Token
            </Button>
            <Button 
              onClick={handleTestValidateInvite} 
              loading={auth.inviteLoading}
              block
            >
              Test Validate Invite
            </Button>
            <Button 
              onClick={handleTestAcceptInvite} 
              loading={auth.isLoading}
              block
            >
              Test Accept Invite
            </Button>
            <Button 
              onClick={handleClearAuth} 
              type="primary" 
              danger
              block
            >
              Clear Auth State
            </Button>
            <Button 
              onClick={handleClearLocalStorage} 
              block
            >
              Clear localStorage
            </Button>
          </Space>
        </div>
      </Space>
    </Card>
  );
};

export default AuthDebug; 