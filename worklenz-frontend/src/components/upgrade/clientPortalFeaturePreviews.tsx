import React from 'react';
import { useTranslation } from 'react-i18next';
import ClientsPreviewMockup from './mockups/ClientsPreviewMockup';
import ClientPortalRequestsPreviewMockup from './mockups/ClientPortalRequestsPreviewMockup';
import ClientPortalServicesPreviewMockup from './mockups/ClientPortalServicesPreviewMockup';
import ClientPortalChatsPreviewMockup from './mockups/ClientPortalChatsPreviewMockup';
import ClientPortalInvoicesPreviewMockup from './mockups/ClientPortalInvoicesPreviewMockup';
import ClientPortalSettingsPreviewMockup from './mockups/ClientPortalSettingsPreviewMockup';
import TicketingPreviewMockup from './mockups/TicketingPreviewMockup';

export interface ClientPortalFeaturePreview {
  title: string;
  description: string;
  features: string[];
  mockup: React.ReactNode;
}

const NAMESPACES = [
  'upgrade-preview',
  'client-portal-clients',
  'client-portal-requests',
  'client-portal-services',
  'client-portal-chats',
  'client-portal-invoices',
  'client-portal-settings',
];

// Per-tab locked-state previews for Client Portal — shared between the
// layout-level locked view (non-business users, shown with the "Upgrade Now"
// CTA) and the Ticketing route's own "not built yet" placeholder (business
// users past the gate, no CTA), so the two contexts can't drift apart. Same
// pattern as Finance's FINANCE_FEATURE_PREVIEWS in main-routes.tsx.
//
// Titles reuse each tab's own real-page namespace (kept in sync with the
// unlocked page); descriptions/feature bullets are unique paywall copy that
// lives in upgrade-preview.json.
export const useClientPortalFeaturePreviews = (): Record<string, ClientPortalFeaturePreview> => {
  const { t } = useTranslation(NAMESPACES);

  return {
    clients: {
      title: t('pageTitle', { ns: 'client-portal-clients', defaultValue: 'Clients' }),
      description: t('cards.clientPortal.clients.description', {
        ns: 'upgrade-preview',
        defaultValue: 'Give clients a branded portal to track project progress, share files, and stay in the loop.',
      }),
      features: t('cards.clientPortal.clients.features', { ns: 'upgrade-preview', returnObjects: true, defaultValue: [] }) as string[],
      mockup: <ClientsPreviewMockup />,
    },
    requests: {
      title: t('title', { ns: 'client-portal-requests', defaultValue: 'Requests' }),
      description: t('cards.clientPortal.requests.description', {
        ns: 'upgrade-preview',
        defaultValue: 'Let clients submit and track service requests without leaving their portal.',
      }),
      features: t('cards.clientPortal.requests.features', { ns: 'upgrade-preview', returnObjects: true, defaultValue: [] }) as string[],
      mockup: <ClientPortalRequestsPreviewMockup />,
    },
    services: {
      title: t('title', { ns: 'client-portal-services', defaultValue: 'Services' }),
      description: t('cards.clientPortal.services.description', {
        ns: 'upgrade-preview',
        defaultValue: 'Publish the services clients can request, and control what they can see.',
      }),
      features: t('cards.clientPortal.services.features', { ns: 'upgrade-preview', returnObjects: true, defaultValue: [] }) as string[],
      mockup: <ClientPortalServicesPreviewMockup />,
    },
    chats: {
      title: t('title', { ns: 'client-portal-chats', defaultValue: 'Messages' }),
      description: t('cards.clientPortal.chats.description', {
        ns: 'upgrade-preview',
        defaultValue: 'Message clients directly from the same portal they use for everything else.',
      }),
      features: t('cards.clientPortal.chats.features', { ns: 'upgrade-preview', returnObjects: true, defaultValue: [] }) as string[],
      mockup: <ClientPortalChatsPreviewMockup />,
    },
    invoices: {
      title: t('title', { ns: 'client-portal-invoices', defaultValue: 'Invoices' }),
      description: t('cards.clientPortal.invoices.description', {
        ns: 'upgrade-preview',
        defaultValue: 'Create, send, and track client invoices without leaving Worklenz.',
      }),
      features: t('cards.clientPortal.invoices.features', { ns: 'upgrade-preview', returnObjects: true, defaultValue: [] }) as string[],
      mockup: <ClientPortalInvoicesPreviewMockup />,
    },
    ticketing: {
      title: t('cards.clientPortal.ticketing.title', { ns: 'upgrade-preview', defaultValue: 'Ticketing' }),
      description: t('cards.clientPortal.ticketing.description', {
        ns: 'upgrade-preview',
        defaultValue: 'Let clients raise and track support tickets right from their portal.',
      }),
      features: t('cards.clientPortal.ticketing.features', { ns: 'upgrade-preview', returnObjects: true, defaultValue: [] }) as string[],
      mockup: <TicketingPreviewMockup />,
    },
    settings: {
      title: t('title', { ns: 'client-portal-settings', defaultValue: 'Portal Settings' }),
      description: t('cards.clientPortal.settings.description', {
        ns: 'upgrade-preview',
        defaultValue: 'Customize your client portal with your own branding.',
      }),
      features: t('cards.clientPortal.settings.features', { ns: 'upgrade-preview', returnObjects: true, defaultValue: [] }) as string[],
      mockup: <ClientPortalSettingsPreviewMockup />,
    },
  };
};
