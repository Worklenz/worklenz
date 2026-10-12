import { Form, FormInstance, Input, Select, Typography } from '@/shared/antd-imports';
import { TFunction } from 'i18next';

interface DeliveryConfidenceSettingsSectionProps {
  form: FormInstance;
  t: TFunction;
  disabled: boolean;
}

const DeliveryConfidenceSettingsSection = ({
  form,
  t,
  disabled,
}: DeliveryConfidenceSettingsSectionProps) => {
  return (
    <>
      <Form.Item
        name="delivery_confidence"
        label={t('deliveryConfidence', { defaultValue: 'Delivery Confidence' })}
        extra={
          <Typography.Text type="secondary" className="text-xs">
            {/* {t('deliveryConfidenceHint', {
              defaultValue:
                'A judgment set by an Admin, Owner, or Project Manager. It is not calculated. Not set never means On track.',
            })} */}
          </Typography.Text>
        }
      >
        <Select
          disabled={disabled}
          aria-label={t('deliveryConfidence', { defaultValue: 'Delivery Confidence' })}
          onChange={value => form.setFieldValue('delivery_confidence', value)}
          options={[
            { value: 'unset', label: t('deliveryConfidenceNotSet', { defaultValue: 'Not set' }) },
            { value: 'green', label: t('deliveryConfidenceOnTrack', { defaultValue: 'On track' }) },
            { value: 'amber', label: t('deliveryConfidenceAtRisk', { defaultValue: 'At risk' }) },
            { value: 'red', label: t('deliveryConfidenceOffTrack', { defaultValue: 'Off track' }) },
          ]}
        />
      </Form.Item>
      <Form.Item
        name="delivery_confidence_note"
        label={t('deliveryConfidenceNote', { defaultValue: 'Confidence note' })}
      >
        <Input.TextArea
          disabled={disabled}
          maxLength={280}
          showCount
          placeholder={t('deliveryConfidenceNotePlaceholder', { defaultValue: 'Optional note…' })}
          aria-label={t('deliveryConfidenceNote', { defaultValue: 'Confidence note' })}
        />
      </Form.Item>
    </>
  );
};

export default DeliveryConfidenceSettingsSection;
