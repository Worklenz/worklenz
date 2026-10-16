import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import Cropper from 'react-easy-crop';
import type { Area, Point } from 'react-easy-crop';
import { Modal, Slider, Flex, Typography, Button } from '@/shared/antd-imports';

export interface LogoCropModalProps {
  open: boolean;
  imageSrc: string | null;
  aspect?: number;
  showGrid?: boolean;
  onCancel: () => void;
  onCropComplete: (croppedBase64: string) => void;
}

/**
 * Extracts the pixelCrop area from the image via an HTML canvas.
 */
export const getCroppedImg = (src: string, pixelCrop: Area): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => {
      const canvas = document.createElement('canvas');
      canvas.width = pixelCrop.width;
      canvas.height = pixelCrop.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error('Canvas context not available'));
      }
      ctx.drawImage(
        img,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
      );
      resolve(canvas.toDataURL('image/png'));
    });
    img.addEventListener('error', reject);
    img.src = src;
  });

export const LogoCropModal: React.FC<LogoCropModalProps> = ({
  open,
  imageSrc,
  aspect = 1,
  showGrid = true,
  onCancel,
  onCropComplete,
}) => {
  const { t } = useTranslation('client-portal-settings');
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [applying, setApplying] = useState(false);

  const handleCropChange = useCallback((newCrop: Point) => {
    setCrop(newCrop);
  }, []);

  const handleZoomChange = useCallback((newZoom: number) => {
    setZoom(newZoom);
  }, []);

  const handleCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleApply = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    setApplying(true);
    try {
      const base64 = await getCroppedImg(imageSrc, croppedAreaPixels);
      onCropComplete(base64);
    } catch (err) {
      console.error('Failed to crop image', err);
    } finally {
      setApplying(false);
    }
  };

  const handleCancel = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    onCancel();
  };

  return (
    <Modal
      title={t('cropLogoModalTitle', { defaultValue: 'Crop Logo' })}
      open={open}
      onCancel={handleCancel}
      width={520}
      centered
      destroyOnHidden
      footer={[
        <Button key="cancel" onClick={handleCancel} disabled={applying}>
          {t('cancelButton', { defaultValue: 'Cancel' })}
        </Button>,
        <Button key="apply" type="primary" onClick={handleApply} loading={applying}>
          {t('cropApplyButton', { defaultValue: 'Apply Crop' })}
        </Button>,
      ]}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: 320,
          background: '#1a1a1a',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        {imageSrc && (
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            showGrid={showGrid}
            onCropChange={handleCropChange}
            onZoomChange={handleZoomChange}
            onCropComplete={handleCropComplete}
          />
        )}
      </div>

      <Flex align="center" gap={12} style={{ marginTop: 14, padding: '0 4px' }}>
        <Typography.Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
          {t('cropZoomLabel', { defaultValue: 'Zoom' })}
        </Typography.Text>
        <Slider
          min={1}
          max={3}
          step={0.05}
          value={zoom}
          onChange={handleZoomChange}
          style={{ flex: 1 }}
        />
      </Flex>

      <Typography.Text
        type="secondary"
        style={{ display: 'block', textAlign: 'center', fontSize: 12, marginTop: 8 }}
      >
        {t('cropInstructionText', { defaultValue: 'Drag to reposition · Scroll or use slider to zoom' })}
      </Typography.Text>
    </Modal>
  );
};
