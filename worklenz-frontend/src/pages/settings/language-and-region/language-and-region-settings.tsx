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
  const [form] = Form.useForm();
  const [timezones, setTimezones] = useState<ITimezone[]>([]);
  const [loadingTimezones, setLoadingTimezones] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const currentSession = useAuthService().getCurrentSession();

  useEffect(() => {
    form.setFieldsValue({
      language: lng || Language.EN,
      timezone: currentSession?.timezone,
    });
  }, [form, lng, currentSession?.timezone]);

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
      setIsDirty(false);
    }
  };

  const onFinish = (values: { language?: ILanguageType; timezone?: string }) => {
    if (values.language && values.timezone && isDirty) {
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

  // Create searchable options with plain text labels
  const timeZoneOptions = timezones.map(timezone => ({
    value: timezone.id,
    label: `${timezone.name} (${timezone.abbrev})`,
    timezone: timezone,
  }));

  // Custom filter function to prioritize results that start with search term
  const filterTimezoneOption = (input: string, option: any) => {
    if (!input) return true;

    const searchTerm = input.toLowerCase();
    const timezoneName = option.timezone?.name?.toLowerCase() || '';
    const timezoneAbbrev = option.timezone?.abbrev?.toLowerCase() || '';

    // Check if timezone name or abbreviation contains the search term
    return timezoneName.includes(searchTerm) || timezoneAbbrev.includes(searchTerm);
  };

  // Sort function to prioritize results that start with search term
  const sortTimezoneOptions = (
    optionA: any,
    optionB: any,
    info: { searchValue: string }
  ): number => {
    if (!info.searchValue) return 0;

    const searchTerm = info.searchValue.toLowerCase();
    const nameA = optionA.timezone?.name?.toLowerCase() || '';
    const nameB = optionB.timezone?.name?.toLowerCase() || '';

    // Split by slash to get parts
    const partsA = nameA.split('/');
    const partsB = nameB.split('/');

    // Check if first part starts with search term (highest priority)
    // e.g., "Australia/Sydney" -> first part is "australia"
    const aFirstPartStarts = partsA[0]?.startsWith(searchTerm);
    const bFirstPartStarts = partsB[0]?.startsWith(searchTerm);

    if (aFirstPartStarts && !bFirstPartStarts) return -1;
    if (!aFirstPartStarts && bFirstPartStarts) return 1;

    // Check if any part starts with search term (medium priority)
    const aAnyPartStarts = partsA.some((part: string) => part.startsWith(searchTerm));
    const bAnyPartStarts = partsB.some((part: string) => part.startsWith(searchTerm));

    if (aAnyPartStarts && !bAnyPartStarts) return -1;
    if (!aAnyPartStarts && bAnyPartStarts) return 1;

    // Prefer shorter paths (less slashes) - "Australia/Sydney" over "posix/Australia/Sydney"
    const aDepth = partsA.length;
    const bDepth = partsB.length;

    if (aDepth !== bDepth) return aDepth - bDepth;

    // Finally sort alphabetically
    return nameA.localeCompare(nameB);
  };

  // Handle search to reset scroll position
  const handleTimezoneSearch = (value: string) => {
    // Small delay to ensure dropdown is rendered before scrolling
    setTimeout(() => {
      const dropdown = document.querySelector('.ant-select-dropdown');
      if (dropdown) {
        const scrollContainer = dropdown.querySelector('.rc-virtual-list-holder');
        if (scrollContainer) {
          scrollContainer.scrollTop = 0;
        }
      }
    }, 0);
  };

  useEffect(() => {
    fetchTimezones();
  }, []);

  return (
    <Card style={{ width: '100%' }}>
      {!loadingTimezones ? (
        <Form
          form={form}
          layout="vertical"
          style={{ width: '100%', maxWidth: 350 }}
          initialValues={{
            language: lng || Language.EN,
            timezone: currentSession?.timezone,
          }}
          onValuesChange={(_, allValues) => {
            const langChanged = allValues.language !== (lng || Language.EN);
            const tzChanged = allValues.timezone !== currentSession?.timezone;
            setIsDirty(langChanged || tzChanged);
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
              filterOption={filterTimezoneOption}
              filterSort={sortTimezoneOptions}
              onSearch={handleTimezoneSearch}
              loading={loadingTimezones}
              options={timeZoneOptions}
              optionRender={option => (
                <Flex align="center" justify="space-between">
                  <span>{option.data.timezone?.name}</span>
                  <Typography.Text type="secondary">{option.data.timezone?.abbrev}</Typography.Text>
                </Flex>
              )}
            />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">
              {isDirty ? t('save_changes') : t('save')}
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
