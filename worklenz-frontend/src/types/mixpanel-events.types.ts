// Mixpanel Event Types for Billing and Upgrade Flow

export type UserType = 'free' | 'trial' | 'paid' | 'appsumo';
export type BillingFrequency = 'monthly' | 'annual';
export type PricingModel = 'per_user' | 'base_plan';
export type PlanType = 'free' | 'pro' | 'business' | 'enterprise';
export type DeviceType = 'web' | 'mobile' | 'tablet';
export type ButtonLocation = 'header' | 'footer' | 'modal' | 'sidebar' | 'inline';
export type FileType = 'doc' | 'pdf' | 'img' | 'video' | 'audio' | 'other';
export type ThemeMode = 'light' | 'dark';
export type CustomFieldType = 'text' | 'number' | 'date' | 'dropdown' | 'checkbox' | 'url';
export type FilterType = 'status' | 'priority' | 'assignee' | 'label' | 'date' | 'custom';
export type SortOrder = 'asc' | 'desc';

// Common properties across billing events
export interface BaseBillingEventProps {
  user_type: UserType;
  current_plan?: string;
  current_plan_type?: PlanType;
  trial_days_remaining?: number;
  is_appsumo_user?: boolean;
  team_size?: number;
  subscription_status?: string;
}

// Upgrade button events
export interface UpgradeButtonEventProps extends BaseBillingEventProps {
  source_location: string;
  badge_state?: 'trial_expiring' | 'last_day' | 'appsumo' | null;
  button_style?: 'default' | 'warning' | 'urgent' | 'appsumo';
}

// Plan selection events
export interface PlanSelectionEventProps extends BaseBillingEventProps {
  selected_plan: PlanType;
  previous_plan?: PlanType;
  billing_frequency: BillingFrequency;
  selected_team_size: number;
  pricing_model: PricingModel;
  calculated_monthly_price: number;
  calculated_annual_price?: number;
  discount_applied: boolean;
  discount_percentage?: number;
  is_small_team?: boolean;
}

// Team size change events
export interface TeamSizeChangeEventProps extends BaseBillingEventProps {
  old_team_size: number;
  new_team_size: number;
  selected_plan: PlanType;
  pricing_model: PricingModel;
  price_difference?: number;
}

// Billing frequency change events
export interface BillingFrequencyChangeEventProps extends BaseBillingEventProps {
  old_frequency: BillingFrequency;
  new_frequency: BillingFrequency;
  selected_plan: PlanType;
  annual_savings?: number;
  team_size: number;
}

// Checkout events
export interface CheckoutEventProps extends BaseBillingEventProps {
  plan_id: string;
  plan_type: PlanType;
  billing_frequency: BillingFrequency;
  team_size: number;
  checkout_amount: number;
  pricing_model: PricingModel;
  discount_applied: boolean;
  discount_percentage?: number;
  payment_method?: string;
}

// Checkout result events
export interface CheckoutResultEventProps extends CheckoutEventProps {
  success: boolean;
  error_message?: string;
  error_code?: string;
  time_to_complete?: number; // in seconds
}

// Billing page events
export interface BillingPageEventProps extends BaseBillingEventProps {
  entry_point?: string;
  storage_usage_percentage?: number;
  has_invoices?: boolean;
  has_charges?: boolean;
}

// AppSumo specific events
export interface AppSumoEventProps extends BaseBillingEventProps {
  promo_active: boolean;
  promo_days_remaining?: number;
  viewed_plan?: PlanType;
  discount_percentage: number;
}

// Modal events
export interface PricingModalEventProps extends BaseBillingEventProps {
  trigger_source: string;
  initial_plan_shown?: PlanType;
  initial_billing_frequency?: BillingFrequency;
  initial_team_size?: number;
}

// Business Plan Trial events
export interface BusinessTrialEventProps extends BaseBillingEventProps {
  trial_type: 'business_plan';
  trial_duration_days: number;
  source_component?: string;
  display_location?: string;
}

export interface BusinessTrialStartEventProps extends BusinessTrialEventProps {
  start_method: 'banner_click' | 'upgrade_button' | 'manual_request';
  original_plan?: PlanType;
}

export interface BusinessTrialStatusEventProps extends BusinessTrialEventProps {
  trial_active: boolean;
  days_elapsed?: number;
  check_source?: string;
}

export interface BusinessTrialConversionEventProps extends BusinessTrialEventProps {
  conversion_successful: boolean;
  final_plan_selected?: PlanType;
  billing_frequency?: BillingFrequency;
  team_size?: number;
  total_amount?: number;
  error_message?: string;
}

// AppSumo upsell funnel events (fires only when current_plan = appsumo)
export enum AppSumoUpsellEvents {
  // Global upgrade funnel — fires at all 14 touchpoints
  UPGRADE_PROMPT_SHOWN = 'appsumo_upgrade_prompt_shown',
  UPGRADE_PROMPT_DISMISSED = 'appsumo_upgrade_prompt_dismissed',
  UPGRADE_NOW_CLICKED = 'appsumo_upgrade_now_clicked',
  UPGRADE_MODAL_VIEWED = 'appsumo_upgrade_modal_viewed',
  UPGRADE_MODAL_DISMISSED = 'appsumo_upgrade_modal_dismissed',
  UPGRADE_PLAN_SELECTED = 'appsumo_upgrade_plan_selected',
  TALK_TO_SALES_CLICKED = 'appsumo_upgrade_talk_to_sales_clicked',
  // Seat limit
  SEAT_LIMIT_MODAL_SHOWN = 'appsumo_seat_limit_blocking_modal_shown',
  SEAT_LIMIT_DEACTIVATE_CHOSEN = 'appsumo_seat_limit_deactivate_path_chosen',
  SEAT_LIMIT_INVITE_CANCELLED = 'appsumo_seat_limit_invite_cancelled',
  SEAT_LIMIT_ADD_MORE_CLICKED = 'appsumo_seat_limit_add_more_clicked',
  // Feature gates
  CUSTOM_FIELD_LIMIT_HIT = 'appsumo_custom_field_limit_hit',
  CLIENT_PORTAL_GATED_CLICK = 'appsumo_client_portal_gated_click',
  PROJECT_FINANCE_GATED_CLICK = 'appsumo_project_finance_gated_click',
  ORG_LOGO_GATED_CLICK = 'appsumo_org_logo_change_gated_click',
  // File & storage
  STORAGE_ADD_MORE_CLICKED = 'appsumo_storage_add_more_clicked',
  OVERSIZED_FILE_BLOCKED = 'appsumo_oversized_file_blocked',
  TASK_ATTACHMENT_UPGRADE_CLICKED = 'appsumo_task_attachment_upgrade_link_clicked',
  COMMENT_ATTACHMENT_REPLACED = 'appsumo_comment_attachment_file_replaced',
  // History locks
  LOCKED_HISTORY_VIEW_CLICKED = 'appsumo_locked_history_view_clicked',
}

export interface AppSumoUpsellEventProps {
  user_id?: string;
  workspace_id?: string;
  current_plan?: string;
  appsumo_codes_redeemed?: number;
  appsumo_seat_limit?: number;
  feature?: string;
  [key: string]: unknown;
}

// Event names enum for consistency
export enum MixpanelBillingEvents {
  // Upgrade button events
  UPGRADE_BUTTON_CLICKED = 'upgrade_button_clicked',
  UPGRADE_BUTTON_VIEWED = 'upgrade_button_viewed',

  // Pricing modal events
  PRICING_MODAL_OPENED = 'pricing_modal_opened',
  PRICING_MODAL_CLOSED = 'pricing_modal_closed',

  // Plan selection events
  PLAN_SELECTED = 'plan_selected',
  PLAN_COMPARED = 'plan_compared',

  // Configuration events
  BILLING_FREQUENCY_CHANGED = 'billing_frequency_changed',
  TEAM_SIZE_CHANGED = 'team_size_changed',

  // Checkout events
  CHECKOUT_INITIATED = 'checkout_initiated',
  CHECKOUT_COMPLETED = 'checkout_completed',
  CHECKOUT_FAILED = 'checkout_failed',
  CHECKOUT_ABANDONED = 'checkout_abandoned',

  // Free plan events
  FREE_PLAN_SELECTED = 'free_plan_selected',
  FREE_PLAN_SWITCH_COMPLETED = 'free_plan_switch_completed',

  // Billing page events
  BILLING_PAGE_VIEWED = 'billing_page_viewed',
  CURRENT_PLAN_VIEWED = 'current_plan_viewed',
  STORAGE_USAGE_VIEWED = 'storage_usage_viewed',
  INVOICES_VIEWED = 'invoices_viewed',
  CHARGES_VIEWED = 'charges_viewed',

  // AppSumo events
  APPSUMO_DISCOUNT_VIEWED = 'appsumo_discount_viewed',
  APPSUMO_UPGRADE_INITIATED = 'appsumo_upgrade_initiated',
  APPSUMO_PLAN_SELECTED = 'appsumo_plan_selected',

  // Business Plan Trial events
  BUSINESS_TRIAL_ELIGIBLE = 'business_trial_eligible',
  BUSINESS_TRIAL_OFFER_VIEWED = 'business_trial_offer_viewed',
  BUSINESS_TRIAL_BANNER_CLICKED = 'business_trial_banner_clicked',
  BUSINESS_TRIAL_STARTED = 'business_trial_started',
  BUSINESS_TRIAL_STATUS_CHECKED = 'business_trial_status_checked',
  BUSINESS_TRIAL_UPGRADE_INITIATED = 'business_trial_upgrade_initiated',
  BUSINESS_TRIAL_CONVERTED = 'business_trial_converted',
  BUSINESS_TRIAL_EXPIRED = 'business_trial_expired',
  BUSINESS_TRIAL_DISMISSED = 'business_trial_dismissed',

  // Error events
  PADDLE_LOAD_ERROR = 'paddle_load_error',
  PRICING_FETCH_ERROR = 'pricing_fetch_error',
}

// General Mixpanel Events Enum
export enum MixpanelEvents {
  // Authentication
  LOGIN_WITH_EMAIL_CLICKED = 'login_with_email_click',
  LOGIN_WITH_GOOGLE_CLICKED = 'login_with_google_click',
  SIGNUP_WITH_EMAIL_CLICKED = 'signup_with_email_click',
  SIGNUP_WITH_GOOGLE_CLICKED = 'signup_with_google_click',
  ACCOUNT_SETUP_COMPLETED = 'account_setup_complete',

  // Project Management
  PROJECT_CREATED = 'projects_create',
  PROJECT_TASK_CREATED = 'project_task_create',
  PROJECT_BOARD_VISITED = 'project_board_visit',
  PROJECT_TASK_LIST_VISITED = 'project_task_list_visit',
  PROJECT_ROADMAP_VISITED = 'project_roadmap_visit',
  PROJECT_MEMBERS_VISITED = 'project_members_visit',
  PROJECT_INSIGHTS_VIEWED = 'project_insights_overview_visit',

  // Team Management
  TEAMMATE_INVITED = 'project_invite_members',

  // File Management
  FILE_UPLOADED = 'file_uploaded',

  // Timer
  TIMER_STARTED = 'timer_started',

  // Client Portal
  CLIENT_PORTAL_VIEWED = 'client_portal_viewed',
  CLIENT_PORTAL_PAGE_VISITED = 'client_portal_page_visited',
  CLIENT_PORTAL_NAVIGATION = 'client_portal_navigation',

  // Client Portal - Clients
  CLIENT_PORTAL_CLIENT_CREATED = 'client_portal_client_created',
  CLIENT_PORTAL_CLIENT_EDITED = 'client_portal_client_edited',
  CLIENT_PORTAL_CLIENT_DELETED = 'client_portal_client_deleted',
  CLIENT_PORTAL_CLIENT_VIEWED = 'client_portal_client_viewed',
  CLIENT_PORTAL_CLIENT_LINK_COPIED = 'client_portal_client_link_copied',

  // Client Portal - Services
  CLIENT_PORTAL_SERVICE_CREATED = 'client_portal_service_created',
  CLIENT_PORTAL_SERVICE_EDITED = 'client_portal_service_edited',
  CLIENT_PORTAL_SERVICE_DELETED = 'client_portal_service_deleted',
  CLIENT_PORTAL_SERVICE_VIEWED = 'client_portal_service_viewed',
  CLIENT_PORTAL_SERVICE_FORM_STEP = 'client_portal_service_form_step',

  // Client Portal - Requests
  CLIENT_PORTAL_REQUEST_CREATED = 'client_portal_request_created',
  CLIENT_PORTAL_REQUEST_VIEWED = 'client_portal_request_viewed',
  CLIENT_PORTAL_REQUEST_STATUS_CHANGED = 'client_portal_request_status_changed',
  CLIENT_PORTAL_REQUEST_FILTERED = 'client_portal_request_filtered',

  // Client Portal - Chats
  CLIENT_PORTAL_CHAT_STARTED = 'client_portal_chat_started',
  CLIENT_PORTAL_CHAT_MESSAGE_SENT = 'client_portal_chat_message_sent',
  CLIENT_PORTAL_CHAT_VIEWED = 'client_portal_chat_viewed',
  CLIENT_PORTAL_CHAT_REFRESHED = 'client_portal_chat_refreshed',

  // Client Portal - Invoices
  CLIENT_PORTAL_INVOICE_CREATED = 'client_portal_invoice_created',
  CLIENT_PORTAL_INVOICE_VIEWED = 'client_portal_invoice_viewed',
  CLIENT_PORTAL_INVOICE_EDITED = 'client_portal_invoice_edited',
  CLIENT_PORTAL_INVOICE_DELETED = 'client_portal_invoice_deleted',
  CLIENT_PORTAL_INVOICE_FILTERED = 'client_portal_invoice_filtered',

  // Client Portal - Settings
  CLIENT_PORTAL_SETTINGS_VIEWED = 'client_portal_settings_viewed',
  CLIENT_PORTAL_LOGO_UPLOADED = 'client_portal_logo_uploaded',
  CLIENT_PORTAL_LOGO_REMOVED = 'client_portal_logo_removed',
  CLIENT_PORTAL_SETTINGS_SAVED = 'client_portal_settings_saved',

  // Theme
  DARK_MODE_TOGGLED = 'dark_mode_toggled',

  // Custom Fields
  CUSTOM_FIELD_ENABLED = 'custom_field_enabled',

  // Filter & Sort
  FILTER_SORT_APPLIED = 'project_task_list_search_task',
}

// Authentication Events
export interface LoginEventProps {
  device_type: DeviceType;
  button_location?: ButtonLocation;
  signup_method?: 'email' | 'google';
}

export interface SignupEventProps {
  device_type: DeviceType;
  button_location: ButtonLocation;
  signup_method: 'email' | 'google';
  plan_type?: PlanType;
}

// Project Events
export interface ProjectEventProps {
  project_id: string;
  project_template_used?: boolean;
}

export interface TaskEventProps {
  task_id: string;
  project_id: string;
  from_template?: boolean;
}

// File Events
export interface FileUploadEventProps {
  file_type: FileType;
  project_id?: string;
}

// Timer Events
export interface TimerEventProps {
  task_id: string;
  project_id: string;
}

// Theme Events
export interface ThemeEventProps {
  mode: ThemeMode;
}

// Custom Field Events
export interface CustomFieldEventProps {
  field_type: CustomFieldType;
  project_id?: string;
}

// Filter & Sort Events
export interface FilterSortEventProps {
  filter_type: FilterType;
  sort_order: SortOrder;
  project_id?: string;
}

// Team Invite Events
export interface TeamInviteEventProps {
  count: number;
  project_id?: string;
}

// Client Portal Events
export interface ClientPortalEventProps {
  page?: string;
  section?: string;
  source?: string;
  total_items?: number;
  filter_applied?: boolean;
}

export interface ClientPortalNavigationEventProps extends ClientPortalEventProps {
  from_page?: string;
  to_page: string;
  navigation_method?: 'sidebar' | 'link' | 'breadcrumb';
}

export interface ClientPortalActionEventProps extends ClientPortalEventProps {
  action_type: 'create' | 'edit' | 'delete' | 'view' | 'copy' | 'filter' | 'refresh';
  item_id?: string;
  item_type?: 'client' | 'service' | 'request' | 'chat' | 'invoice' | 'settings';
  success?: boolean;
  error_message?: string;
}

export interface ClientPortalServiceFormEventProps extends ClientPortalEventProps {
  step: number;
  total_steps: number;
  step_name?: string;
  form_valid?: boolean;
  completion_time?: number;
}

export interface ClientPortalChatEventProps extends ClientPortalEventProps {
  chat_id?: string;
  message_length?: number;
  attachment_count?: number;
  participant_count?: number;
}

// Helper function to get base properties
export function getBaseBillingProperties(
  userType: UserType,
  currentPlan?: string,
  trialDaysRemaining?: number,
  isAppSumoUser?: boolean,
  teamSize?: number,
  subscriptionStatus?: string
): BaseBillingEventProps {
  return {
    user_type: userType,
    current_plan: currentPlan,
    trial_days_remaining: trialDaysRemaining,
    is_appsumo_user: isAppSumoUser,
    team_size: teamSize,
    subscription_status: subscriptionStatus,
  };
}

// Helper function to detect device type
export function getDeviceType(): DeviceType {
  if (typeof window === 'undefined') return 'web';

  const userAgent = window.navigator.userAgent.toLowerCase();
  if (/mobile|android|iphone|ipad|tablet/.test(userAgent)) {
    return /tablet|ipad/.test(userAgent) ? 'tablet' : 'mobile';
  }
  return 'web';
}

// Helper function to get file type from filename
export function getFileType(filename: string): FileType {
  const extension = filename.split('.').pop()?.toLowerCase();

  if (!extension) return 'other';

  const docTypes = ['doc', 'docx', 'txt', 'rtf', 'odt'];
  const pdfTypes = ['pdf'];
  const imgTypes = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'];
  const videoTypes = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'];
  const audioTypes = ['mp3', 'wav', 'flac', 'aac', 'ogg'];

  if (docTypes.includes(extension)) return 'doc';
  if (pdfTypes.includes(extension)) return 'pdf';
  if (imgTypes.includes(extension)) return 'img';
  if (videoTypes.includes(extension)) return 'video';
  if (audioTypes.includes(extension)) return 'audio';

  return 'other';
}
