import { Button, Flex, Space, Typography } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { TempServicesType } from '../../../../../types/client-portal/temp-client-portal.types';
import { useAppDispatch } from '../../../../../hooks/useAppDispatch';
import { addService } from '../../../../../features/clients-portal/services/services-slice';

type PreviewAndSubmitStepProps = {
  setCurrent: (index: number) => void;
  service: TempServicesType;
};

const PreviewAndSubmitStep = ({
  setCurrent,
  service,
}: PreviewAndSubmitStepProps) => {
  // localization
  const { t } = useTranslation('client-portal-services');

  const dispatch = useAppDispatch();

  // function to handle save
  const handleSave = () => {
    dispatch(addService(service));
  };

  return (
    <Flex vertical gap={12}>
      <Flex
        vertical
        gap={32}
        style={{ height: 'calc(100vh - 460px)', overflowY: 'auto' }}
      >
        <Flex vertical gap={12}>
          <Typography.Text style={{ fontSize: 18, fontWeight: 600 }}>
            {service.name}
          </Typography.Text>

          <img
            src={service?.service_data?.images?.[0] ?? ''}
            alt={service?.name ?? ''}
            style={{
              maxWidth: 400,
              maxHeight: 300,
              objectFit: 'contain',
              objectPosition: 'center',
            }}
          />

          <div>{service?.service_data?.description ?? ''}</div>
        </Flex>
      </Flex>

      <Space style={{ alignSelf: 'flex-end' }}>
        <Button onClick={() => setCurrent(1)}>{t('previousButton')}</Button>
        <Button type="primary" onClick={handleSave}>
          {t('submitButton')}
        </Button>
      </Space>
    </Flex>
  );
};

export default PreviewAndSubmitStep;
