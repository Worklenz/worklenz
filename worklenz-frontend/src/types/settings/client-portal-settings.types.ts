export type PortalTheme = 'light' | 'dark';
export type InvoiceTemplateStyle = 'classic' | 'modern';

/** The full Portal Settings payload — GET/PUT `${API_BASE_URL}/settings/client-portal`. */
export interface IClientPortalSettings {
  id?: string;
  team_id?: string;
  organization_team_id?: string;

  // Company Details
  company_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  country: string | null;
  invoice_footer_message: string | null;

  // Branding
  logo_url: string | null;
  organization_logo_url?: string | null;
  is_logo_synced?: boolean;
  primary_color: string | null;
  portal_title: string | null;
  portal_theme: PortalTheme;

  // Client Visible Selection
  visible_project_plan: boolean;
  visible_gantt_timeline: boolean;
  visible_files_documents: boolean;
  visible_invoices: boolean;
  visible_feedback_forms: boolean;
  visible_team_members: boolean;
  visible_project_updates: boolean;
  visible_chat: boolean;

  // Notifications
  notify_new_message: boolean;
  notify_task_status_change: boolean;
  notify_file_uploaded: boolean;

  // Client User Management
  poc_can_add_users: boolean;
  poc_can_remove_users: boolean;

  // Invoice Template
  invoice_template_style: InvoiceTemplateStyle;
  invoice_show_logo: boolean;

  // Legacy/unused-by-this-page fields the backend row also carries.
  welcome_message?: string | null;
  terms_of_service?: string | null;
  privacy_policy?: string | null;

  created_at?: string;
  updated_at?: string;
}

export const CLIENT_PORTAL_VISIBILITY_DEFAULTS: Pick<
  IClientPortalSettings,
  | 'visible_project_plan'
  | 'visible_gantt_timeline'
  | 'visible_files_documents'
  | 'visible_invoices'
  | 'visible_feedback_forms'
  | 'visible_team_members'
  | 'visible_project_updates'
  | 'visible_chat'
> = {
  visible_project_plan: true,
  visible_gantt_timeline: true,
  visible_files_documents: true,
  visible_invoices: false,
  visible_feedback_forms: false,
  visible_team_members: true,
  visible_project_updates: true,
  visible_chat: true,
};

export const CLIENT_PORTAL_NOTIFICATION_DEFAULTS: Pick<
  IClientPortalSettings,
  'notify_new_message' | 'notify_task_status_change' | 'notify_file_uploaded'
> = {
  notify_new_message: true,
  notify_task_status_change: true,
  notify_file_uploaded: false,
};

export const CLIENT_PORTAL_SETTINGS_DEFAULTS: IClientPortalSettings = {
  company_name: null,
  contact_email: null,
  contact_phone: null,
  address_line_1: null,
  address_line_2: null,
  city: null,
  state: null,
  zip_code: null,
  country: null,
  invoice_footer_message: null,
  logo_url: null,
  primary_color: '#1677ff',
  portal_title: null,
  portal_theme: 'light',
  ...CLIENT_PORTAL_VISIBILITY_DEFAULTS,
  ...CLIENT_PORTAL_NOTIFICATION_DEFAULTS,
  poc_can_add_users: false,
  poc_can_remove_users: false,
  invoice_template_style: 'classic',
  invoice_show_logo: true,
};

/** The 6-swatch brand color picker — arbitrary brand choices, not app theme tokens. */
export const CLIENT_PORTAL_BRAND_COLORS = [
  '#1677ff',
  '#722ed1',
  '#52c41a',
  '#faad14',
  '#ff4d4f',
  '#13c2c2',
];
