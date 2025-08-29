import { Button, Card, Flex, Form, Select, Skeleton, Typography } from '@/shared/antd-imports';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { ILanguageType, Language, setLanguage } from '@/features/i18n/localesSlice';
import {
  evt_settings_language_and_region_visit,
  evt_settings_language_changed,
} from '@/shared/worklenz-analytics-events';
import { profileSettingsApiService } from '@/api/settings/profile/profile-settings.api.service';
import { timezonesApiService } from '@/api/settings/language-timezones/language-timezones-api.service';
import { ITimezone } from '@/types/settings/timezone.types';
import logger from '@/utils/errorLogger';
import { useAuthService } from '@/hooks/useAuth';
import { authApiService } from '@/api/auth/auth.api.service';
import { setSession } from '@/utils/session-helper';
import { setUser } from '@/features/user/userSlice';

const LanguageAndRegionSettings = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('settings/language');
  const { trackMixpanelEvent } = useMixpanelTracking();
  const { lng } = useAppSelector(state => state.localesReducer);
  const [timezones, setTimezones] = useState<ITimezone[]>([]);
  const [loadingTimezones, setLoadingTimezones] = useState(false);
  const currentSession = useAuthService().getCurrentSession();

  useDocumentTitle('Language & Region');

  useEffect(() => {
    trackMixpanelEvent(evt_settings_language_and_region_visit);
  }, [trackMixpanelEvent]);

  const languageOptions: { value: ILanguageType; label: string }[] = [
    {
      value: Language.EN,
      label: 'English',
    },
    {
      value: Language.ES,
      label: 'Español',
    },
    {
      value: Language.PT,
      label: 'Português',
    },
    {
      value: Language.ALB,
      label: 'Shqip',
    },
    {
      value: Language.DE,
      label: 'Deutsch',
    },
    {
      value: Language.ZH,
      label: '简体中文',
    },
  ];

  const handleLanguageChange = async (values: { language?: ILanguageType; timezone?: string }) => {
    if (!values.language) return;
    dispatch(setLanguage(values.language));
    const res = await timezonesApiService.update(values);
    if (res.done) {
      const authorizeResponse = await authApiService.verify();
      if (authorizeResponse.authenticated) {
        setSession(authorizeResponse.user);
        dispatch(setUser(authorizeResponse.user));
      }
    }
  };

  const onFinish = (values: { language?: ILanguageType; timezone?: string }) => {
    if (values.language && values.timezone) {
      handleLanguageChange(values);
      trackMixpanelEvent(evt_settings_language_changed, { language: values.language });
    }
  };

  const fetchTimezones = async () => {
    try {
      setLoadingTimezones(true);
      const res = await timezonesApiService.get();
      if (res.done) {
        setTimezones(res.body);
      }
    } catch (error) {
      logger.error('Error fetching timezones', error);
    } finally {
      setLoadingTimezones(false);
    }
  };

  const timeZoneOptions = timezones.map(timezone => ({
    value: timezone.id,
    label: (
      <Flex align="center" justify="space-between">
        <span>{timezone.name}</span>
        <Typography.Text type="secondary">{timezone.abbrev}</Typography.Text>
      </Flex>
    ),
  }));

  useEffect(() => {
    fetchTimezones();
  }, []);

  return (
    <Card style={{ width: '100%' }}>
      {!loadingTimezones ? (
        <Form
          layout="vertical"
          style={{ width: '100%', maxWidth: 350 }}
          initialValues={{
            language: lng || Language.EN,
            timezone: currentSession?.timezone,
          }}
          onFinish={onFinish}
        >
          <Form.Item
            name="language"
            label={t('language')}
            rules={[
              {
                required: true,
                message: t('language_required'),
              },
            ]}
          >
            <Select options={languageOptions} />
          </Form.Item>
          <Form.Item
            name="timezone"
            label={t('time_zone')}
            rules={[
              {
                required: true,
                message: t('time_zone_required'),
              },
            ]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              options={timeZoneOptions}
              loading={loadingTimezones}
            />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">
              {t('save_changes')}
            </Button>
          </Form.Item>
        </Form>
      ) : (
        <Skeleton />
      )}
    </Card>
  );
};

export default LanguageAndRegionSettings;
