import { Typography } from '@/shared/antd-imports';
import React from 'react';
import { colors } from '../../../../../../styles/colors';
import { useTranslation } from 'react-i18next';

type ProjectDaysLeftAndOverdueCellProps = {
  daysLeft: number | null;
  isOverdue: boolean;
  isToday: boolean;
};

const ProjectDaysLeftAndOverdueCell = ({
  daysLeft,
  isOverdue,
  isToday,
}: ProjectDaysLeftAndOverdueCellProps) => {
  const { t } = useTranslation('reporting-projects');

  return (
    <>
      {daysLeft !== null ? (
        <>
          {isOverdue ? (
            <Typography.Text style={{ cursor: 'pointer', color: '#f37070' }}>
              {Math.abs(daysLeft)} {t('daysOverdueText')}
            </Typography.Text>
          ) : (
            <>
              {isToday ? (
                <Typography.Text style={{ cursor: 'pointer', color: colors.limeGreen }}>
                  {t('todayText')}
                </Typography.Text>
              ) : (
                <Typography.Text style={{ cursor: 'pointer', color: colors.limeGreen }}>
                  {daysLeft} {daysLeft === 1 ? t('dayLeftText') : t('daysLeftText')}
                </Typography.Text>
              )}
            </>
          )}
        </>
      ) : (
        <Typography.Text style={{ cursor: 'pointer' }}>-</Typography.Text>
      )}
    </>
  );
};

export default ProjectDaysLeftAndOverdueCell;
