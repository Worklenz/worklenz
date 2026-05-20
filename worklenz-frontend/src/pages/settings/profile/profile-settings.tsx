import { LoadingOutlined, PlusOutlined } from '@/shared/antd-imports';
import {
  Button,
  Card,
  Flex,
  Form,
  Input,
  Popconfirm,
  Tooltip,
  Typography,
  Spin,
  Skeleton,
  Modal,
  Slider,
  theme,
} from '@/shared/antd-imports';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import Cropper from 'react-easy-crop';
import type { Area, Point } from 'react-easy-crop';
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

// ─── Helper: crop the image on a canvas and return a base64 string ───────────
const getCroppedImg = (imageSrc: string, pixelCrop: Area): Promise<string> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => {
      const canvas = document.createElement('canvas');
      canvas.width = pixelCrop.width;
      canvas.height = pixelCrop.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas context not available'));

      ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height,
      );

      resolve(canvas.toDataURL('image/jpeg', 0.92));
    });
    image.addEventListener('error', reject);
    image.src = imageSrc;
  });
};

// ─── Component ───────────────────────────────────────────────────────────────
const ProfileSettings = () => {
  const { t } = useTranslation('settings/profile');
  const { token } = theme.useToken();
  const dispatch = useAppDispatch();
  const { trackMixpanelEvent } = useMixpanelTracking();
  const currentSession = useAuthService().getCurrentSession();

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | undefined>(
    currentSession?.last_updated ?? currentSession?.updated_at,
  );

  // ── Crop modal state ──────────────────────────────────────────────────────
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [pendingFileName, setPendingFileName] = useState<string>('avatar.jpg');
  const [isCropModalVisible, setIsCropModalVisible] = useState(false);

  // react-easy-crop state
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const [imageUrl, setImageUrl] = useState<string>();
  const [form] = Form.useForm();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasAvatar = Boolean(imageUrl || currentSession?.avatar_url);

  useDocumentTitle(t('title') || 'Profile Settings');

  useEffect(() => {
    trackMixpanelEvent(evt_settings_profile_visit);
  }, [trackMixpanelEvent]);

  // ── File selected → open crop modal ──────────────────────────────────────
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (uploading || !event.target.files || event.target.files.length === 0) return;

    const file = event.target.files[0];

    try {
      const base64 = (await getBase64(file)) as string;
      setRawImageSrc(base64);
      setPendingFileName(file.name);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setIsCropModalVisible(true);
    } catch (e) {
      logger.error('Error reading file', e);
    }

    // Reset file input so the same file can be re-selected
    const dt = new DataTransfer();
    event.target.files = dt.files;
  };

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  // ── Save cropped image ────────────────────────────────────────────────────
  const handleSaveAvatar = async () => {
    if (!rawImageSrc || !croppedAreaPixels) return;

    setUploading(true);

    try {
      const croppedBase64 = await getCroppedImg(rawImageSrc, croppedAreaPixels);

      // Approximate byte size of the base64 data
      const size = Math.round((croppedBase64.length * 3) / 4);

      const res = await taskAttachmentsApiService.createAvatarAttachment({
        file: croppedBase64,
        file_name: pendingFileName,
        size,
      });

      if (res.done) {
        trackMixpanelEvent(evt_settings_profile_picture_update);

        const updatedUser = {
          ...currentSession,
          avatar_url: res.body.url,
          last_updated: res.body.updated_at || new Date().toISOString(),
          updated_at: res.body.updated_at || new Date().toISOString(),
        };
        setSession(updatedUser);
        dispatch(setUser(updatedUser));
        setImageUrl(res.body.url);
        setLastUpdatedAt(res.body.updated_at || new Date().toISOString());

        handleCancelCrop();
      }
    } catch (e) {
      logger.error('Error uploading avatar', e);
    } finally {
      setUploading(false);
    }
  };

  const handleCancelCrop = () => {
    setIsCropModalVisible(false);
    setRawImageSrc(null);
    setCroppedAreaPixels(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  const triggerFileInput = () => {
    if (!uploading) fileInputRef.current?.click();
  };

  const handleRemoveAvatar = async () => {
    if (uploading) return;

    setUploading(true);

    try {
      const res = await taskAttachmentsApiService.deleteAvatarAttachment();

      if (res.done) {
        const updatedAt = res.body?.updated_at || new Date().toISOString();
        const updatedUser = {
          ...currentSession,
          avatar_url: '',
          last_updated: updatedAt,
          updated_at: updatedAt,
        };

        setSession(updatedUser);
        dispatch(setUser(updatedUser));
        setImageUrl(undefined);
        setLastUpdatedAt(updatedAt);
      }
    } catch (e) {
      logger.error('Error removing avatar', e);
    } finally {
      setUploading(false);
    }
  };

  // ── Avatar preview button ─────────────────────────────────────────────────
  const avatarPreview = (
    <div
      className="avatar-uploader ant-upload-select-picture-card"
      onClick={triggerFileInput}
      style={{
        width: '104px',
        height: '104px',
        cursor: uploading ? 'wait' : 'pointer',
        position: 'relative',
        border: `1px dashed ${token.colorBorder}`,
        background: token.colorFillAlter,
        borderRadius: token.borderRadius,
        color: token.colorTextSecondary,
        transition: 'border-color 0.2s ease, background-color 0.2s ease',
      }}
    >
      {uploading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
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
      ) : hasAvatar ? (
        <img
          src={imageUrl || currentSession?.avatar_url}
          alt="avatar"
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }}
        />
      ) : (
        <Flex align="center" justify="center" vertical gap={8} style={{ height: '100%' }}>
          <PlusOutlined />
          <Typography.Text style={{ color: token.colorTextSecondary }}>
            {t('upload')}
          </Typography.Text>
        </Flex>
      )}
    </div>
  );

  // ── Name update ───────────────────────────────────────────────────────────
  const handleFormSubmit = async ({ name }: { name: string }) => {
    if (name === currentSession?.name) return;

    setUpdating(true);
    try {
      const res = await profileSettingsApiService.updateProfile({ name });
      if (res.done) {
        trackMixpanelEvent(evt_settings_profile_name_change, { newName: name });
        dispatch(changeUserName(name));
        setIsDirty(false);

        const newUpdatedAt = res.body.updated_at || new Date().toISOString();
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

  // ── Render ────────────────────────────────────────────────────────────────
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
            onValuesChange={(_, allValues) => {
              const nameChanged = allValues.name !== currentSession?.name;
              setIsDirty(nameChanged);
            }}
            style={{ width: '100%', maxWidth: 350 }}
          >
            <Form.Item>
              <Tooltip
                title={t('avatarTooltip', { defaultValue: 'Click to upload an avatar' })}
                placement="topLeft"
              >
                <Flex vertical gap={8} align="flex-start">
                  {avatarPreview}
                  {hasAvatar && (
                    <Popconfirm
                      title={t('removeAvatarConfirmTitle', {
                        defaultValue: 'Remove profile picture?',
                      })}
                      description={t('removeAvatarConfirmDescription', {
                        defaultValue: 'Your avatar will be removed and your initials will be shown instead.',
                      })}
                      okText={t('removeAvatar', { defaultValue: 'Remove' })}
                      cancelText={t('cancel', { defaultValue: 'Cancel' })}
                      okButtonProps={{ danger: true, loading: uploading }}
                      onConfirm={handleRemoveAvatar}
                    >
                      <Button type="text" danger size="small" disabled={uploading}>
                        {t('removeAvatar', { defaultValue: 'Remove photo' })}
                      </Button>
                    </Popconfirm>
                  )}
                </Flex>
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
                { required: true, message: t('nameRequiredError') },
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
              rules={[{ required: true, message: t('emailRequiredError') }]}
            >
              <Input style={{ borderRadius: 4 }} disabled />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" loading={updating}>
                {isDirty ? t('saveChanges') : t('save')}
              </Button>
            </Form.Item>
          </Form>
        )}

        <Flex vertical gap={4} style={{ marginTop: 16 }}>
          <Tooltip
            title={
              currentSession?.joined_date || currentSession?.created_at
                ? formatDateTimeWithLocale(
                  currentSession?.joined_date || currentSession?.created_at || '',
                )
                : ''
            }
          >
            <Typography.Text type="secondary" style={{ fontSize: 12, width: 'fit-content' }}>
              {t('profileJoinedText', {
                date:
                  currentSession?.joined_date || currentSession?.created_at
                    ? calculateTimeDifference(
                      currentSession?.joined_date || currentSession?.created_at || '',
                    )
                    : '',
              })}
            </Typography.Text>
          </Tooltip>
          <Tooltip title={lastUpdatedAt ? formatDateTimeWithLocale(lastUpdatedAt) : ''}>
            <Typography.Text type="secondary" style={{ fontSize: 12, width: 'fit-content' }}>
              {t('profileLastUpdatedText', {
                date: lastUpdatedAt ? calculateTimeDifference(lastUpdatedAt) : '',
              })}
            </Typography.Text>
          </Tooltip>
        </Flex>
      </Card>

      {/* ── Crop Modal ──────────────────────────────────────────────────────── */}
      <Modal
        title="Crop Profile Picture"
        open={isCropModalVisible}
        onCancel={handleCancelCrop}
        width={520}
        centered
        destroyOnClose
        footer={[
          <Button key="cancel" onClick={handleCancelCrop} disabled={uploading}>
            Cancel
          </Button>,
          <Button key="save" type="primary" onClick={handleSaveAvatar} loading={uploading}>
            Save
          </Button>,
        ]}
      >
        {/* Crop area */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: 360,
            background: '#1a1a1a',
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          {rawImageSrc && (
            <Cropper
              image={rawImageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          )}
        </div>

        {/* Zoom slider */}
        <Flex align="center" gap={12} style={{ marginTop: 16, padding: '0 4px' }}>
          <Typography.Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
            Zoom
          </Typography.Text>
          <Slider
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(val) => setZoom(val)}
            style={{ flex: 1 }}
          />
        </Flex>

        <Typography.Text
          type="secondary"
          style={{ display: 'block', textAlign: 'center', fontSize: 12, marginTop: 8 }}
        >
          Drag to reposition · Scroll or use slider to zoom
        </Typography.Text>
      </Modal>
    </>
  );
};

export default ProfileSettings;
