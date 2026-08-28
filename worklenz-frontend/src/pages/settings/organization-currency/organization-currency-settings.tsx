import { useEffect, useState, useCallback } from 'react';
import {
  Button,
  Card,
  Flex,
  Select,
  Spin,
  Tooltip,
  Typography,
  message,
} from '@/shared/antd-imports';
import { ReloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { fetchOrgConfig, updateOrgConfig } from '@/features/org-config/org-config.slice';
import { useAuthService } from '@/hooks/useAuth';
import { CURRENCY_OPTIONS } from '@/shared/currencies';
import { currencyRatesApiService, ICurrencyRatesResponse } from '@/api/settings/currency-rates/currency-rates.api.service';

const { Text, Title } = Typography;

const OrganizationCurrencySettings = () => {
  const dispatch = useAppDispatch();
  const auth = useAuthService();
  const { t } = useTranslation('settings/organization-currency-settings');
  const isOwnerOrAdmin = auth.isOwnerOrAdmin();

  const orgConfig = useAppSelector(state => state.orgConfigReducer);

  const [selectedCurrency, setSelectedCurrency] = useState<string>('USD');
  const [saving, setSaving] = useState(false);
  const [ratesData, setRatesData] = useState<ICurrencyRatesResponse | null>(null);
  const [ratesLoading, setRatesLoading] = useState(false);

  const savedCurrency = orgConfig.base_currency || 'USD';
  const hasUnsavedChanges = selectedCurrency !== savedCurrency;

  useEffect(() => {
    void dispatch(fetchOrgConfig());
  }, [dispatch]);

  useEffect(() => {
    setSelectedCurrency(orgConfig.base_currency || 'USD');
  }, [orgConfig.base_currency]);

  const fetchRates = useCallback(async (base: string) => {
    setRatesLoading(true);
    try {
      const res = await currencyRatesApiService.getRates(base);
      if (res.done && res.body) {
        setRatesData(res.body);
      }
    } catch {
      // non-critical — rates card will remain empty
    } finally {
      setRatesLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRates(selectedCurrency);
  }, [selectedCurrency, fetchRates]);

  const handleSave = async () => {
    if (!hasUnsavedChanges) return;
    setSaving(true);
    try {
      await dispatch(updateOrgConfig({ base_currency: selectedCurrency })).unwrap();
      message.success(t('successMessage', { currency: selectedCurrency }));
    } catch (err: any) {
      message.error(err?.message || t('errorMessage'));
    } finally {
      setSaving(false);
    }
  };

  const formatRate = (rate: number): string => {
    if (rate >= 1000) return rate.toLocaleString('en-US', { maximumFractionDigits: 0 });
    if (rate >= 1)    return rate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    return rate.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
  };

  // All currencies from CURRENCY_OPTIONS except the currently selected base
  const previewRates = ratesData
    ? CURRENCY_OPTIONS
        .map(opt => opt.value.toUpperCase())
        .filter(c => c !== ratesData.base.toUpperCase() && ratesData.rates[c] !== undefined)
        .map(c => ({ code: c, rate: ratesData.rates[c] }))
    : [];

  const currencySelectOptions = CURRENCY_OPTIONS.map(opt => {
    const displayName = opt.label.replace(/^[A-Za-z]{3}\s*-\s*/,'');
    return {
      value: opt.value.toUpperCase(),
      label: `${opt.value.toUpperCase()} - ${displayName || opt.label}`,
    };
  });

  const ratesTimestamp = ratesData
    ? t('ratesUpdated', { time: new Date(ratesData.fetched_at).toLocaleTimeString() })
    : null;

  return (
    <Flex vertical gap={24}>
      {/* Page header */}
      <div>
        <Title level={4} style={{ margin: 0 }}>
          {t('pageTitle')}
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          {t('pageSubtitle')}
        </Text>
      </div>

      {/* Base Currency selector */}
      <Card>
        <Flex vertical gap={16}>
          <Flex gap={12} align="center" wrap="wrap">
            <Select
              showSearch
              style={{ width: 300 }}
              value={selectedCurrency}
              onChange={val => setSelectedCurrency(val)}
              disabled={!isOwnerOrAdmin || orgConfig.isLoading}
              optionFilterProp="label"
              options={currencySelectOptions}
              aria-label={t('selectAriaLabel')}
            />
            <Button
              type="primary"
              loading={saving}
              disabled={!isOwnerOrAdmin || orgConfig.isLoading}
              onClick={handleSave}
            >
              {hasUnsavedChanges ? t('saveChanges') : t('save')}
            </Button>
          </Flex>

          {!isOwnerOrAdmin && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('adminOnly')}
            </Text>
          )}
        </Flex>
      </Card>

      {/* Live exchange rates */}
      <Card
        title={
          <Flex align="center" justify="space-between">
            <Text strong>
              {t('ratesCardTitle', { currency: selectedCurrency })}
            </Text>
            <Flex align="center" gap={8}>
              {ratesTimestamp && (
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {ratesTimestamp}
                </Text>
              )}
              <Tooltip title={t('refreshRatesTooltip')}>
                <Button
                  size="small"
                  type="text"
                  icon={<ReloadOutlined />}
                  loading={ratesLoading}
                  onClick={() => void fetchRates(selectedCurrency)}
                  aria-label={t('refreshRatesAriaLabel')}
                />
              </Tooltip>
            </Flex>
          </Flex>
        }
        size="small"
      >
        {ratesLoading && !ratesData ? (
          <Flex justify="center" style={{ padding: 24 }}>
            <Spin />
          </Flex>
        ) : previewRates.length > 0 ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: 10,
            }}
          >
            {previewRates.map(({ code, rate }) => (
              <Flex
                key={code}
                justify="space-between"
                align="center"
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  background: 'rgba(0,0,0,0.03)',
                  border: '1px solid rgba(0,0,0,0.06)',
                }}
              >
                <Text strong style={{ fontSize: 13 }}>{code}</Text>
                <Text style={{ fontSize: 13, color: '#1890ff' }}>{formatRate(rate)}</Text>
              </Flex>
            ))}
          </div>
        ) : (
          <Text type="secondary">{t('noRateData')}</Text>
        )}
      </Card>
    </Flex>
  );
};

export default OrganizationCurrencySettings;
