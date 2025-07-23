import { LoadingOutlined, PlusOutlined } from '@/shared/antd-imports';
import {
  Button,
  Card,
  Flex,
  Form,
  Input,
  Tooltip,
  Typography,
  Spin,
  Skeleton,
} from '@/shared/antd-imports';
import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { changeUserName, setUser } from '@features/user/userSlice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import {
  evt_settings_profile_visit,
  evt_settings_profile_name_change,
  evt_settings_profile_picture_update,
} from '@/shared/worklenz-analytics-events';
import { useAuthService } from '@/hooks/useAuth';
import { getBase64 } from '@/utils/file-utils';

import './profile-settings.css';
import { profileSettingsApiService } from '@/api/settings/profile/profile-settings.api.service';
import taskAttachmentsApiService from '@/api/tasks/task-attachments.api.service';
import logger from '@/utils/errorLogger';
import { setSession } from '@/utils/session-helper';
import { authApiService } from '@/api/auth/auth.api.service';

const ProfileSettings = () => {
  const { t } = useTranslation('settings/profile');
  const dispatch = useAppDispatch();
  const { trackMixpanelEvent } = useMixpanelTracking();

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [updating, setUpdating] = useState(false);

  const [imageUrl, setImageUrl] = useState<string>();
  const [form] = Form.useForm();
  const currentSession = useAuthService().getCurrentSession();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useDocumentTitle(t('title') || 'Profile Settings');

  useEffect(() => {
    trackMixpanelEvent(evt_settings_profile_visit);
  }, [trackMixpanelEvent]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (uploading || !event.target.files || event.target.files.length === 0) return;

    const file = event.target.files[0];
    setUploading(true);

    try {
      const base64 = await getBase64(file);
      const res = await taskAttachmentsApiService.createAvatarAttachment({
        file: base64 as string,
        file_name: file.name,
        size: file.size,
      });
      if (res.done) {
        trackMixpanelEvent(evt_settings_profile_picture_update);
        const authorizeResponse = await authApiService.verify();
        if (authorizeResponse.authenticated) {
          setSession(authorizeResponse.user);
          dispatch(setUser(authorizeResponse.user));
        }
      }
    } catch (e) {
      logger.error('Error uploading avatar', e);
    } finally {
      setUploading(false);
    }

    // Reset file input
    const dt = new DataTransfer();
    event.target.files = dt.files;
  };

  const triggerFileInput = () => {
    if (!uploading) {
      fileInputRef.current?.click();
    }
  };

  const avatarPreview = (
    <div
      className="avatar-uploader ant-upload-select-picture-card"
      onClick={triggerFileInput}
      style={{
        width: '104px',
        height: '104px',
        cursor: uploading ? 'wait' : 'pointer',
        position: 'relative',
      }}
    >
      {uploading && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1,
            borderRadius: '4px',
          }}
        >
          <Spin indicator={<LoadingOutlined style={{ fontSize: 24, color: 'white' }} spin />} />
        </div>
      )}
      {loading ? (
        <LoadingOutlined />
      ) : imageUrl || currentSession?.avatar_url ? (
        <img
          src={imageUrl || currentSession?.avatar_url}
          alt="avatar"
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }}
        />
      ) : (
        <Flex align="center" justify="center" vertical gap={8} style={{ height: '100%' }}>
          <PlusOutlined />
          <Typography.Text>{t('upload')}</Typography.Text>
        </Flex>
      )}
    </div>
  );

  const handleFormSubmit = async ({ name }: { name: string }) => {
    if (name === currentSession?.name) {
      return;
    }

    setUpdating(true);
    try {
      const res = await profileSettingsApiService.updateProfile({ name });
      if (res.done) {
        trackMixpanelEvent(evt_settings_profile_name_change, { newName: name });
        dispatch(changeUserName(name));
        // Refresh user session to get updated data
        const authorizeResponse = await authApiService.verify();
        if (authorizeResponse.authenticated) {
          setSession(authorizeResponse.user);
          dispatch(setUser(authorizeResponse.user));
        }
      }
    } catch (error) {
      logger.error('Error changing name', error);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Card style={{ width: '100%' }}>
      {updating ? (
        <Skeleton />
      ) : (
        <Form
          form={form}
          onFinish={handleFormSubmit}
          layout="vertical"
          initialValues={{
            name: currentSession?.name,
            email: currentSession?.email,
          }}
          style={{ width: '100%', maxWidth: 350 }}
        >
          <Form.Item>
            <Tooltip title={t('avatarTooltip') || 'Click to upload an avatar'} placement="topLeft">
              {avatarPreview}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png, image/jpg, image/jpeg"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </Tooltip>
          </Form.Item>
          <Form.Item
            name="name"
            label={t('nameLabel')}
            rules={[
              {
                required: true,
                message: t('nameRequiredError'),
              },
              {
                min: 2,
                message: t('nameMinLengthError') || 'Name must be at least 2 characters',
              },
              {
                max: 50,
                message: t('nameMaxLengthError') || 'Name cannot exceed 50 characters',
              },
            ]}
          >
            <Input style={{ borderRadius: 4 }} />
          </Form.Item>
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
            <Input style={{ borderRadius: 4 }} disabled />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={updating}>
              {t('saveChanges')}
            </Button>
          </Form.Item>
        </Form>
      )}

      <Flex vertical gap={4} style={{ marginTop: 16 }}>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {t('profileJoinedText', {
            date: currentSession?.created_at
              ? new Date(currentSession.created_at).toLocaleDateString()
              : '',
          })}
        </Typography.Text>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {t('profileLastUpdatedText', {
            date: currentSession?.updated_at
              ? new Date(currentSession.updated_at).toLocaleDateString()
              : '',
          })}
        </Typography.Text>
      </Flex>
    </Card>
  );
};

export default ProfileSettings;
