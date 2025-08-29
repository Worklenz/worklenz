// Client Portal Types

export interface ClientUser {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  permissions: string[];
}

export interface ClientToken {
  token: string;
  expiresAt: string;
  clientId: string;
  organizationId: string;
}

export interface DashboardStats {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalRequests: number;
  pendingRequests: number;
  acceptedRequests: number;
  inProgressRequests: number;
  completedRequests: number;
  rejectedRequests: number;
  totalInvoices: number;
  unpaidInvoices: number;
  unpaidAmount: number;
}

export interface ClientService {
  id: string;
  name: string;
  description: string;
  status: string;
  serviceData: any;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  price?: number;
  currency?: string;
  category?: string;
}

export interface ClientRequest {
  id: string;
  requestNumber: string;
  serviceId: string;
  serviceName: string;
  serviceDescription: string;
  status: string;
  requestData: any;
  notes: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  clientName: string;
  priority?: string;
  description?: string;
  time?: string;
  attachments?: string[];
  req_no?: string;
  service?: any;
  title?: string;
}

export interface ClientProject {
  id: string;
  name: string;
  description: string;
  status: string;
  status_color: string;
  created_at: string;
  updated_at: string;
  client_id: string;
  client_name: string;
  total_tasks: number;
  completed_tasks: number;
}

export interface ClientInvoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: string;
  dueDate: string;
  sentAt?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
  requestNumber?: string;
  serviceName?: string;
  isOverdue: boolean;
}

export interface ClientChat {
  date: string;
  messageCount: number;
  lastMessageAt: string;
  lastTeamMessageAt?: string;
  unreadCount: number;
  hasNewMessages: boolean;
}

export interface ClientMessage {
  id: string;
  senderType: 'client' | 'team_member';
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  message: string;
  messageType: 'text' | 'file' | 'image';
  fileUrl?: string;
  readAt?: string;
  createdAt: string;
  isFromClient: boolean;
}

export interface ClientSettings {
  company_name: string;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
  logo_url?: string;
  email_notifications: boolean;
  project_updates: boolean;
  invoice_notifications: boolean;
  request_updates: boolean;
}

export interface ClientNotification {
  id: string;
  type: string;
  referenceId: string;
  referenceNumber: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  metadata: any;
}

// API Response Types
export interface ApiResponse<T> {
  done: boolean;
  body: T;
  message?: string;
  title?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ProjectDetails {
  id: string;
  name: string;
  description: string;
  status: string;
  statusColor: string;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
  client: {
    name: string;
    companyName: string;
  };
  statistics: {
    totalTasks: number;
    completedTasks: number;
    progressPercentage: number;
  };
  teamMembers: Array<{
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    email: string;
    avatarUrl?: string;
    roleId?: string;
    roleName?: string;
  }>;
  recentTasks: Array<{
    id: string;
    name: string;
    description: string;
    status: string;
    statusColor: string;
    startDate?: string;
    endDate?: string;
    createdAt: string;
    updatedAt: string;
    commentCount: number;
  }>;
}

export interface InvoiceDetails {
  id: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: string;
  dueDate?: string;
  sentAt?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
  isOverdue: boolean;
  request?: {
    id: string;
    requestNumber: string;
    requestData: any;
    notes: string;
    service: {
      id: string;
      name: string;
      description: string;
    };
  };
  client: {
    name: string;
    companyName: string;
    email: string;
  };
  createdBy?: {
    name: string;
  };
}

export interface ClientProfile {
  client: {
    id: string;
    name: string;
    email: string;
    companyName: string;
    phone: string;
    address: string;
    contactPerson: string;
    status: string;
    createdAt: string;
  };
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
    status: string;
    createdAt: string;
    lastLogin?: string;
  };
  statistics: {
    projectCount: number;
    requestCount: number;
    invoiceCount: number;
    unpaidInvoiceCount: number;
  };
} 