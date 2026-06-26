import { Typography } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { PlanFeature } from '../components';
import { PricingData } from '../types';
import { IPricingPlans } from '@/types/admin-center/admin-center.types';
import { TEAM_SIZE_THRESHOLD } from '../constants';

export function usePlanFeatures(
  plans: IPricingPlans,
  pricingData: PricingData,
  teamSize: number,
  isAppSumoUser: boolean,
  getEffectivePricingModel: (plan: 'pro' | 'business' | 'enterprise') => string
) {
  const { t } = useTranslation(['admin-center/current-bill', 'pricing-modal']);

  const generateFreePlanFeatures = () => [
    ...(plans.projects_limit
      ? [<PlanFeature key="1" text={`${plans.projects_limit} ${t('projects', 'Projects')}`} />]
      : []),
    ...(plans.team_member_limit
      ? [<PlanFeature key="2" text={`${plans.team_member_limit} ${t('users', 'Users')}`} />]
      : []),
    <PlanFeature key="3" text={t('taskListKanban', 'Task List & Kanban Board')} />,
    <PlanFeature key="4" text={t('personalViews', 'Personal Task & Calendar Views')} />,
    <PlanFeature key="5" text={t('fileUploads', 'File Uploads & Comments')} />,
    <PlanFeature key="6" text={t('labelsFilters', 'Labels & Filters')} />,
  ];

  const generateProPlanFeatures = () => [
    <PlanFeature key="1" text={t('unlimitedProjects', 'Unlimited Projects')} />,
    <PlanFeature
      key="2"
      text={`${
        teamSize <= TEAM_SIZE_THRESHOLD && pricingData.pro_small?.pricing_model === 'per_user'
          ? t('pricing-modal:plans.pro.payPerUser', 'Pay per user (1-5 users)')
          : t('pricing-modal:plans.pro.usersIncluded', '{{count}} Users Included', {
              count: Number(pricingData.pro.users_included ?? pricingData.pro.included_users ?? 0),
            })
      }`}
    />,
    <PlanFeature
      key="3"
      text={t('pricing-modal:plans.pro.maxUsers', 'Up to {{count}} Users Max', {
        count: (() => {
          const maxStr =
            teamSize <= TEAM_SIZE_THRESHOLD && pricingData.pro_small
              ? pricingData.pro_small.max_users
              : pricingData.pro.max_users;
          return maxStr ? Number(maxStr) : undefined;
        })(),
      })}
    />,
    ...(getEffectivePricingModel('pro') === 'base_plan'
      ? [
          <PlanFeature
            key="extra-pro"
            text={t(
              'pricing-modal:plans.additionalUsersCharged',
              'Additional users beyond included: ${{price}}/user/month',
              {
                price:
                  pricingData.pro?.monthly_per_user_price ||
                  pricingData.pro?.additional_user_price ||
                  '5.99',
              }
            )}
          />,
        ]
      : []),
    <PlanFeature key="4" text={t('timeTracking', 'Time Tracking & Analytics')} />,
    <PlanFeature key="5" text={t('projectTemplates', 'Project Templates & Phases')} />,
    <PlanFeature key="6" text={t('ganttReadOnly', 'Gantt Charts (Read-only)')} />,
    <PlanFeature key="7" text={t('customFields', 'Custom Fields & Subtasks')} />,
    <PlanFeature key="8" text={t('projectInsights', 'Project Insights & Reports')} />,
  ];

  const generateBusinessPlanFeatures = () => [
    <Typography.Text
      key="header"
      strong
      style={{ display: 'block', marginBottom: 12, textAlign: 'center' }}
    >
      {t('everythingInPro', 'Everything in Pro, plus:')}
    </Typography.Text>,
    !isAppSumoUser ? (
      <PlanFeature
        key="1"
        text={`${
          teamSize <= TEAM_SIZE_THRESHOLD &&
          pricingData.business_small?.pricing_model === 'per_user'
            ? t('pricing-modal:plans.business.payPerUser', 'Pay per user (1-5 users)')
            : t('pricing-modal:plans.business.usersIncluded', '{{count}} Users Included', {
                count: Number(
                  pricingData.business.users_included ?? pricingData.business.included_users ?? 0
                ),
              })
        }`}
      />
    ) : (
      []
    ),
    <PlanFeature
      key="2"
      text={`${
        isAppSumoUser
          ? t(
              'pricing-modal:plans.business.maxUsersAppSumo',
              'Up to 100 Users Included (AppSumo Special)'
            )
          : t('pricing-modal:plans.business.maxUsers', 'Up to {{count}} Users Max', {
              count: (() => {
                const maxStr =
                  teamSize <= TEAM_SIZE_THRESHOLD && pricingData.business_small
                    ? pricingData.business_small.max_users
                    : pricingData.business.max_users;
                return maxStr ? Number(maxStr) : undefined;
              })(),
            })
      }`}
    />,
    ...(getEffectivePricingModel('business') === 'base_plan'
      ? [
          <PlanFeature
            key="extra-business"
            text={t(
              'pricing-modal:plans.additionalUsersCharged',
              'Additional users beyond included: ${{price}}/user/month',
              {
                price:
                  pricingData.business?.monthly_per_user_price ||
                  pricingData.business?.additional_user_price ||
                  '5.99',
              }
            )}
          />,
        ]
      : []),
    <PlanFeature key="3" text={t('fullGanttCharts', 'Full Gantt Charts')} />,
    <PlanFeature key="4" text={t('projectHealth', 'Project Health Monitoring')} />,
    <PlanFeature key="5" text={t('clientPortal', 'Client Portal')} />,
    <PlanFeature key="6" text={t('financeTracking', 'Finance & Billable Tracking')} />,
    <PlanFeature key="7" text={t('scheduler', 'Advanced Scheduler')} />,
  ];

  const generateEnterprisePlanFeatures = () => [
    <Typography.Text
      key="header"
      strong
      style={{ display: 'block', marginBottom: 12, textAlign: 'center' }}
    >
      {t('everythingInBusiness', 'Everything in Business, plus:')}
    </Typography.Text>,
    <PlanFeature key="1" text={`${pricingData.enterprise.users_included} Users`} />,
    <PlanFeature key="2" text={t('noExtraUserCost', 'No Extra User Cost')} />,
    <PlanFeature key="3" text={t('advancedSecurity', 'Advanced Security')} />,
    <PlanFeature key="4" text={t('customIntegrations', 'Custom Integrations')} />,
    <PlanFeature key="5" text={t('prioritySupport', 'Priority Support')} />,
  ];

  return {
    generateFreePlanFeatures,
    generateProPlanFeatures,
    generateBusinessPlanFeatures,
    generateEnterprisePlanFeatures,
  };
}
