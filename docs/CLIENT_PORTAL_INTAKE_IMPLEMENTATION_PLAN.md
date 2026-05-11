# Client Portal Intake System Implementation Plan

**Date:** January 9, 2026  
**Reference:** [Plane.so Intake Documentation](https://docs.plane.so/core-concepts/intake)  
**Status:** Planning Phase

---

## Executive Summary

This document outlines a comprehensive plan to enhance Worklenz's Client Portal with an **Intake System** inspired by Plane.so's implementation. The intake system will improve how clients submit requests and how organizations triage and manage those submissions before converting them into actionable work items.

### Current State Analysis

Worklenz Client Portal currently has:
- ✅ **Request submission system** (`client_portal_requests` table)
- ✅ **Service-based request forms** with custom questions
- ✅ **Status workflow** (pending → accepted → in_progress → completed/rejected)
- ✅ **File attachments** support
- ✅ **Comments system** for requests
- ✅ **Email notifications** to team admins on new requests
- ✅ **Real-time updates** via Socket.IO

### Gap Analysis

**Missing Features from Plane.so Intake:**
1. ❌ **Snooze functionality** - Defer requests for later review
2. ❌ **Duplicate detection** - Mark requests as duplicates of existing items
3. ❌ **Enhanced filtering** - Filter by multiple criteria simultaneously
4. ❌ **Sequential review** - Navigate through pending requests with prev/next buttons
5. ❌ **Separate intake view** - Dedicated triage interface for admins
6. ❌ **Activity tracking** - Detailed audit trail of all request changes
7. ❌ **Rich text editor** - Enhanced formatting for request descriptions
8. ❌ **Bulk operations** - Process multiple requests at once

---

## Plane.so Intake System Overview

### Core Concepts

**Intake** is a triage system that allows:
- **Guests** (clients) to submit work items (requests)
- **Admins/Members** (organization team) to review, accept, decline, snooze, or mark as duplicate
- **Separation of concerns** - Requests stay in "intake" until explicitly accepted into the project workflow

### Key Features

#### 1. **Role-Based Access**
- **Guests**: Can create and view their own intake items
- **Members**: Can triage and manage intake items
- **Admins**: Full control including deletion

#### 2. **Intake States**
- **Pending**: Awaiting review (default state)
- **Snoozed**: Deferred for later review with a specific date
- **Accepted**: Moved into project workflow
- **Declined**: Rejected with reason
- **Duplicate**: Marked as duplicate of existing item

#### 3. **Triage Actions**
- **Accept**: Move to project with state selection
- **Decline**: Reject with optional reason
- **Snooze**: Set review date for later
- **Mark as Duplicate**: Link to existing item
- **Delete**: Permanent removal (Admin only)

#### 4. **Views and Filtering**
- **Open Items**: Pending + Snoozed
- **Closed Items**: Accepted + Declined + Duplicate
- **Filters**: Status, Priority, Assignee, Created by, Labels, Dates
- **Sorting**: Date created, Date updated, ID

#### 5. **Additional Features**
- Rich text editor with formatting, images, links, tables
- Activity log with real-time tracking
- Comments with mentions and emoji reactions
- Sequential navigation (prev/next buttons)
- File attachments

---

## Recommended Implementation for Worklenz

### Phase 1: Enhanced Status Management (Quick Wins)

**Priority:** HIGH  
**Effort:** LOW  
**Timeline:** 1-2 weeks

#### 1.1 Add Snooze Functionality

**Database Changes:**
```sql
-- Add snooze_until column to client_portal_requests
ALTER TABLE client_portal_requests 
ADD COLUMN snooze_until TIMESTAMP,
ADD COLUMN snoozed_by UUID REFERENCES users(id),
ADD COLUMN snoozed_at TIMESTAMP;

-- Add index for efficient querying
CREATE INDEX idx_client_portal_requests_snooze 
ON client_portal_requests(snooze_until) 
WHERE snooze_until IS NOT NULL;
```

**Backend Implementation:**
- Add `snoozeRequest` endpoint in `ClientPortalRequestsController`
- Add `unsnoozeRequest` endpoint
- Update `getRequests` to filter snoozed items
- Add automatic un-snooze check (cron job or on-demand)

**Frontend Implementation:**
- Add "Snooze" action in request details page
- Add date picker for snooze duration (presets: 1 day, 3 days, 1 week, custom)
- Show snoozed badge on request list
- Add "Snoozed" filter tab
- Show snooze expiry date in request card

**API Endpoints:**
```typescript
POST /api/client-portal/requests/:id/snooze
  Body: { snoozeUntil: Date, reason?: string }
  
POST /api/client-portal/requests/:id/unsnooze
  
GET /api/client-portal/requests?filter=snoozed
```

#### 1.2 Duplicate Detection and Linking

**Database Changes:**
```sql
-- Add duplicate tracking
ALTER TABLE client_portal_requests 
ADD COLUMN is_duplicate BOOLEAN DEFAULT FALSE,
ADD COLUMN duplicate_of_request_id UUID REFERENCES client_portal_requests(id),
ADD COLUMN duplicate_of_task_id UUID REFERENCES tasks(id),
ADD COLUMN marked_duplicate_by UUID REFERENCES users(id),
ADD COLUMN marked_duplicate_at TIMESTAMP;

-- Add index
CREATE INDEX idx_client_portal_requests_duplicate 
ON client_portal_requests(duplicate_of_request_id) 
WHERE duplicate_of_request_id IS NOT NULL;
```

**Backend Implementation:**
- Add `markAsDuplicate` endpoint
- Support linking to both requests and tasks
- Update status to "duplicate" when marked
- Add validation to prevent circular duplicates

**Frontend Implementation:**
- Add "Mark as Duplicate" action
- Search modal to find similar requests/tasks
- Show duplicate badge and link to original
- Display duplicate chain in request details

**API Endpoints:**
```typescript
POST /api/client-portal/requests/:id/mark-duplicate
  Body: { 
    duplicateOfRequestId?: string, 
    duplicateOfTaskId?: string,
    reason?: string 
  }
  
GET /api/client-portal/requests/:id/duplicates
  // Returns all requests marked as duplicate of this one
```

#### 1.3 Enhanced Filtering System

**Backend Implementation:**
- Extend `getRequests` query builder to support multiple filters
- Add filter combinations (AND/OR logic)
- Add date range filters
- Add search across multiple fields

**Frontend Implementation:**
- Multi-select filter dropdowns
- Filter chips showing active filters
- Save filter presets
- Quick filter buttons (My Requests, Urgent, This Week)

**Filter Options:**
- Status: pending, accepted, in_progress, completed, rejected, snoozed, duplicate
- Priority: low, medium, high, urgent
- Date Created: today, this week, this month, custom range
- Date Updated: today, this week, this month, custom range
- Service: multi-select from available services
- Search: request number, title, description, notes

---

### Phase 2: Dedicated Intake Interface (Medium Priority)

**Priority:** MEDIUM  
**Effort:** MEDIUM  
**Timeline:** 2-3 weeks

#### 2.1 Admin Intake Dashboard

**Purpose:** Separate interface for team members to triage incoming requests efficiently.

**Features:**
- **Two-panel layout**: List view + Detail view
- **Keyboard shortcuts**: Accept (A), Decline (D), Snooze (S), Next (→), Previous (←)
- **Batch selection**: Select multiple requests for bulk actions
- **Quick actions toolbar**: Accept, Decline, Snooze, Assign
- **Status counters**: Show counts for each status category

**Implementation:**
```typescript
// New route in main Worklenz admin app
/worklenz/client-portal/intake

// Components:
- IntakeListView (left panel)
- IntakeDetailView (right panel)
- IntakeFilters (top bar)
- IntakeActions (action toolbar)
```

#### 2.2 Sequential Navigation

**Features:**
- Previous/Next buttons in request detail view
- Maintain filter context during navigation
- Keyboard shortcuts for navigation
- Progress indicator (e.g., "Request 3 of 15")

**Implementation:**
- Store filtered request IDs in state
- Track current index
- Preload adjacent requests for smooth navigation

#### 2.3 Open vs Closed Views

**Open Requests:**
- Pending
- Snoozed (with expiry date)

**Closed Requests:**
- Accepted (with link to created task/project)
- Declined (with reason)
- Duplicate (with link to original)
- Completed

**Implementation:**
- Tab-based navigation
- Separate API endpoints or filter parameter
- Different action sets per view

---

### Phase 3: Enhanced Request Management (Advanced)

**Priority:** MEDIUM  
**Effort:** HIGH  
**Timeline:** 3-4 weeks

#### 3.1 Rich Text Editor for Descriptions

**Current:** Plain textarea  
**Proposed:** TinyMCE or similar rich text editor

**Features:**
- Text formatting (bold, italic, underline, headings)
- Lists (ordered, unordered)
- Links and images
- Tables
- Code blocks
- File attachments inline

**Implementation:**
- Integrate TinyMCE (already used in main Worklenz app)
- Update `request_data` field to store HTML
- Sanitize HTML on backend
- Render formatted content in detail view

#### 3.2 Enhanced Activity Log

**Current:** Basic comment system  
**Proposed:** Comprehensive activity tracking

**Track:**
- Request created
- Status changes (with old/new values)
- Field updates (title, description, priority)
- Snooze actions (snoozed, unsnoozed, snooze expired)
- Duplicate marking
- Assignee changes
- Attachments added/removed
- Comments added

**Database Changes:**
```sql
CREATE TABLE client_portal_request_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES client_portal_requests(id) ON DELETE CASCADE,
  activity_type VARCHAR(50) NOT NULL, -- 'created', 'status_changed', 'snoozed', etc.
  actor_id UUID REFERENCES users(id),
  actor_type VARCHAR(20), -- 'client', 'team_member', 'system'
  old_value JSONB,
  new_value JSONB,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_request_activities_request 
ON client_portal_request_activities(request_id, created_at DESC);
```

**Frontend Implementation:**
- Timeline view showing all activities
- Filter activities by type
- Expandable activity details
- Real-time updates via Socket.IO

#### 3.3 Bulk Operations

**Actions:**
- Bulk accept (with same state)
- Bulk decline (with same reason)
- Bulk assign
- Bulk change priority
- Bulk delete (admin only)

**Implementation:**
- Checkbox selection in list view
- Bulk action toolbar
- Confirmation modal with summary
- Progress indicator for large batches
- Rollback on partial failure

**API Endpoints:**
```typescript
POST /api/client-portal/requests/bulk-action
  Body: {
    requestIds: string[],
    action: 'accept' | 'decline' | 'assign' | 'delete',
    params: Record<string, any>
  }
```

---

### Phase 4: Advanced Features (Future Enhancements)

**Priority:** LOW  
**Effort:** MEDIUM-HIGH  
**Timeline:** 4-6 weeks

#### 4.1 Request Templates

**Purpose:** Allow clients to submit common request types with pre-filled fields.

**Features:**
- Admin creates templates with default values
- Client selects template when creating request
- Template includes service, priority, common questions
- Version control for templates

#### 4.2 Automated Triage Rules

**Purpose:** Automatically categorize or route requests based on rules.

**Examples:**
- Auto-assign urgent requests to specific team member
- Auto-label requests based on keywords
- Auto-snooze low-priority requests during busy periods
- Auto-decline spam or invalid requests

**Implementation:**
- Rule engine with conditions and actions
- Admin UI to create/manage rules
- Execution on request creation or update
- Audit log for automated actions

#### 4.3 SLA Tracking

**Purpose:** Track response and resolution times for requests.

**Features:**
- Define SLA targets per service or priority
- Visual indicators for approaching/breached SLAs
- Automatic escalation on SLA breach
- SLA reports and analytics

#### 4.4 Request Voting and Prioritization

**Purpose:** Allow multiple clients to vote on requests to help prioritize.

**Features:**
- Clients can upvote requests
- Sort by vote count
- Show vote count in list view
- Notification to request creator when accepted

#### 4.5 Public Request Board

**Purpose:** Allow clients to see other requests (if enabled by organization).

**Features:**
- Toggle public visibility per request
- Clients can view and comment on public requests
- Prevents duplicate submissions
- Community engagement

---

## Technical Implementation Details

### Database Schema Updates

```sql
-- Phase 1: Core Enhancements
ALTER TABLE client_portal_requests 
ADD COLUMN snooze_until TIMESTAMP,
ADD COLUMN snoozed_by UUID REFERENCES users(id),
ADD COLUMN snoozed_at TIMESTAMP,
ADD COLUMN is_duplicate BOOLEAN DEFAULT FALSE,
ADD COLUMN duplicate_of_request_id UUID REFERENCES client_portal_requests(id),
ADD COLUMN duplicate_of_task_id UUID REFERENCES tasks(id),
ADD COLUMN marked_duplicate_by UUID REFERENCES users(id),
ADD COLUMN marked_duplicate_at TIMESTAMP,
ADD COLUMN decline_reason TEXT,
ADD COLUMN accepted_as_task_id UUID REFERENCES tasks(id);

-- Indexes
CREATE INDEX idx_client_portal_requests_snooze 
ON client_portal_requests(snooze_until) 
WHERE snooze_until IS NOT NULL;

CREATE INDEX idx_client_portal_requests_duplicate 
ON client_portal_requests(duplicate_of_request_id) 
WHERE duplicate_of_request_id IS NOT NULL;

CREATE INDEX idx_client_portal_requests_status_created 
ON client_portal_requests(status, created_at DESC);

-- Phase 3: Activity Tracking
CREATE TABLE client_portal_request_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES client_portal_requests(id) ON DELETE CASCADE,
  activity_type VARCHAR(50) NOT NULL,
  actor_id UUID,
  actor_type VARCHAR(20),
  actor_name VARCHAR(255),
  old_value JSONB,
  new_value JSONB,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_request_activities_request 
ON client_portal_request_activities(request_id, created_at DESC);
```

### API Endpoints Summary

#### New Endpoints (Phase 1)
```typescript
// Snooze Management
POST   /api/client-portal/requests/:id/snooze
POST   /api/client-portal/requests/:id/unsnooze
GET    /api/client-portal/requests/snoozed

// Duplicate Management
POST   /api/client-portal/requests/:id/mark-duplicate
GET    /api/client-portal/requests/:id/duplicates
POST   /api/client-portal/requests/:id/unmark-duplicate

// Enhanced Filtering
GET    /api/client-portal/requests?status[]=pending&status[]=snoozed&priority=high&dateFrom=2026-01-01
```

#### New Endpoints (Phase 2)
```typescript
// Intake Dashboard
GET    /api/client-portal/intake/summary  // Counts by status
GET    /api/client-portal/intake/pending  // Optimized for triage view
POST   /api/client-portal/intake/:id/accept
POST   /api/client-portal/intake/:id/decline
```

#### New Endpoints (Phase 3)
```typescript
// Activity Log
GET    /api/client-portal/requests/:id/activities

// Bulk Operations
POST   /api/client-portal/requests/bulk-action
```

### Frontend Components

#### Client Portal (worklenz-client-portal)
```
src/pages/
  ├── RequestsPage.tsx (existing - enhance with filters)
  ├── RequestDetailsPage.tsx (existing - add snooze, duplicate actions)
  └── NewRequestPage.tsx (existing - add rich text editor)
```

#### Admin Portal (worklenz-frontend)
```
src/app/pages/client-portal/
  ├── intake/
  │   ├── IntakeDashboard.tsx (new)
  │   ├── IntakeListView.tsx (new)
  │   ├── IntakeDetailView.tsx (new)
  │   ├── IntakeFilters.tsx (new)
  │   └── IntakeActions.tsx (new)
  └── requests/
      ├── RequestManagement.tsx (existing - enhance)
      └── RequestActivityLog.tsx (new)
```

### Socket.IO Events

```typescript
// Real-time updates
'client_portal:request_created'
'client_portal:request_status_updated'
'client_portal:request_snoozed'
'client_portal:request_unsnoozed'
'client_portal:request_marked_duplicate'
'client_portal:request_activity_added'
'client_portal:request_comment_added'
```

---

## Implementation Roadmap

### Sprint 1: Snooze & Duplicate (2 weeks)
- [ ] Database schema updates
- [ ] Backend API endpoints for snooze
- [ ] Backend API endpoints for duplicate marking
- [ ] Frontend snooze UI (client portal)
- [ ] Frontend duplicate UI (client portal)
- [ ] Admin UI for managing snoozed/duplicate requests
- [ ] Testing and QA

### Sprint 2: Enhanced Filtering (1 week)
- [ ] Backend query builder enhancements
- [ ] Multi-filter support
- [ ] Frontend filter UI components
- [ ] Filter presets and saved filters
- [ ] Testing and QA

### Sprint 3: Intake Dashboard (2 weeks)
- [ ] Admin intake dashboard layout
- [ ] Sequential navigation
- [ ] Keyboard shortcuts
- [ ] Open/Closed views
- [ ] Quick actions toolbar
- [ ] Testing and QA

### Sprint 4: Activity Log (1 week)
- [ ] Activity tracking database schema
- [ ] Backend activity logging
- [ ] Frontend activity timeline
- [ ] Real-time activity updates
- [ ] Testing and QA

### Sprint 5: Bulk Operations (1 week)
- [ ] Backend bulk action endpoints
- [ ] Frontend selection UI
- [ ] Bulk action confirmation
- [ ] Progress indicators
- [ ] Testing and QA

### Sprint 6: Rich Text Editor (1 week)
- [ ] Integrate TinyMCE
- [ ] Update request creation form
- [ ] Update request detail view
- [ ] HTML sanitization
- [ ] Testing and QA

---

## Success Metrics

### Efficiency Metrics
- **Triage Time**: Average time to accept/decline a request
- **Response Time**: Time from submission to first action
- **Duplicate Rate**: Percentage of requests marked as duplicate
- **Snooze Usage**: Percentage of requests snoozed

### Quality Metrics
- **Acceptance Rate**: Percentage of requests accepted vs declined
- **Client Satisfaction**: Feedback on request submission process
- **Team Satisfaction**: Feedback on triage workflow

### Volume Metrics
- **Requests per Day**: Track incoming request volume
- **Backlog Size**: Number of pending requests
- **Snoozed Items**: Number of snoozed requests

---

## Risk Assessment

### Technical Risks
| Risk | Impact | Mitigation |
|------|--------|------------|
| Database migration complexity | Medium | Test on staging, use transactions, have rollback plan |
| Performance with large request volumes | High | Add proper indexes, implement pagination, cache filters |
| Real-time sync issues | Medium | Implement retry logic, fallback to polling |

### User Experience Risks
| Risk | Impact | Mitigation |
|------|--------|------------|
| Learning curve for new features | Low | Provide tooltips, onboarding tour, documentation |
| Feature discoverability | Medium | Clear UI indicators, help text, training materials |
| Mobile responsiveness | Medium | Test on mobile devices, use responsive design |

### Business Risks
| Risk | Impact | Mitigation |
|------|--------|------------|
| Feature adoption | Medium | Gradual rollout, gather feedback, iterate |
| Increased support requests | Low | Comprehensive documentation, in-app help |

---

## Comparison: Worklenz vs Plane.so

| Feature | Plane.so Intake | Worklenz Current | Worklenz Proposed |
|---------|----------------|------------------|-------------------|
| Guest submission | ✅ | ✅ | ✅ |
| Status workflow | ✅ | ✅ (5 states) | ✅ (7+ states) |
| Snooze requests | ✅ | ❌ | ✅ |
| Mark as duplicate | ✅ | ❌ | ✅ |
| Rich text editor | ✅ | ❌ | ✅ |
| Activity log | ✅ | ⚠️ (basic) | ✅ |
| Sequential navigation | ✅ | ❌ | ✅ |
| Bulk operations | ✅ | ❌ | ✅ |
| Custom forms | ❌ | ✅ | ✅ |
| File attachments | ✅ | ✅ | ✅ |
| Comments | ✅ | ✅ | ✅ |
| Email notifications | ✅ | ✅ | ✅ |
| Real-time updates | ✅ | ✅ | ✅ |
| Filtering | ✅ | ⚠️ (basic) | ✅ |
| Sorting | ✅ | ✅ | ✅ |

---

## Conclusion

Implementing an enhanced intake system in Worklenz Client Portal will significantly improve the request management workflow for both clients and organization teams. By adopting proven patterns from Plane.so while leveraging Worklenz's existing strengths (custom forms, service-based requests), we can create a best-in-class intake experience.

### Recommended Approach
1. **Start with Phase 1** (Snooze & Duplicate) - High impact, low effort
2. **Gather feedback** from beta users
3. **Iterate to Phase 2** (Intake Dashboard) - Improve team efficiency
4. **Continue to Phase 3** (Advanced features) based on user demand

### Key Differentiators
- **Service-based requests**: Worklenz's existing custom form system is more flexible than Plane.so's generic intake
- **Client portal separation**: Clear boundary between client and admin interfaces
- **Integration with projects**: Seamless conversion from requests to tasks

This phased approach allows for incremental value delivery while managing technical complexity and risk.
