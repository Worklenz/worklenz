import { fetchStorageInfo } from '@/features/admin-center/admin-center.slice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { SUBSCRIPTION_STATUS } from '@/shared/constants';
import { Card, Progress, Typography } from '@/shared/antd-imports';
import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

interface IAccountStorageProps {
  themeMode: string;
}

const AccountStorage = ({ themeMode }: IAccountStorageProps) => {
  const { t } = useTranslation('admin-center/current-bill');
  const dispatch = useAppDispatch();
  const [subscriptionType, setSubscriptionType] = useState<string>(SUBSCRIPTION_STATUS.TRIALING);

  const { loadingBillingInfo, billingInfo, storageInfo } = useAppSelector(
    state => state.adminCenterReducer
  );

  const formatBytes = useMemo(
    () =>
      (bytes = 0, decimals = 2) => {
        if (!+bytes) return '0 MB';

        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

        const i = Math.floor(Math.log(bytes) / Math.log(k));
        const formattedValue = parseFloat((bytes / Math.pow(k, i)).toFixed(dm));

        return `${formattedValue} ${subscriptionType !== SUBSCRIPTION_STATUS.FREE ? sizes[i] : 'MB'}`;
      },
    [subscriptionType]
  );

  useEffect(() => {
    dispatch(fetchStorageInfo());
  }, []);

  useEffect(() => {
    setSubscriptionType(billingInfo?.status ?? SUBSCRIPTION_STATUS.TRIALING);
  }, [billingInfo?.status]);

  const textColor = themeMode === 'dark' ? '#ffffffd9' : '#000000d9';

  return (
    <Card
      style={{
        height: '100%',
      }}
      loading={loadingBillingInfo}
      title={
        <span
          style={{
            color: textColor,
            fontWeight: 500,
            fontSize: '16px',
          }}
        >
          {t('accountStorage')}
        </span>
      }
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ padding: '0 16px' }}>
          <Progress
            percent={billingInfo?.used_percent ?? 0}
            type="circle"
            format={percent => <span style={{ fontSize: '13px' }}>{percent}% Used</span>}
          />
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <Typography.Text>
            {t('used')} <strong>{formatBytes(storageInfo?.used ?? 0, 1)}</strong>
          </Typography.Text>
          <Typography.Text>
            {t('remaining')} <strong>{formatBytes(storageInfo?.remaining ?? 0, 1)}</strong>
          </Typography.Text>
        </div>
      </div>
    </Card>
  );
};

export default AccountStorage;
