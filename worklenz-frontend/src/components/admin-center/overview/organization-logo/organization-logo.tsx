import React, { useState, useRef, useEffect } from 'react';
import { Flex, Typography, Spin, message, Tooltip, Button, Popconfirm, Alert } from '@/shared/antd-imports';
import {
  LoadingOutlined,
  PlusOutlined,
  DeleteOutlined,
  InfoCircleOutlined,
} from '@/shared/antd-imports';
import { TFunction } from 'i18next';
import { getBase64 } from '@/utils/file-utils';
import { adminCenterApiService } from '@/api/admin-center/admin-center.api.service';
import logger from '@/utils/errorLogger';
import { IBillingAccountInfo, IOrganization } from '@/types/admin-center/admin-center.types';
import { ISUBSCRIPTION_TYPE } from '@/shared/constants';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { toggleUpgradeModal } from '@/features/admin-center/admin-center.slice';

interface OrganizationLogoProps {
  themeMode: string;
  organization: IOrganization | null;
  t: TFunction;
  refetch: () => void;
  billingInfo: IBillingAccountInfo | null;
}

const OrganizationLogo: React.FC<OrganizationLogoProps> = ({
  themeMode,
  organization,
  t,
  refetch,
  billingInfo,
}) => {
  const dispatch = useAppDispatch();
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(
    null
  );
  const [fileSize, setFileSize] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isFreePlan = billingInfo?.subscription_type === ISUBSCRIPTION_TYPE.FREE;

  useEffect(() => {
    if (organization?.logo_url) {
      setPreviewUrl(organization.logo_url);
    } else {
      setPreviewUrl(null);
    }
  }, [organization?.logo_url]);

  const validateImage = (file: File): { valid: boolean; warning?: string } => {
    // Check file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return { valid: false, warning: t('logoInvalidFormat') };
    }

    // Check file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return { valid: false, warning: t('logoFileTooLarge') };
    }

    // Warn if file is large
    const recommendedSize = 500 * 1024; // 500KB
    if (file.size > recommendedSize) {
      return { valid: true, warning: t('logoFileSizeWarning') };
    }

    return { valid: true };
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (uploading || !event.target.files || event.target.files.length === 0) return;

    // Check if user is on free plan
    if (isFreePlan) {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      message.warning('Upgrade to a paid plan to upload a custom logo.');
      dispatch(toggleUpgradeModal());
      return;
    }

    const file = event.target.files[0];
    const validation = validateImage(file);

    if (!validation.valid) {
      message.error(validation.warning);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    if (validation.warning) {
      message.warning(validation.warning);
    }

    setUploading(true);
    setFileSize(file.size);

    try {
      // Read image dimensions
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        setImageDimensions({ width: img.width, height: img.height });

        // Check dimensions and show warnings
        if (img.width < 200 || img.height < 60) {
          message.warning(t('logoTooSmall'));
        } else if (img.width > 800 || img.height > 240) {
          message.warning(t('logoTooLarge'));
        }

        // Check aspect ratio
        const aspectRatio = img.height / img.width;
        if (aspectRatio > 2) {
          message.warning(t('logoVerticalWarning'));
        }

        URL.revokeObjectURL(objectUrl);
      };

      img.src = objectUrl;

      // Convert to base64
      const base64 = await getBase64(file);

      // Upload logo
      const res = await adminCenterApiService.uploadOrganizationLogo(base64 as string);

      if (res.done) {
        setPreviewUrl(res.body?.logo_url || null);
        refetch();
      } else {
        logger.error('Error uploading logo', res.message);
      }
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.message || t('logoUploadError');
      logger.error('Error uploading logo', error);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setImageDimensions(null);
      setFileSize(null);
    }
  };

  const handleRemoveLogo = async () => {
    if (deleting || !previewUrl) return;

    // Check if user is on free plan
    if (isFreePlan) {
      message.warning('Upgrade to a paid plan to change or remove organization logo.');
      dispatch(toggleUpgradeModal());
      return;
    }

    setDeleting(true);
    try {
      const res = await adminCenterApiService.deleteOrganizationLogo();

      if (res.done) {
        setPreviewUrl(null);
        refetch();
      } else {
        logger.error('Error deleting logo', res.message);
      }
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.message || t('logoRemoveError');
      message.error(errorMessage);
      logger.error('Error deleting logo', error);
    } finally {
      setDeleting(false);
    }
  };

  const triggerFileInput = () => {
    if (uploading) return;

    // Check if user is on free plan
    if (isFreePlan) {
      message.warning('Upgrade to a paid plan to upload a custom logo.');
      dispatch(toggleUpgradeModal());
      return;
    }

    fileInputRef.current?.click();
  };

  const logoPreview = (
    <div
      className="logo-uploader"
      onClick={triggerFileInput}
      style={{
        width: '100%',
        maxWidth: '240px',
        height: '140px',
        cursor: uploading ? 'wait' : isFreePlan ? 'not-allowed' : 'pointer',
        position: 'relative',
        border: `2px dashed ${themeMode === 'dark' ? '#434343' : '#d9d9d9'}`,
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: themeMode === 'dark' ? '#1f1f1f' : '#fafafa',
        transition: 'all 0.3s ease',
        overflow: 'hidden',
        opacity: isFreePlan ? 0.7 : 1,
      }}
      onMouseEnter={e => {
        if (!uploading && !previewUrl && !isFreePlan) {
          e.currentTarget.style.borderColor = themeMode === 'dark' ? '#595959' : '#40a9ff';
          e.currentTarget.style.backgroundColor = themeMode === 'dark' ? '#262626' : '#f0f0f0';
        }
      }}
      onMouseLeave={e => {
        if (!previewUrl && !isFreePlan) {
          e.currentTarget.style.borderColor = themeMode === 'dark' ? '#434343' : '#d9d9d9';
          e.currentTarget.style.backgroundColor = themeMode === 'dark' ? '#1f1f1f' : '#fafafa';
        }
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
            borderRadius: '8px',
          }}
        >
          <Spin indicator={<LoadingOutlined style={{ fontSize: 24, color: 'white' }} spin />} />
        </div>
      )}

      {isFreePlan && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 2,
            backgroundColor: 'rgba(0,0,0,0.1)',
            borderRadius: '50%',
            padding: '4px',
            display: 'flex',
          }}
        >
          <Tooltip title="Available on paid plans">
            <InfoCircleOutlined style={{ color: '#8c8c8c' }} />
          </Tooltip>
        </div>
      )}

      {previewUrl ? (
        <img
          src={previewUrl}
          alt="Organization logo"
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            width: 'auto',
            height: 'auto',
            objectFit: 'contain',
            borderRadius: '8px',
            padding: '8px',
          }}
        />
      ) : (
        <Flex align="center" justify="center" vertical gap={12} style={{ height: '100%', padding: '16px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: themeMode === 'dark' ? '#262626' : '#e6f7ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <PlusOutlined
              style={{ fontSize: 20, color: themeMode === 'dark' ? '#8c8c8c' : '#1890ff' }}
            />
          </div>
          <Typography.Text type="secondary" style={{ fontSize: 13, textAlign: 'center' }}>
            {t('uploadLogo')}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 11, textAlign: 'center', opacity: 0.7 }}>
            PNG, JPG, WEBP
          </Typography.Text>
        </Flex>
      )}
    </div>
  );

  return (
    <div style={{ width: '100%' }}>
      <Flex justify="space-between" align="flex-start" style={{ width: '100%' }}>
        <Flex vertical gap={16} style={{ flex: 1 }}>
          <Flex align="center" gap={8}>
            <Typography.Title level={5} style={{ margin: 0 }}>
              {t('logo')}
            </Typography.Title>
            <Tooltip title={t('logoFormatRecommendation')}>
              <InfoCircleOutlined
                style={{
                  color: themeMode === 'dark' ? '#8c8c8c' : '#bfbfbf',
                  cursor: 'help',
                }}
              />
            </Tooltip>
          </Flex>

          <Flex vertical gap={12}>
            {logoPreview}

            {previewUrl && (
              <Flex gap={8} wrap="wrap">
                <Button
                  size="small"
                  onClick={triggerFileInput}
                  disabled={uploading || deleting}
                  type="default"
                >
                  {t('changeLogo')}
                </Button>
                <Popconfirm
                  title={t('removeLogo')}
                  description={t('logoDeleteConfirm')}
                  onConfirm={handleRemoveLogo}
                  okText={t('yes')}
                  cancelText={t('no')}
                  okButtonProps={{ loading: deleting, danger: true }}
                >
                  <Button
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    disabled={uploading || deleting}
                    loading={deleting}
                  >
                    {t('removeLogo')}
                  </Button>
                </Popconfirm>
              </Flex>
            )}

            {imageDimensions && fileSize && (
              <div
                style={{
                  padding: '8px 12px',
                  backgroundColor: themeMode === 'dark' ? '#262626' : '#f5f5f5',
                  borderRadius: '6px',
                }}
              >
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {imageDimensions.width} × {imageDimensions.height}px •{' '}
                  {(fileSize / 1024).toFixed(1)} KB
                </Typography.Text>
              </div>
            )}

            {!previewUrl && (
              <Typography.Text type="secondary" style={{ fontSize: 12, lineHeight: 1.6 }}>
                {t('logoRecommendedSize')}
              </Typography.Text>
            )}

            <Typography.Text type="secondary" style={{ fontSize: 11, lineHeight: 1.5, marginTop: 8, opacity: 0.7 }}>
              {t('logoUsage')}
            </Typography.Text>
          </Flex>
        </Flex>
      </Flex>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  );
};

export default OrganizationLogo;
