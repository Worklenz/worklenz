import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Form,
  Input,
  Button,
  Upload,
  message,
  Card,
  Space,
  Typography,
  Divider,
} from '@/shared/antd-imports';
import { PlusOutlined, DeleteOutlined, UploadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { RcFile } from 'antd/es/upload';
import RichTextEditor from '../../../../../components/shared/RichTextEditor';

const { TextArea } = Input;
const { Title, Text } = Typography;

interface ServiceDetailsStepProps {
  setCurrent: (step: number) => void;
  service: any;
  setService: (service: any) => void;
}

const ServiceDetailsStep: React.FC<ServiceDetailsStepProps> = ({
  setCurrent,
  service,
  setService,
}) => {
  const { t, ready } = useTranslation('client-portal-services');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [placeholder, setPlaceholder] = useState('Describe your service in detail...');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update placeholder when translation is ready
  useEffect(() => {
    if (ready) {
      setPlaceholder(t('addService.serviceDetails.descriptionPlaceholder'));
    }
  }, [ready, t]);

  // Get current theme mode
  const getThemeMode = () => {
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  };

  const beforeUpload = (file: RcFile) => {
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      message.error(t('addService.serviceDetails.imageUploadError'));
      return false;
    }
    const isLt2M = file.size / 1024 / 1024 < 2;
    if (!isLt2M) {
      message.error(t('addService.serviceDetails.imageSizeError'));
      return false;
    }
    return true;
  };

  const handleImageUpload = useCallback(
    (file: RcFile) => {
      if (!beforeUpload(file)) return false;

      setUploading(true);
      const reader = new FileReader();
      reader.onload = e => {
        setImageUrl(e.target?.result as string);
        setService({
          ...service,
          service_data: {
            ...service.service_data,
            images: [e.target?.result as string],
          },
        });
        setUploading(false);
      };
      reader.readAsDataURL(file);
      return false;
    },
    [service, setService]
  );

  const removeImage = () => {
    setImageUrl('');
    setService({
      ...service,
      service_data: {
        ...service.service_data,
        images: [],
      },
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleNext = () => {
    if (!service.name || !service.service_data?.description) {
      message.error('Please fill in all required fields');
      return;
    }
    setCurrent(1);
  };

  const handleDescriptionChange = (content: string) => {
    setService({
      ...service,
      service_data: {
        ...service.service_data,
        description: content,
      },
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <Card className="shadow-sm border-gray-200 dark:border-gray-700">
          <div className="space-y-4">
            {/* Service Name and Image - Side by Side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Service Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('addService.serviceDetails.serviceName')} *
                </label>
                <Input
                  placeholder={t('addService.serviceDetails.serviceNamePlaceholder')}
                  className="h-9"
                  value={service.name || ''}
                  onChange={e => setService({ ...service, name: e.target.value })}
                />
              </div>

              {/* Service Image */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('addService.serviceDetails.serviceImage')}
                </label>
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-3 text-center hover:border-blue-400 dark:hover:border-blue-500 transition-colors">
                  {imageUrl ? (
                    <div className="relative">
                      <img
                        src={imageUrl}
                        alt="Service preview"
                        className="max-h-32 mx-auto rounded object-cover"
                      />
                      <Button
                        type="text"
                        icon={<DeleteOutlined />}
                        onClick={removeImage}
                        className="absolute top-1 right-1 bg-red-500 text-white hover:bg-red-600"
                        size="small"
                      />
                    </div>
                  ) : (
                    <div className="py-2">
                      <UploadOutlined className="text-2xl text-gray-400 mb-1" />
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {t('addService.serviceDetails.imageUploadText')}
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) handleImageUpload(file as RcFile);
                        }}
                        className="hidden"
                      />
                      <Button
                        type="dashed"
                        icon={<PlusOutlined />}
                        onClick={() => fileInputRef.current?.click()}
                        loading={uploading}
                        size="small"
                      >
                        {t('addService.serviceDetails.uploadImage')}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Service Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('addService.serviceDetails.serviceDescription')} *
              </label>
              <RichTextEditor
                value={service.service_data?.description || ''}
                onChange={handleDescriptionChange}
                placeholder={placeholder}
                themeMode={getThemeMode()}
                height={200}
              />
              <Text className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {t('addService.serviceDetails.descriptionHelp')}
              </Text>
            </div>
          </div>
        </Card>
      </div>

      {/* Navigation Buttons - Fixed at bottom */}
      <div className="flex justify-end pt-4 mt-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
        <Button type="primary" onClick={handleNext} size="middle">
          {t('addService.serviceDetails.next')}
        </Button>
      </div>
    </div>
  );
};

export default ServiceDetailsStep;
