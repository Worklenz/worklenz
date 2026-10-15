import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Flex, Form, Select, Skeleton, Typography } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useMessage } from '@/hooks/useMessage';
import { useGetTimezonesQuery, useUpdateMeMutation } from '@/store/api-v2';
import { useClientAccess } from '@/hooks/useClientAccess';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { setLanguage } from '@/store/slices/uiSlice';
import { LANGUAGE_OPTIONS } from '@/lib/client-portal/settings-constants';
import { errorMessage } from '@/components/v2';
import { sortTimezoneOptions, timezoneMatches, type TimezoneOption } from '@/utils/timezones';

interface RegionValues {
  language: string;
  timezone?: string | null;
}

/** Language and time zone, saved to the account so they follow the person across devices. */
const LanguageAndRegionSettings: React.FC = () => {
  const { t } = useTranslation();
  const message = useMessage();
  const dispatch = useAppDispatch();
  const { me, isLoading } = useClientAccess();
  const { data: timezones, isLoading: loadingTimezones } = useGetTimezonesQuery();
  const [updateMe, { isLoading: saving }] = useUpdateMeMutation();
  const [form] = Form.useForm<RegionValues>();
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (!me) return;
    form.setFieldsValue({ language: me.language, timezone: me.timezone ?? undefined });
    setIsDirty(false);
  }, [me, form]);

  const options: TimezoneOption[] = useMemo(
    () => (timezones ?? []).map(timezone => ({ value: timezone.name, label: `${timezone.name} (${timezone.abbrev})`, timezone })),
    [timezones]
  );

  if (isLoading || loadingTimezones || !me) return <Card><Skeleton active /></Card>;

  const onFinish = async (values: RegionValues) => {
    if (!isDirty) return;
    try {
      await updateMe({ language: values.language, timezone: values.timezone ?? null }).unwrap();
      // The UI language switches immediately; the layout syncs i18n from this value.
      dispatch(setLanguage(values.language));
      setIsDirty(false);
      void message.success(t('settings.region.saved', { defaultValue: 'Language and region saved.' }));
    } catch (error) {
      void message.error(errorMessage(error) ?? t('settings.saveFailed', { defaultValue: 'We could not save your changes. Please try again.' }));
    }
  };

  return (
    <Card title={t('settings.nav.languageAndRegion', { defaultValue: 'Language and Region' })}>
      <Form
        form={form}
        layout="vertical"
        style={{ maxWidth: 350 }}
        onValuesChange={(_, all) => setIsDirty(all.language !== me.language || (all.timezone ?? null) !== (me.timezone ?? null))}
        onFinish={onFinish}
      >
        <Form.Item
          name="language"
          label={t('settings.region.language', { defaultValue: 'Language' })}
          rules={[{ required: true, message: t('settings.region.languageRequired', { defaultValue: 'Choose a language' }) }]}
        >
          <Select options={[...LANGUAGE_OPTIONS]} />
        </Form.Item>
        <Form.Item name="timezone" label={t('settings.region.timeZone', { defaultValue: 'Time zone' })}>
          <Select
            showSearch
            allowClear
            placeholder={t('settings.region.browserZone', { defaultValue: "Use my browser's time zone" })}
            options={options}
            filterOption={(input, option) => timezoneMatches(input, option as TimezoneOption | undefined)}
            filterSort={(a, b, info) => sortTimezoneOptions(a as TimezoneOption, b as TimezoneOption, info.searchValue)}
            optionRender={option => (
              <Flex align="center" justify="space-between">
                <span>{(option.data as TimezoneOption).timezone.name}</span>
                <Typography.Text type="secondary">{(option.data as TimezoneOption).timezone.abbrev}</Typography.Text>
              </Flex>
            )}
          />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={saving} disabled={!isDirty}>
            {isDirty ? t('settings.saveChanges', { defaultValue: 'Save changes' }) : t('settings.saveClean', { defaultValue: 'Save' })}
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default LanguageAndRegionSettings;
