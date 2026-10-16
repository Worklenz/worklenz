import { useTranslation } from 'react-i18next';
import { Tooltip, theme } from '@/shared/antd-imports';
import type { ChangeRequestStatus } from '@/types/client-portal/v2';
import { getChangeRequestStep } from './cr-helpers';

interface ChangeRequestStepperProps {
  status: ChangeRequestStatus;
}

/**
 * Submitted, Under review, Decision, In progress, Completed. The third step reads Approved or
 * Rejected once decided, and a rejection is drawn in the error colour.
 */
export const ChangeRequestStepper = ({ status }: ChangeRequestStepperProps) => {
  const { t } = useTranslation('client-portal-v2-change-requests');
  const { token } = theme.useToken();
  const current = getChangeRequestStep(status);

  const labels = [
    t('stepper.submitted', { defaultValue: 'Submitted' }),
    t('stepper.underReview', { defaultValue: 'Under review' }),
    status === 'rejected'
      ? t('stepper.rejected', { defaultValue: 'Rejected' })
      : status === 'approved' || current > 2
        ? t('stepper.approved', { defaultValue: 'Approved' })
        : t('stepper.decision', { defaultValue: 'Decision' }),
    t('stepper.inProgress', { defaultValue: 'In progress' }),
    t('stepper.completed', { defaultValue: 'Completed' }),
  ];

  const tips = [
    t('stepper.tips.submitted', {
      defaultValue: 'The client sent the request. Nothing is created until it is approved.',
    }),
    t('stepper.tips.underReview', {
      defaultValue:
        'Your team is reviewing the request and may ask the client for more information.',
    }),
    status === 'rejected'
      ? t('stepper.tips.rejected', {
          defaultValue: 'The request was rejected and the client received your response.',
        })
      : status === 'approved' || current > 2
        ? t('stepper.tips.approved', {
            defaultValue: 'The request was approved. Convert it to work to start delivery.',
          })
        : t('stepper.tips.decision', {
            defaultValue: 'Approve or reject the request once the review is done.',
          }),
    t('stepper.tips.inProgress', {
      defaultValue: 'The approved request is being worked on as a linked task.',
    }),
    t('stepper.tips.completed', {
      defaultValue: 'The work is done. The request is closed and can be billed.',
    }),
  ];

  return (
    <ol
      aria-label={t('stepper.label', { defaultValue: 'Progress of this change request' })}
      style={{ display: 'flex', gap: 4, margin: '4px 0 2px', padding: 0, listStyle: 'none' }}
    >
      {labels.map((label, index) => {
        const isDone = current >= 0 && index < current;
        const isCurrent = index === current;
        const isRejected = isCurrent && status === 'rejected';
        const barColor = isRejected
          ? token.colorError
          : isDone || isCurrent
            ? token.colorPrimary
            : token.colorBorder;

        return (
          <li key={index} style={{ flex: 1 }} aria-current={isCurrent ? 'step' : undefined}>
            <div
              style={{
                height: 4,
                borderRadius: 2,
                background: barColor,
                opacity: isDone ? 0.55 : 1,
              }}
            />
            <Tooltip title={tips[index]}>
              <div
                tabIndex={0}
                style={{
                  cursor: 'default',
                  fontSize: 11,
                  marginTop: 5,
                  fontWeight: isCurrent ? 700 : 500,
                  color: isRejected
                    ? token.colorError
                    : isCurrent
                      ? token.colorText
                      : token.colorTextTertiary,
                }}
              >
                {label}
              </div>
            </Tooltip>
          </li>
        );
      })}
    </ol>
  );
};
