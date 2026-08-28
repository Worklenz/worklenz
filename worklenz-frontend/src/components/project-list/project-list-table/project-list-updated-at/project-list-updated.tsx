import { useTranslation } from 'react-i18next';
import { IProjectViewModel } from '@/types/project/projectViewModel.types';
import { calculateTimeDifference } from '@/utils/calculate-time-difference';
import { formatDateTimeWithLocale } from '@/utils/format-date-time-with-locale';
import { Tooltip } from '@/shared/antd-imports';

export const ProjectListUpdatedAt: React.FC<{ record: IProjectViewModel }> = ({ record }) => {
  const { t } = useTranslation('common');
  return (
    <Tooltip title={record.updated_at ? formatDateTimeWithLocale(record.updated_at) : ''}>
      {record.updated_at
        ? calculateTimeDifference(record.updated_at, t('justNow', { defaultValue: 'Just now' }))
        : ''}
    </Tooltip>
  );
};
