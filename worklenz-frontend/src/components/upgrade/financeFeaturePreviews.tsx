import React from 'react';
import { useTranslation } from 'react-i18next';
import FinancePreviewMockup from './mockups/FinancePreviewMockup';
import FinanceOverviewPreviewMockup from './mockups/FinanceOverviewPreviewMockup';
import FinanceExpensesPreviewMockup from './mockups/FinanceExpensesPreviewMockup';
import ProfitabilityPreviewMockup from './mockups/ProfitabilityPreviewMockup';
import BudgetsPreviewMockup from './mockups/BudgetsPreviewMockup';
import InvoicesPreviewMockup from './mockups/InvoicesPreviewMockup';
import BillableTimePreviewMockup from './mockups/BillableTimePreviewMockup';
import UtilizationPreviewMockup from './mockups/UtilizationPreviewMockup';
import ForecastsPreviewMockup from './mockups/ForecastsPreviewMockup';

export interface FinanceFeaturePreview {
  title: string;
  description: string;
  features: string[];
  mockup: React.ReactNode;
}

const NAMESPACES = ['upgrade-preview', 'finance-overview', 'finance-sidebar'];

// Content for Finance's per-page previews — shared between the rail-level
// locked state (shown to non-business users, with the "Upgrade Now" CTA) and
// the per-route "not built yet" placeholders in main-routes.tsx (shown to
// business-plan users once they're past the rail gate, with the CTA hidden
// since nothing exists to unlock for them). One source of truth per page, so
// the two contexts can't drift apart.
export const useFinanceFeaturePreviews = (): Record<string, FinanceFeaturePreview> => {
  const { t } = useTranslation(NAMESPACES);

  return {
    overview: {
      title: t('pageTitle', { ns: 'finance-overview', defaultValue: 'Finance Overview' }),
      description: t('cards.finance.overview.description', {
        ns: 'upgrade-preview',
        defaultValue: 'Budget, actual cost, and variance rolled up across all projects in one place.',
      }),
      features: t('cards.finance.overview.features', { ns: 'upgrade-preview', returnObjects: true, defaultValue: [] }) as string[],
      mockup: <FinanceOverviewPreviewMockup />,
    },
    expenses: {
      title: t('financeMockups.expenses.pageTitle', { ns: 'upgrade-preview', defaultValue: 'Expenses' }),
      description: t('cards.finance.expenses.description', {
        ns: 'upgrade-preview',
        defaultValue: "All fixed costs added to project tasks across your team, tracked in one place.",
      }),
      features: t('cards.finance.expenses.features', { ns: 'upgrade-preview', returnObjects: true, defaultValue: [] }) as string[],
      mockup: <FinanceExpensesPreviewMockup />,
    },
    profitability: {
      title: t('profitability', { ns: 'finance-sidebar', defaultValue: 'Profitability' }),
      description: t('cards.finance.profitability.description', {
        ns: 'upgrade-preview',
        defaultValue: 'See profit margins by project and team as soon as this feature ships.',
      }),
      features: t('cards.finance.profitability.features', { ns: 'upgrade-preview', returnObjects: true, defaultValue: [] }) as string[],
      mockup: <ProfitabilityPreviewMockup />,
    },
    budgets: {
      title: t('budgets', { ns: 'finance-sidebar', defaultValue: 'Budgets' }),
      description: t('cards.finance.budgets.description', {
        ns: 'upgrade-preview',
        defaultValue: 'Set budgets per project and track spend against them in real time.',
      }),
      features: t('cards.finance.budgets.features', { ns: 'upgrade-preview', returnObjects: true, defaultValue: [] }) as string[],
      mockup: <BudgetsPreviewMockup />,
    },
    invoices: {
      title: t('invoices', { ns: 'finance-sidebar', defaultValue: 'Invoices' }),
      description: t('cards.finance.invoices.description', {
        ns: 'upgrade-preview',
        defaultValue: 'Generate, send, and track client invoices without leaving Worklenz.',
      }),
      features: t('cards.finance.invoices.features', { ns: 'upgrade-preview', returnObjects: true, defaultValue: [] }) as string[],
      mockup: <InvoicesPreviewMockup />,
    },
    'billable-time': {
      title: t('billableTime', { ns: 'finance-sidebar', defaultValue: 'Billable Time' }),
      description: t('cards.finance.billableTime.description', {
        ns: 'upgrade-preview',
        defaultValue: 'Track billable vs. non-billable hours across every project and teammate.',
      }),
      features: t('cards.finance.billableTime.features', { ns: 'upgrade-preview', returnObjects: true, defaultValue: [] }) as string[],
      mockup: <BillableTimePreviewMockup />,
    },
    utilization: {
      title: t('utilization', { ns: 'finance-sidebar', defaultValue: 'Utilization' }),
      description: t('cards.finance.utilization.description', {
        ns: 'upgrade-preview',
        defaultValue: "See how fully your team's time is allocated across active projects.",
      }),
      features: t('cards.finance.utilization.features', { ns: 'upgrade-preview', returnObjects: true, defaultValue: [] }) as string[],
      mockup: <UtilizationPreviewMockup />,
    },
    forecasts: {
      title: t('forecasts', { ns: 'finance-sidebar', defaultValue: 'Forecasts' }),
      description: t('cards.finance.forecasts.description', {
        ns: 'upgrade-preview',
        defaultValue: 'Project future revenue and costs based on your active pipeline.',
      }),
      features: t('cards.finance.forecasts.features', { ns: 'upgrade-preview', returnObjects: true, defaultValue: [] }) as string[],
      mockup: <ForecastsPreviewMockup />,
    },
    generic: {
      title: t('cards.finance.generic.title', { ns: 'upgrade-preview', defaultValue: 'Finance' }),
      description: t('cards.finance.generic.description', {
        ns: 'upgrade-preview',
        defaultValue: 'Track profitability, budgets, invoices, and expenses across every project in one place.',
      }),
      features: t('cards.finance.generic.features', { ns: 'upgrade-preview', returnObjects: true, defaultValue: [] }) as string[],
      mockup: <FinancePreviewMockup />,
    },
  };
};
