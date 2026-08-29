# Client Portal Database Migrations - Release v2.2.0

This directory contains all database migrations for the Client Portal feature introduced in Worklenz v2.2.0.

## Migration Files

### 1. `20250101000001-create-client-portal-tables.sql`
**Purpose**: Creates the foundational tables for the client portal feature
**Tables Created**:
- `client_portal_services` - Service catalog management
- `client_portal_requests` - Service request tracking
- `client_portal_invoices` - Billing and invoicing
- `client_portal_chat_messages` - Real-time communication
- `client_portal_settings` - Portal configuration
- `client_portal_access` - Client authentication
- `client_relationships` - Dual actor support
- `client_portal_sessions` - Session management
- `client_portal_permissions` - Access control
- `project_client_access` - Project visibility control

### 2. `20250101000002-enhance-existing-tables.sql`
**Purpose**: Adds client portal related fields to existing tables
**Tables Enhanced**:
- `clients` - Added portal access fields
- `projects` - Added portal visibility fields
- `users` - Added dual actor support fields

### 3. `20250101000003-create-client-portal-functions.sql`
**Purpose**: Creates database functions for client portal operations
**Functions Created**:
- `generate_request_number()` - Auto-generate request numbers
- `generate_invoice_number()` - Auto-generate invoice numbers
- `create_client_relationship()` - Manage client relationships
- `check_client_permission()` - Permission validation
- `get_client_accessible_projects()` - Project access control
- `update_client_session()` - Session management
- `clean_expired_client_sessions()` - Session cleanup
- `get_client_portal_stats()` - Statistics and reporting

### 4. `20250101000004-create-client-portal-triggers.sql`
**Purpose**: Creates database triggers for automated operations
**Triggers Created**:
- Request/Invoice number generation
- Updated timestamp management
- Activity logging
- Data validation
- Client relationship management

### 5. `20250101000005-create-client-portal-views.sql`
**Purpose**: Creates database views for simplified data access
**Views Created**:
- `client_portal_services_view` - Services with organization details
- `client_portal_requests_view` - Requests with full context
- `client_portal_invoices_view` - Invoices with payment status
- `client_relationships_view` - Relationship management
- `client_portal_chat_messages_view` - Chat with sender details
- `client_portal_projects_view` - Accessible projects
- `client_portal_stats_view` - Statistics and analytics
- `client_portal_permissions_view` - Permission summary

### 6. `20250101000006-seed-client-portal-data.sql`
**Purpose**: Seeds initial data and configurations
**Data Seeded**:
- Default permissions for client relationships
- Default portal settings for existing teams
- Optional sample services (commented out)
- Database comments and documentation

## Key Features

### Dual Actor Support
The client portal supports the scenario where one user can be:
1. A team member in their own organization (using client-portal)
2. A client in another organization (using client-view)

### Security & Access Control
- Role-based permissions
- Client-specific data isolation
- Session management
- Audit logging

### Performance Optimizations
- Comprehensive indexing strategy
- Efficient views for common queries
- Automated cleanup procedures

### Data Integrity
- Foreign key constraints
- Check constraints for status fields
- Trigger-based validation
- Unique constraints for business keys

## Execution Order

Migrations should be executed in the following order:

1. `20250101000001-create-client-portal-tables.sql`
2. `20250101000002-enhance-existing-tables.sql`
3. `20250101000003-create-client-portal-functions.sql`
4. `20250101000004-create-client-portal-triggers.sql`
5. `20250101000005-create-client-portal-views.sql`
6. `20250101000006-seed-client-portal-data.sql`

## Rollback Considerations

To rollback these migrations:

1. Drop all views created in step 5
2. Drop all triggers created in step 4
3. Drop all functions created in step 3
4. Remove columns added in step 2
5. Drop all tables created in step 1

**Note**: The seed data in step 6 will be automatically cleaned up when tables are dropped.

## Database Requirements

- PostgreSQL 12 or higher
- UUID extension
- JSONB support
- Triggers support
- Views support

## Performance Impact

- **Storage**: ~50MB additional storage for typical deployment
- **Memory**: Minimal impact, mostly for new indexes
- **CPU**: Slight increase due to triggers and functions
- **Network**: No impact on existing queries

## Monitoring

Key metrics to monitor after deployment:
- Client portal session count
- Request/invoice generation performance
- Chat message volume
- Permission check performance

## Support

For issues related to these migrations, please refer to:
- Database schema documentation
- API documentation for client portal endpoints
- Frontend client portal component documentation 