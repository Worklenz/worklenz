import { Alert, Button, Result } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';

interface UnavailableStateProps {
  onBack: () => void;
  backLabel?: string;
}

/**
 * Shown for anything the user can no longer reach: a removed project, an approval or change request
 * they cannot see, a hidden invoice page. It never says whether the item exists.
 */
export const UnavailableState = ({ onBack, backLabel }: UnavailableStateProps) => {
  const { t } = useTranslation();
  return (
    <Result
      status="warning"
      title={t('unavailable.title', { defaultValue: "This item isn't available" })}
      subTitle={t('unavailable.body', {
        defaultValue: 'It may have been removed, or you may no longer have access to it.',
      })}
      extra={
        <Button type="primary" onClick={onBack}>
          {backLabel ?? t('unavailable.backToDashboard', { defaultValue: 'Back to overview' })}
        </Button>
      }
    />
  );
};

/** The in-page version: a deep link to a missing milestone, task, file or discussion. */
export const UnavailableBanner = ({ what }: { what: 'milestone' | 'task' | 'file' | 'discussion' }) => {
  const { t } = useTranslation();
  const labels = {
    milestone: t('unavailable.milestone', { defaultValue: 'The milestone you opened' }),
    task: t('unavailable.task', { defaultValue: 'The task you opened' }),
    file: t('unavailable.file', { defaultValue: 'The file you opened' }),
    discussion: t('unavailable.discussion', { defaultValue: 'The discussion you opened' }),
  };
  return (
    <Alert
      type="warning"
      showIcon
      style={{ marginBottom: 16 }}
      message={t('unavailable.banner', {
        what: labels[what],
        defaultValue: "{{what}} isn't available. It may have been removed or you may no longer have access to it.",
      })}
    />
  );
};
