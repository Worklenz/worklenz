import React, { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import ReactCrop, {
  Crop,
  PixelCrop,
  centerCrop,
  makeAspectCrop,
  convertToPixelCrop,
} from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Modal, Flex, Typography, Button, Segmented } from '@/shared/antd-imports';

export type AspectMode = '1:1' | 'free';

export interface LogoCropModalProps {
  open: boolean;
  imageSrc: string | null;
  aspect?: number;
  showGrid?: boolean;
  onCancel: () => void;
  onCropComplete: (croppedBase64: string) => void;
}

const MAX_DIMENSION = 512;

function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number
): Crop {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 80,
      },
      aspect,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  );
}

/**
 * Extracts the pixelCrop area from the image via an HTML canvas.
 * Scales the output so its longest dimension is capped at 512px to keep
 * file size optimal, while preserving aspect ratio and avoiding upscaling smaller crops.
 */
export function getCroppedImg(
  image: HTMLImageElement | string,
  pixelCrop: { x: number; y: number; width: number; height: number },
  maxDimension = MAX_DIMENSION
): Promise<string> | string {
  if (typeof image !== 'string') {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas context not available');
    }

    const scaleX = (image.naturalWidth || image.width) / image.width || 1;
    const scaleY = (image.naturalHeight || image.height) / image.height || 1;

    const naturalCropX = pixelCrop.x * scaleX;
    const naturalCropY = pixelCrop.y * scaleY;
    const naturalCropWidth = pixelCrop.width * scaleX;
    const naturalCropHeight = pixelCrop.height * scaleY;

    const longestSide = Math.max(naturalCropWidth, naturalCropHeight);
    const scale = longestSide > maxDimension ? maxDimension / longestSide : 1;
    const targetWidth = Math.max(1, Math.round(naturalCropWidth * scale));
    const targetHeight = Math.max(1, Math.round(naturalCropHeight * scale));

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
      image,
      naturalCropX,
      naturalCropY,
      naturalCropWidth,
      naturalCropHeight,
      0,
      0,
      targetWidth,
      targetHeight
    );
    return canvas.toDataURL('image/png');
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => {
      try {
        const result = getCroppedImg(img, pixelCrop, maxDimension);
        resolve(result as string);
      } catch (e) {
        reject(e);
      }
    });
    img.addEventListener('error', reject);
    img.src = image;
  });
}

export const LogoCropModal: React.FC<LogoCropModalProps> = ({
  open,
  imageSrc,
  aspect = 1,
  showGrid = true,
  onCancel,
  onCropComplete,
}) => {
  const { t } = useTranslation('client-portal-settings');
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [aspectMode, setAspectMode] = useState<AspectMode>('1:1');
  const [applying, setApplying] = useState(false);

  const onImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const { width, height } = e.currentTarget;
      imgRef.current = e.currentTarget;
      if (aspectMode === '1:1') {
        const initialCrop = centerAspectCrop(width, height, aspect || 1);
        setCrop(initialCrop);
        setCompletedCrop(convertToPixelCrop(initialCrop, width, height));
      } else {
        const initialCrop: Crop = {
          unit: '%',
          x: 10,
          y: 10,
          width: 80,
          height: 80,
        };
        setCrop(initialCrop);
        setCompletedCrop(convertToPixelCrop(initialCrop, width, height));
      }
    },
    [aspect, aspectMode]
  );

  const handleAspectModeChange = (mode: AspectMode) => {
    setAspectMode(mode);
    if (!imgRef.current) return;
    const { width, height } = imgRef.current;
    if (mode === '1:1') {
      const newCrop = centerAspectCrop(width, height, aspect || 1);
      setCrop(newCrop);
      setCompletedCrop(convertToPixelCrop(newCrop, width, height));
    } else {
      if (crop) {
        setCrop({ ...crop });
      }
    }
  };

  const handleApply = async () => {
    if (!completedCrop || !imgRef.current) return;
    setApplying(true);
    try {
      const base64 = (await getCroppedImg(imgRef.current, completedCrop)) as string;
      onCropComplete(base64);
      setCrop(undefined);
      setCompletedCrop(null);
      setAspectMode('1:1');
    } catch (err) {
      console.error('Failed to crop image', err);
    } finally {
      setApplying(false);
    }
  };

  const handleCancel = () => {
    setCrop(undefined);
    setCompletedCrop(null);
    setAspectMode('1:1');
    onCancel();
  };

  return (
    <Modal
      title={t('cropLogoModalTitle', { defaultValue: 'Crop Logo' })}
      open={open}
      onCancel={handleCancel}
      width={560}
      centered
      destroyOnHidden
      footer={[
        <Button key="cancel" onClick={handleCancel} disabled={applying}>
          {t('cancelButton', { defaultValue: 'Cancel' })}
        </Button>,
        <Button
          key="apply"
          type="primary"
          onClick={handleApply}
          loading={applying}
          disabled={!completedCrop || completedCrop.width === 0 || completedCrop.height === 0}
        >
          {t('cropApplyButton', { defaultValue: 'Apply Crop' })}
        </Button>,
      ]}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          width: '100%',
          maxHeight: 380,
          background: '#141414',
          borderRadius: 8,
          overflow: 'hidden',
          padding: 8,
        }}
      >
        {imageSrc && (
          <ReactCrop
            crop={crop}
            onChange={(_, percentCrop) => setCrop(percentCrop)}
            onComplete={c => setCompletedCrop(c)}
            aspect={aspectMode === '1:1' ? (aspect ?? 1) : undefined}
            ruleOfThirds={showGrid}
            keepSelection
          >
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Crop"
              onLoad={onImageLoad}
              style={{
                maxWidth: '100%',
                maxHeight: 360,
                objectFit: 'contain',
                display: 'block',
              }}
            />
          </ReactCrop>
        )}
      </div>

      <Flex
        align="center"
        justify="space-between"
        gap={16}
        wrap="wrap"
        style={{ marginTop: 14, padding: '0 4px' }}
      >
        <Flex align="center" gap={8}>
          <Typography.Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
            {t('cropAspectLabel', { defaultValue: 'Aspect Ratio' })}:
          </Typography.Text>
          <Segmented
            size="small"
            value={aspectMode}
            onChange={val => handleAspectModeChange(val as AspectMode)}
            options={[
              { label: t('cropAspectSquare', { defaultValue: '1:1 Square' }), value: '1:1' },
              { label: t('cropAspectFree', { defaultValue: 'Free' }), value: 'free' },
            ]}
          />
        </Flex>
      </Flex>

      <Typography.Text
        type="secondary"
        style={{ display: 'block', textAlign: 'center', fontSize: 12, marginTop: 10 }}
      >
        {t('cropInstructionText', {
          defaultValue: 'Drag corners or sides to resize · Move selection to reposition',
        })}
      </Typography.Text>
    </Modal>
  );
};
