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
  Space,
  Modal,
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
import { calculateTimeDifference } from '@/utils/calculate-time-difference';
import { formatDateTimeWithLocale } from '@/utils/format-date-time-with-locale';
import { setSession } from '@/utils/session-helper';

const ProfileSettings = () => {
  const { t } = useTranslation('settings/profile');
  const dispatch = useAppDispatch();
  const { trackMixpanelEvent } = useMixpanelTracking();
  const currentSession = useAuthService().getCurrentSession();

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | undefined>(
    currentSession?.last_updated ?? currentSession?.updated_at
  );

  // New states for preview functionality
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<{
    base64: string;
    name: string;
    size: number;
  } | null>(null);
  const [isPreviewModalVisible, setIsPreviewModalVisible] = useState(false);

  const [imageUrl, setImageUrl] = useState<string>();
  const [form] = Form.useForm();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useDocumentTitle(t('title') || 'Profile Settings');

  useEffect(() => {
    trackMixpanelEvent(evt_settings_profile_visit);
  }, [trackMixpanelEvent]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (uploading || !event.target.files || event.target.files.length === 0) return;

    const file = event.target.files[0];

    try {
      const base64 = await getBase64(file);

      // Store the file data and preview for user confirmation
      setPendingFile({
        base64: base64 as string,
        name: file.name,
        size: file.size,
      });
      setPreviewImage(base64 as string);
      setIsPreviewModalVisible(true);
    } catch (e) {
      logger.error('Error reading file', e);
    }

    // Reset file input
    const dt = new DataTransfer();
    event.target.files = dt.files;
  };

  const handleSaveAvatar = async () => {
    if (!pendingFile) return;

    setUploading(true);

    try {
      const res = await taskAttachmentsApiService.createAvatarAttachment({
        file: pendingFile.base64,
        file_name: pendingFile.name,
        size: pendingFile.size,
      });

      if (res.done) {
        trackMixpanelEvent(evt_settings_profile_picture_update);

        // Update session with the latest data from API response
        const updatedUser = {
          ...currentSession,
          avatar_url: res.body.url,
          last_updated: res.body.updated_at || new Date().toISOString(),
          updated_at: res.body.updated_at || new Date().toISOString(),
        };
        setSession(updatedUser);
        dispatch(setUser(updatedUser));

        // Update local image URL
        setImageUrl(res.body.url);
        setLastUpdatedAt(res.body.updated_at || new Date().toISOString());

        // Close modal and clear pending data
        setIsPreviewModalVisible(false);
        setPendingFile(null);
        setPreviewImage(null);
      }
    } catch (e) {
      logger.error('Error uploading avatar', e);
    } finally {
      setUploading(false);
    }
  };

  const handleCancelAvatar = () => {
    setIsPreviewModalVisible(false);
    setPendingFile(null);
    setPreviewImage(null);
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

        const newUpdatedAt = res.body.updated_at || new Date().toISOString();

        // Update session with the latest data from API response
        const updatedUser = {
          ...currentSession,
          ...res.body,
          last_updated: newUpdatedAt,
          updated_at: newUpdatedAt,
        };
        setSession(updatedUser);
        dispatch(setUser(updatedUser));
        setLastUpdatedAt(newUpdatedAt);
      }
    } catch (error) {
      logger.error('Error changing name', error);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <>
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
              <Tooltip
                title={t('avatarTooltip') || 'Click to upload an avatar'}
                placement="topLeft"
              >
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
          <Tooltip
            title={(currentSession?.joined_date || currentSession?.created_at)
              ? formatDateTimeWithLocale(currentSession?.joined_date || currentSession?.created_at || '')
              : ''}>
            <Typography.Text type="secondary" style={{ fontSize: 12, width: 'fit-content' }}>
              {t('profileJoinedText', {
                date: (currentSession?.joined_date || currentSession?.created_at)
                  ? calculateTimeDifference(currentSession?.joined_date || currentSession?.created_at || '')
                  : '',
              })}
            </Typography.Text>
          </Tooltip>
          <Tooltip title={lastUpdatedAt ? formatDateTimeWithLocale(lastUpdatedAt) : ''}>
            <Typography.Text type="secondary" style={{ fontSize: 12, width: 'fit-content' }}>
              {t('profileLastUpdatedText', {
                date: lastUpdatedAt
                  ? calculateTimeDifference(lastUpdatedAt)
                  : '',
              })}
            </Typography.Text>
          </Tooltip>
        </Flex>
      </Card>

      {/* Preview Modal */}
      <Modal
        title="Confirm Profile Picture"
        open={isPreviewModalVisible}
        onCancel={handleCancelAvatar}
        footer={[
          <Button key="cancel" onClick={handleCancelAvatar} disabled={uploading}>
            Cancel
          </Button>,
          <Button key="save" type="primary" onClick={handleSaveAvatar} loading={uploading}>
            Save
          </Button>,
        ]}
        centered
      >
        <Flex vertical align="center" gap={16} style={{ padding: '20px 0' }}>
          <Typography.Text>Do you want to set this as your profile picture?</Typography.Text>
          {previewImage && (
            <img
              src={previewImage}
              alt="Preview"
              style={{
                width: '200px',
                height: '200px',
                objectFit: 'cover',
                borderRadius: '8px',
                border: '1px solid #d9d9d9',
              }}
            />
          )}
        </Flex>
      </Modal>
    </>
  );
};

export default ProfileSettings;
