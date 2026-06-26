# Worklenz Socket.IO Integration Guide for Flutter/Dart

## Table of Contents
1. [Overview](#overview)
2. [Connection Setup](#connection-setup)
3. [Authentication](#authentication)
4. [Event Categories](#event-categories)
5. [Task Management Events](#task-management-events)
6. [Project Management Events](#project-management-events)
7. [Real-time Collaboration Events](#real-time-collaboration-events)
8. [Client Portal Events](#client-portal-events)
9. [Error Handling](#error-handling)
10. [Best Practices](#best-practices)

---

## Overview

Worklenz uses Socket.IO for real-time bidirectional communication between clients and the server. This guide provides comprehensive documentation for implementing Socket.IO events in Flutter/Dart applications.

### Key Concepts
- **Events**: Named messages sent between client and server
- **Rooms**: Channels for broadcasting to specific groups (e.g., project rooms)
- **Acknowledgments**: Callbacks for request-response patterns
- **Session-based Auth**: Socket connections use HTTP session authentication

### Socket.IO Server Details
- **URL**: Same as your API base URL
- **Transport**: WebSocket with polling fallback
- **Path**: `/socket.io/`
- **Authentication**: Session-based (cookies from login)

---

## Connection Setup

### Flutter Dependencies

```yaml
dependencies:
  socket_io_client: ^2.0.3+1
```

### Basic Connection Example

```dart
import 'package:socket_io_client/socket_io_client.dart' as IO;

class SocketService {
  IO.Socket? socket;
  
  void connect(String baseUrl, String sessionCookie) {
    socket = IO.io(baseUrl, <String, dynamic>{
      'transports': ['websocket', 'polling'],
      'autoConnect': false,
      'extraHeaders': {
        'Cookie': sessionCookie, // Session cookie from login
      },
    });
    
    socket?.connect();
    
    // Connection event handlers
    socket?.onConnect((_) {
      print('Connected to Socket.IO server');
      // Authenticate after connection
      authenticateSocket();
    });
    
    socket?.onDisconnect((_) {
      print('Disconnected from Socket.IO server');
    });
    
    socket?.onError((error) {
      print('Socket error: $error');
    });
  }
  
  void disconnect() {
    socket?.disconnect();
    socket?.dispose();
  }
}
```

---

## Authentication

### LOGIN Event (Event ID: 0)

After connecting, authenticate the socket with the user ID.

**Client → Server**


```dart
void authenticateSocket() {
  final userId = 'your-user-id'; // Get from auth state
  socket?.emit('0', userId); // Event ID 0 = LOGIN
}

// Listen for login confirmation
socket?.on('0', (data) {
  print('Socket authenticated successfully');
});
```

**Request Format:**
- Type: `String`
- Value: User ID (UUID)

**Response:**
- Event: `'0'` (LOGIN)
- No data payload (confirmation only)

---

## Event Categories

### Event ID Mapping

All events are identified by numeric IDs. Here's the complete mapping:

```dart
enum SocketEvents {
  LOGIN = 0,
  LOGOUT = 1,
  INVITATIONS_UPDATE = 2,
  NOTIFICATIONS_UPDATE = 3,
  TEAM_MEMBER_REMOVED = 4,
  TASK_COMMENTS_UPDATED = 5,
  QUICK_TASK = 6,
  QUICK_ASSIGNEES_UPDATE = 7,
  TASK_STATUS_CHANGE = 8,
  TASK_PRIORITY_CHANGE = 9,
  TASK_NAME_CHANGE = 10,
  TASK_LABELS_CHANGE = 11,
  CREATE_LABEL = 12,
  TASK_END_DATE_CHANGE = 13,
  TASK_START_DATE_CHANGE = 14,
  TASK_TIME_ESTIMATION_CHANGE = 15,
  TASK_DESCRIPTION_CHANGE = 16,
  GET_TASK_PROGRESS = 17,
  TASK_TIMER_START = 18,
  TASK_TIMER_STOP = 19,
  TASK_SORT_ORDER_CHANGE = 20,
  JOIN_OR_LEAVE_PROJECT_ROOM = 21,
  PROJECT_UPDATES_AVAILABLE = 22,
  TASK_SUBSCRIBERS_CHANGE = 23,
  PROJECT_SUBSCRIBERS_CHANGE = 24,
  TASK_PHASE_CHANGE = 25,
  ROADMAP_SORT_ORDER_CHANGE = 26,
  PHASE_START_DATE_CHANGE = 27,
  PHASE_END_DATE_CHANGE = 28,
  NEW_PROJECT_COMMENT_RECEIVED = 29,
  PROJECT_HEALTH_CHANGE = 30,
  PROJECT_START_DATE_CHANGE = 31,
  PROJECT_END_DATE_CHANGE = 32,
  PROJECT_STATUS_CHANGE = 33,
  PROJECT_CATEGORY_CHANGE = 34,
  CREATE_PROJECT_CATEGORY = 35,
  PT_QUICK_TASK = 36,
  PT_NAME_CHANGE = 37,
  PT_TASK_SORT_ORDER_CHANGE = 38,
  PT_TASK_NAME_CHANGE = 39,
  PT_TASK_TIME_ESTIMATION_CHANGE = 40,
  PT_TASK_DESCRIPTION_CHANGE = 41,
  PT_TASK_LABELS_CHANGE = 42,
  PT_CREATE_LABEL = 43,
  PT_TASK_PHASE_CHANGE = 44,
  PT_TASK_STATUS_CHANGE = 45,
  PT_TASK_PRIORITY_CHANGE = 46,
  GANNT_DRAG_CHANGE = 47,
  SCHEDULE_MEMBER_ALLOCATION_CREATE = 48,
  SCHEDULE_MEMBER_START_DATE_CHANGE = 49,
  SCHEDULE_MEMBER_END_DATE_CHANGE = 50,
  PROJECT_DATA_CHANGE = 51,
  TASK_BILLABLE_CHANGE = 52,
  TASK_RECURRING_CHANGE = 53,
  TASK_ASSIGNEES_CHANGE = 54,
  TASK_CUSTOM_COLUMN_UPDATE = 55,
  CUSTOM_COLUMN_PINNED_CHANGE = 56,
  TEAM_MEMBER_ROLE_CHANGE = 57,
  UPDATE_TASK_PROGRESS = 58,
  UPDATE_TASK_WEIGHT = 59,
  TASK_PROGRESS_UPDATED = 60,
  GET_TASK_SUBTASKS_COUNT = 61,
  TASK_SUBTASKS_COUNT = 62,
  GET_DONE_STATUSES = 63,
  // Client Portal events start at 64
  CLIENT_PORTAL_NEW_MESSAGE = 64,
  CLIENT_PORTAL_REQUEST_STATUS_UPDATED = 65,
  CLIENT_PORTAL_PROJECT_UPDATED = 66,
  CLIENT_PORTAL_INVOICE_CREATED = 67,
  CLIENT_PORTAL_NOTIFICATION = 68,
  CHAT_SEND_MESSAGE = 69,
  CHAT_JOIN = 70,
  CHAT_LEAVE = 71,
  CHAT_TYPING = 72,
  CHAT_MESSAGE_READ = 73,
  CHAT_MESSAGE_RECEIVED = 74,
}
```

---

## Task Management Events

### 1. QUICK_TASK (Event ID: 6) - Create Task

Creates a new task quickly with minimal information.

**Client → Server**

```dart
void createQuickTask({
  required String name,
  required String projectId,
  required String teamId,
  String? statusId,
  String? priorityId,
  String? phaseId,
  String? endDate,
  int? totalHours,
  int? totalMinutes,
  int sortOrder = 0,
}) {
  final data = {
    'name': name,
    'project_id': projectId,
    'team_id': teamId,
    'status_id': statusId,
    'priority_id': priorityId,
    'phase_id': phaseId,
    'end_date': endDate, // Format: 'YYYY-MM-DD'
    'total_hours': totalHours ?? 0,
    'total_minutes': totalMinutes ?? 0,
    'sort_order': sortOrder,
  };
  
  socket?.emit('6', jsonEncode(data));
}

// Listen for response
socket?.on('6', (data) {
  if (data != null) {
    final task = Task.fromJson(data);
    print('Task created: ${task.id}');
  } else {
    print('Task creation failed');
  }
});
```


**Request JSON:**
```json
{
  "name": "Task name",
  "project_id": "uuid",
  "team_id": "uuid",
  "status_id": "uuid or null",
  "priority_id": "uuid or null",
  "phase_id": "uuid or null",
  "end_date": "2024-12-31 or null",
  "total_hours": 0,
  "total_minutes": 0,
  "sort_order": 0
}
```

**Response JSON:**
```json
{
  "id": "task-uuid",
  "name": "Task name",
  "project_id": "uuid",
  "status_id": "uuid",
  "status": "To Do",
  "color_code": "#FF5733",
  "priority_id": "uuid",
  "priority": "High",
  "phase_id": "uuid",
  "phase_name": "Phase 1",
  "complete_ratio": 0,
  "completed_count": 0,
  "total_tasks_count": 0,
  "sort_order": 0
}
```

---

### 2. TASK_STATUS_CHANGE (Event ID: 8)

Updates a task's status.

**Client → Server**

```dart
void updateTaskStatus({
  required String taskId,
  required String statusId,
  required String teamId,
  String? parentTaskId,
}) {
  final data = {
    'task_id': taskId,
    'status_id': statusId,
    'team_id': teamId,
    'parent_task': parentTaskId,
  };
  
  socket?.emit('8', jsonEncode(data));
}

// Listen for response
socket?.on('8', (data) {
  final response = jsonDecode(data);
  print('Status updated: ${response['status_id']}');
  print('Complete ratio: ${response['complete_ratio']}');
  
  // Check if dependencies are completed
  if (response['completed_deps'] == false) {
    showAlert('Cannot change status: incomplete dependencies');
  }
});
```

**Request JSON:**
```json
{
  "task_id": "uuid",
  "status_id": "uuid",
  "team_id": "uuid",
  "parent_task": "uuid or null"
}
```

**Response JSON:**
```json
{
  "id": "task-uuid",
  "parent_task": "parent-uuid or null",
  "status_id": "uuid",
  "color_code": "#FF5733AA",
  "color_code_dark": "#FF5733",
  "complete_ratio": 50,
  "completed_count": 5,
  "total_tasks_count": 10,
  "completed_at": "2024-12-31T10:30:00Z or null",
  "statusCategory": {
    "id": "uuid",
    "name": "Done",
    "is_done": true
  },
  "completed_deps": true
}
```

---

### 3. TASK_ASSIGNEES_CHANGE (Event ID: 54)

Assigns or unassigns team members to/from a task.

**Client → Server**

```dart
void updateTaskAssignees({
  required String taskId,
  required String teamId,
  required List<String> teamMemberIds,
  required String projectId,
  required String reporterId,
  required int mode, // 0 = assign, 1 = unassign
}) {
  final data = {
    'task_id': taskId,
    'team_id': teamId,
    'team_member_id': teamMemberIds,
    'project_id': projectId,
    'reporter_id': reporterId,
    'mode': mode,
  };
  
  socket?.emit('54', jsonEncode(data));
}

// Listen for response
socket?.on('54', (data) {
  final response = jsonDecode(data);
  final assigneeIds = List<String>.from(response['assigneeIds']);
  print('Updated assignees: $assigneeIds');
});
```

**Request JSON:**
```json
{
  "task_id": "uuid",
  "team_id": "uuid",
  "team_member_id": ["uuid1", "uuid2"],
  "project_id": "uuid",
  "reporter_id": "uuid",
  "mode": 0
}
```

**Response JSON:**
```json
{
  "assigneeIds": ["uuid1", "uuid2"]
}
```

---

### 4. TASK_NAME_CHANGE (Event ID: 10)

Updates a task's name.

```dart
void updateTaskName({
  required String taskId,
  required String name,
}) {
  final data = {
    'id': taskId,
    'name': name,
  };
  
  socket?.emit('10', jsonEncode(data));
}
```

**Request JSON:**
```json
{
  "id": "task-uuid",
  "name": "New task name"
}
```

---

### 5. TASK_DESCRIPTION_CHANGE (Event ID: 16)

Updates a task's description.

```dart
void updateTaskDescription({
  required String taskId,
  required String description,
}) {
  final data = {
    'task_id': taskId,
    'description': description,
  };
  
  socket?.emit('16', jsonEncode(data));
}
```

**Request JSON:**
```json
{
  "task_id": "uuid",
  "description": "Task description text"
}
```

---

### 6. TASK_PRIORITY_CHANGE (Event ID: 9)

Updates a task's priority.

```dart
void updateTaskPriority({
  required String taskId,
  required String priorityId,
}) {
  final data = {
    'task_id': taskId,
    'priority_id': priorityId,
  };
  
  socket?.emit('9', jsonEncode(data));
}
```

**Request JSON:**
```json
{
  "task_id": "uuid",
  "priority_id": "uuid"
}
```

---

### 7. TASK_START_DATE_CHANGE (Event ID: 14)

Updates a task's start date.

```dart
void updateTaskStartDate({
  required String taskId,
  String? startDate, // null to clear
  String? timeZone,
}) {
  final data = {
    'task_id': taskId,
    'start_date': startDate, // Format: 'YYYY-MM-DD'
    'time_zone': timeZone ?? 'UTC',
  };
  
  socket?.emit('14', jsonEncode(data));
}
```

**Request JSON:**
```json
{
  "task_id": "uuid",
  "start_date": "2024-12-01",
  "time_zone": "America/New_York"
}
```

---

### 8. TASK_END_DATE_CHANGE (Event ID: 13)

Updates a task's end date.

```dart
void updateTaskEndDate({
  required String taskId,
  String? endDate, // null to clear
  String? timeZone,
}) {
  final data = {
    'task_id': taskId,
    'end_date': endDate, // Format: 'YYYY-MM-DD'
    'time_zone': timeZone ?? 'UTC',
  };
  
  socket?.emit('13', jsonEncode(data));
}
```


**Request JSON:**
```json
{
  "task_id": "uuid",
  "end_date": "2024-12-31",
  "time_zone": "America/New_York"
}
```

---

### 9. TASK_TIME_ESTIMATION_CHANGE (Event ID: 15)

Updates a task's time estimation.

```dart
void updateTaskTimeEstimation({
  required String taskId,
  required int hours,
  required int minutes,
  String? parentTaskId,
}) {
  final data = {
    'task_id': taskId,
    'hours': hours,
    'minutes': minutes,
    'parent_task_id': parentTaskId,
  };
  
  socket?.emit('15', jsonEncode(data));
}
```

**Request JSON:**
```json
{
  "task_id": "uuid",
  "hours": 5,
  "minutes": 30,
  "parent_task_id": "uuid or null"
}
```

---

### 10. UPDATE_TASK_PROGRESS (Event ID: 58)

Manually updates a task's progress percentage.

```dart
void updateTaskProgress({
  required String taskId,
  required double progressValue, // 0-100
  String? parentTaskId,
}) {
  final data = {
    'task_id': taskId,
    'progress_value': progressValue,
    'parent_task_id': parentTaskId,
  };
  
  socket?.emit('58', jsonEncode(data));
}

// Listen for progress update confirmation
socket?.on('60', (data) { // TASK_PROGRESS_UPDATED
  final response = jsonDecode(data);
  print('Progress updated: ${response['progress_value']}%');
  
  // Check if should prompt for "done" status
  if (response['should_prompt_for_done'] == true) {
    showDoneStatusPrompt(response['task_id']);
  }
});
```

**Request JSON:**
```json
{
  "task_id": "uuid",
  "progress_value": 75.5,
  "parent_task_id": "uuid or null"
}
```

**Response JSON (Event 60):**
```json
{
  "task_id": "uuid",
  "progress_value": 75.5,
  "should_prompt_for_done": false
}
```

---

### 11. GET_TASK_PROGRESS (Event ID: 17)

Requests the current progress of a task (useful for parent tasks).

```dart
void getTaskProgress(String taskId) {
  socket?.emit('17', taskId);
}

// Listen for response
socket?.on('17', (data) {
  final response = jsonDecode(data);
  print('Task progress: ${response['complete_ratio']}%');
  print('Completed: ${response['completed_count']}/${response['total_tasks_count']}');
});
```

**Request:** String (task ID)

**Response JSON:**
```json
{
  "id": "task-uuid",
  "parent_task": "parent-uuid or null",
  "complete_ratio": 50,
  "completed_count": 5,
  "total_tasks_count": 10
}
```

---

### 12. GET_TASK_SUBTASKS_COUNT (Event ID: 61)

Gets the count of subtasks for a task.

```dart
void getTaskSubtasksCount(String taskId) {
  socket?.emit('61', taskId);
}

// Listen for response
socket?.on('62', (data) { // TASK_SUBTASKS_COUNT
  final response = jsonDecode(data);
  print('Subtasks count: ${response['count']}');
});
```

**Request:** String (task ID)

**Response JSON (Event 62):**
```json
{
  "task_id": "uuid",
  "count": 5
}
```

---

### 13. GET_DONE_STATUSES (Event ID: 63)

Gets all "done" category statuses for a project (used when prompting to mark task as done).

```dart
void getDoneStatuses(String projectId, Function(List<TaskStatus>) callback) {
  socket?.emitWithAck('63', projectId, ack: (data) {
    final statuses = (data as List)
        .map((s) => TaskStatus.fromJson(s))
        .toList();
    callback(statuses);
  });
}
```

**Request:** String (project ID)

**Response (via callback):**
```json
[
  {
    "id": "status-uuid",
    "name": "Done",
    "sort_order": 1,
    "color_code": "#00FF00"
  },
  {
    "id": "status-uuid-2",
    "name": "Completed",
    "sort_order": 2,
    "color_code": "#0000FF"
  }
]
```

---

### 14. TASK_LABELS_CHANGE (Event ID: 11)

Updates task labels.

```dart
void updateTaskLabels({
  required String taskId,
  required List<String> labelIds,
}) {
  final data = {
    'task_id': taskId,
    'labels': labelIds,
  };
  
  socket?.emit('11', jsonEncode(data));
}
```

**Request JSON:**
```json
{
  "task_id": "uuid",
  "labels": ["label-uuid-1", "label-uuid-2"]
}
```

---

### 15. TASK_PHASE_CHANGE (Event ID: 25)

Updates a task's phase.

```dart
void updateTaskPhase({
  required String taskId,
  String? phaseId, // null to remove phase
}) {
  final data = {
    'task_id': taskId,
    'phase_id': phaseId,
  };
  
  socket?.emit('25', jsonEncode(data));
}
```

**Request JSON:**
```json
{
  "task_id": "uuid",
  "phase_id": "uuid or null"
}
```

---

### 16. TASK_SORT_ORDER_CHANGE (Event ID: 20)

Changes task sort order (drag and drop).

```dart
void updateTaskSortOrder({
  required String taskId,
  required String projectId,
  required String teamId,
  required int fromIndex,
  required int toIndex,
  required String fromGroup,
  required String toGroup,
  required String groupBy, // 'status', 'priority', 'phase', etc.
  required bool toLastIndex,
  String? statusId,
  String? priorityId,
  String? phaseId,
}) {
  final data = {
    'task': {
      'id': taskId,
      'project_id': projectId,
      'status': statusId,
      'priority': priorityId,
    },
    'project_id': projectId,
    'team_id': teamId,
    'from_index': fromIndex,
    'to_index': toIndex,
    'from_group': fromGroup,
    'to_group': toGroup,
    'group_by': groupBy,
    'to_last_index': toLastIndex,
  };
  
  socket?.emit('20', jsonEncode(data));
}
```

**Request JSON:**
```json
{
  "task": {
    "id": "task-uuid",
    "project_id": "project-uuid",
    "status": "status-uuid",
    "priority": "priority-uuid"
  },
  "project_id": "project-uuid",
  "team_id": "team-uuid",
  "from_index": 2,
  "to_index": 5,
  "from_group": "status-uuid-1",
  "to_group": "status-uuid-2",
  "group_by": "status",
  "to_last_index": false
}
```

---

### 17. TASK_TIMER_START (Event ID: 18)

Starts a timer for a task.

```dart
void startTaskTimer(String taskId) {
  socket?.emit('18', taskId);
}
```

**Request:** String (task ID)

---

### 18. TASK_TIMER_STOP (Event ID: 19)

Stops a timer for a task.

```dart
void stopTaskTimer(String taskId) {
  socket?.emit('19', taskId);
}
```

**Request:** String (task ID)

---

### 19. TASK_BILLABLE_CHANGE (Event ID: 52)

Updates task billable status.

```dart
void updateTaskBillable({
  required String taskId,
  required bool billable,
}) {
  final data = {
    'task_id': taskId,
    'billable': billable,
  };
  
  socket?.emit('52', jsonEncode(data));
}
```

**Request JSON:**
```json
{
  "task_id": "uuid",
  "billable": true
}
```

---

### 20. TASK_RECURRING_CHANGE (Event ID: 53)

Updates task recurring schedule.

```dart
void updateTaskRecurring({
  required String taskId,
  String? scheduleId, // null to remove recurring
}) {
  final data = {
    'task_id': taskId,
    'schedule_id': scheduleId,
  };
  
  socket?.emit('53', jsonEncode(data));
}
```

**Request JSON:**
```json
{
  "task_id": "uuid",
  "schedule_id": "uuid or null"
}
```

---

## Project Management Events

### 1. JOIN_OR_LEAVE_PROJECT_ROOM (Event ID: 21)

Join or leave a project room to receive real-time updates.

```dart
void joinProjectRoom(String projectId) {
  final data = {
    'id': projectId,
    'type': 'join',
  };
  
  socket?.emit('21', jsonEncode(data));
}

void leaveProjectRoom(String projectId) {
  final data = {
    'id': projectId,
    'type': 'leave',
  };
  
  socket?.emit('21', jsonEncode(data));
}

// Listen for room members update
socket?.on('21', (data) {
  final members = List<Map<String, dynamic>>.from(data);
  print('Active members in project: ${members.length}');
});
```


**Request JSON:**
```json
{
  "id": "project-uuid",
  "type": "join" // or "leave"
}
```

**Response JSON:**
```json
[
  {
    "name": "John Doe",
    "avatar_url": "https://...",
    "color_code": "#FF5733"
  }
]
```

---

### 2. PROJECT_UPDATES_AVAILABLE (Event ID: 22)

Listen for project updates (broadcast to all project room members).

```dart
// Listen for project updates
socket?.on('22', (_) {
  print('Project has updates - refresh data');
  refreshProjectData();
});
```

**Response:** No data (notification only)

---

### 3. PROJECT_STATUS_CHANGE (Event ID: 33)

Updates project status.

```dart
void updateProjectStatus({
  required String projectId,
  required String statusId,
}) {
  final data = {
    'project_id': projectId,
    'status_id': statusId,
  };
  
  socket?.emit('33', jsonEncode(data));
}
```

**Request JSON:**
```json
{
  "project_id": "uuid",
  "status_id": "uuid"
}
```

---

### 4. PROJECT_HEALTH_CHANGE (Event ID: 30)

Updates project health.

```dart
void updateProjectHealth({
  required String projectId,
  required String healthId,
}) {
  final data = {
    'project_id': projectId,
    'health_id': healthId,
  };
  
  socket?.emit('30', jsonEncode(data));
}
```

**Request JSON:**
```json
{
  "project_id": "uuid",
  "health_id": "uuid"
}
```

---

### 5. PROJECT_START_DATE_CHANGE (Event ID: 31)

Updates project start date.

```dart
void updateProjectStartDate({
  required String projectId,
  String? startDate,
}) {
  final data = {
    'project_id': projectId,
    'start_date': startDate, // Format: 'YYYY-MM-DD'
  };
  
  socket?.emit('31', jsonEncode(data));
}
```

---

### 6. PROJECT_END_DATE_CHANGE (Event ID: 32)

Updates project end date.

```dart
void updateProjectEndDate({
  required String projectId,
  String? endDate,
}) {
  final data = {
    'project_id': projectId,
    'end_date': endDate, // Format: 'YYYY-MM-DD'
  };
  
  socket?.emit('32', jsonEncode(data));
}
```

---

### 7. PROJECT_CATEGORY_CHANGE (Event ID: 34)

Updates project category.

```dart
void updateProjectCategory({
  required String projectId,
  String? categoryId,
}) {
  final data = {
    'project_id': projectId,
    'category_id': categoryId,
  };
  
  socket?.emit('34', jsonEncode(data));
}
```

---

### 8. PROJECT_SUBSCRIBERS_CHANGE (Event ID: 24)

Subscribe or unsubscribe from project notifications.

```dart
void updateProjectSubscription({
  required String projectId,
  required String userId,
  required String teamMemberId,
  required int mode, // 0 = subscribe, 1 = unsubscribe
}) {
  final data = {
    'project_id': projectId,
    'user_id': userId,
    'team_member_id': teamMemberId,
    'mode': mode,
  };
  
  socket?.emit('24', jsonEncode(data));
}
```

**Request JSON:**
```json
{
  "project_id": "uuid",
  "user_id": "uuid",
  "team_member_id": "uuid",
  "mode": 0
}
```

---

### 9. TASK_SUBSCRIBERS_CHANGE (Event ID: 23)

Subscribe or unsubscribe from task notifications.

```dart
void updateTaskSubscription({
  required String taskId,
  required String userId,
  required String teamMemberId,
  required int mode, // 0 = subscribe, 1 = unsubscribe
}) {
  final data = {
    'task_id': taskId,
    'user_id': userId,
    'team_member_id': teamMemberId,
    'mode': mode,
  };
  
  socket?.emit('23', jsonEncode(data));
}
```

**Request JSON:**
```json
{
  "task_id": "uuid",
  "user_id": "uuid",
  "team_member_id": "uuid",
  "mode": 0
}
```

---

## Real-time Collaboration Events

### 1. CREATE_LABEL (Event ID: 12)

Creates a new label.

```dart
void createLabel({
  required String name,
  required String colorCode,
  required String teamId,
}) {
  final data = {
    'name': name,
    'color_code': colorCode,
    'team_id': teamId,
  };
  
  socket?.emit('12', jsonEncode(data));
}

// Listen for response
socket?.on('12', (data) {
  final label = Label.fromJson(data);
  print('Label created: ${label.id}');
});
```

**Request JSON:**
```json
{
  "name": "Bug",
  "color_code": "#FF0000",
  "team_id": "uuid"
}
```

**Response JSON:**
```json
{
  "id": "label-uuid",
  "name": "Bug",
  "color_code": "#FF0000"
}
```

---

### 2. CREATE_PROJECT_CATEGORY (Event ID: 35)

Creates a new project category.

```dart
void createProjectCategory({
  required String name,
  required String colorCode,
  required String teamId,
}) {
  final data = {
    'name': name,
    'color_code': colorCode,
    'team_id': teamId,
  };
  
  socket?.emit('35', jsonEncode(data));
}

// Listen for response
socket?.on('35', (data) {
  final category = ProjectCategory.fromJson(data);
  print('Category created: ${category.id}');
});
```

---

### 3. NOTIFICATIONS_UPDATE (Event ID: 3)

Listen for notification updates.

```dart
// Listen for new notifications
socket?.on('3', (_) {
  print('New notification received');
  fetchNotifications();
});
```

---

### 4. INVITATIONS_UPDATE (Event ID: 2)

Listen for invitation updates.

```dart
// Listen for new invitations
socket?.on('2', (_) {
  print('New invitation received');
  fetchInvitations();
});
```

---

### 5. TEAM_MEMBER_REMOVED (Event ID: 4)

Listen for team member removal.

```dart
// Listen for team member removal
socket?.on('4', (data) {
  final removedMemberId = data;
  print('Team member removed: $removedMemberId');
  handleMemberRemoval(removedMemberId);
});
```

---

### 6. TASK_COMMENTS_UPDATED (Event ID: 5)

Listen for task comment updates.

```dart
// Listen for comment updates
socket?.on('5', (data) {
  final taskId = data;
  print('Comments updated for task: $taskId');
  refreshTaskComments(taskId);
});
```

---

### 7. NEW_PROJECT_COMMENT_RECEIVED (Event ID: 29)

Listen for new project comments.

```dart
// Listen for new project comments
socket?.on('29', (data) {
  final comment = ProjectComment.fromJson(data);
  print('New project comment: ${comment.id}');
  addCommentToUI(comment);
});
```

---

## Client Portal Events

### 1. CHAT_JOIN (Event ID: 70)

Join a chat room.

```dart
void joinChat(String chatId) {
  final data = {
    'chatId': chatId,
  };
  
  socket?.emit('70', jsonEncode(data));
}
```

**Request JSON:**
```json
{
  "chatId": "chat-uuid"
}
```

---

### 2. CHAT_LEAVE (Event ID: 71)

Leave a chat room.

```dart
void leaveChat(String chatId) {
  final data = {
    'chatId': chatId,
  };
  
  socket?.emit('71', jsonEncode(data));
}
```

---

### 3. CHAT_SEND_MESSAGE (Event ID: 69)

Send a chat message.

```dart
void sendChatMessage({
  required String chatId,
  required String message,
  String messageType = 'text',
  String? fileUrl,
  String? tempId, // For optimistic updates
}) {
  final data = {
    'chatId': chatId,
    'message': message,
    'messageType': messageType,
    'fileUrl': fileUrl,
    'tempId': tempId,
  };
  
  socket?.emit('69', jsonEncode(data));
}

// Listen for message sent confirmation
socket?.on('chat:message_sent', (data) {
  final response = jsonDecode(data);
  if (response['success']) {
    print('Message sent: ${response['messageId']}');
  } else {
    print('Failed to send message: ${response['error']}');
  }
});

// Listen for incoming messages
socket?.on('chat:message_received', (data) {
  final message = ChatMessage.fromJson(data);
  addMessageToChat(message);
});
```

**Request JSON:**
```json
{
  "chatId": "chat-uuid",
  "message": "Hello!",
  "messageType": "text",
  "fileUrl": null,
  "tempId": "temp-123"
}
```

**Response JSON (chat:message_sent):**
```json
{
  "success": true,
  "messageId": "message-uuid",
  "tempId": "temp-123"
}
```

**Broadcast JSON (chat:message_received):**
```json
{
  "id": "message-uuid",
  "chatId": "chat-uuid",
  "senderId": "user-uuid",
  "senderName": "John Doe",
  "senderType": "team_member",
  "message": "Hello!",
  "messageType": "text",
  "fileUrl": null,
  "createdAt": "2024-12-31T10:30:00Z",
  "isMe": false
}
```

---

### 4. CHAT_TYPING (Event ID: 72)

Indicate typing status.

```dart
void sendTypingIndicator({
  required String chatId,
  required bool isTyping,
}) {
  final data = {
    'chatId': chatId,
    'isTyping': isTyping,
  };
  
  socket?.emit('72', jsonEncode(data));
}

// Listen for typing indicators
socket?.on('chat:typing', (data) {
  final response = jsonDecode(data);
  showTypingIndicator(
    response['chatId'],
    response['userName'],
    response['isTyping'],
  );
});
```

---

### 5. CHAT_MESSAGE_READ (Event ID: 73)

Mark messages as read.

```dart
void markMessagesAsRead({
  required String chatId,
  required List<String> messageIds,
}) {
  final data = {
    'chatId': chatId,
    'messageIds': messageIds,
  };
  
  socket?.emit('73', jsonEncode(data));
}
```

---

## Error Handling

### Connection Errors

```dart
socket?.onConnectError((error) {
  print('Connection error: $error');
  // Implement retry logic
  scheduleReconnect();
});

socket?.onError((error) {
  print('Socket error: $error');
  // Handle error appropriately
});
```

### Timeout Handling

```dart
void emitWithTimeout(String event, dynamic data, {
  Duration timeout = const Duration(seconds: 10),
  required Function() onTimeout,
}) {
  bool responded = false;
  
  socket?.emit(event, data);
  
  Future.delayed(timeout, () {
    if (!responded) {
      onTimeout();
    }
  });
  
  socket?.once(event, (_) {
    responded = true;
  });
}
```

---

## Best Practices

### 1. Connection Management

```dart
class SocketManager {
  IO.Socket? _socket;
  bool _isConnected = false;
  
  void connect() {
    if (_isConnected) return;
    
    _socket?.connect();
  }
  
  void disconnect() {
    _socket?.disconnect();
    _isConnected = false;
  }
  
  void reconnect() {
    disconnect();
    Future.delayed(Duration(seconds: 2), () {
      connect();
    });
  }
}
```

### 2. Event Subscription Management

```dart
class EventSubscriptions {
  final List<String> _subscriptions = [];
  
  void subscribe(IO.Socket socket, String event, Function(dynamic) handler) {
    socket.on(event, handler);
    _subscriptions.add(event);
  }
  
  void unsubscribeAll(IO.Socket socket) {
    for (final event in _subscriptions) {
      socket.off(event);
    }
    _subscriptions.clear();
  }
}
```

### 3. Room Management

```dart
class ProjectRoomManager {
  String? _currentProjectId;
  
  void switchProject(IO.Socket socket, String newProjectId) {
    // Leave current room
    if (_currentProjectId != null) {
      leaveProjectRoom(socket, _currentProjectId!);
    }
    
    // Join new room
    joinProjectRoom(socket, newProjectId);
    _currentProjectId = newProjectId;
  }
  
  void leaveProjectRoom(IO.Socket socket, String projectId) {
    final data = {'id': projectId, 'type': 'leave'};
    socket.emit('21', jsonEncode(data));
  }
  
  void joinProjectRoom(IO.Socket socket, String projectId) {
    final data = {'id': projectId, 'type': 'join'};
    socket.emit('21', jsonEncode(data));
  }
}
```

### 4. Optimistic Updates

```dart
void updateTaskStatusOptimistically({
  required String taskId,
  required String newStatusId,
  required Function() onSuccess,
  required Function() onError,
}) {
  // Update UI immediately
  updateTaskStatusInUI(taskId, newStatusId);
  
  // Send to server
  final data = {
    'task_id': taskId,
    'status_id': newStatusId,
    'team_id': currentTeamId,
  };
  
  socket?.emit('8', jsonEncode(data));
  
  // Listen for confirmation
  socket?.once('8', (response) {
    if (response != null) {
      onSuccess();
    } else {
      // Rollback on failure
      rollbackTaskStatus(taskId);
      onError();
    }
  });
}
```

### 5. Batch Operations

```dart
void batchUpdateTasks(List<TaskUpdate> updates) {
  for (final update in updates) {
    // Add small delay between emissions to avoid overwhelming server
    Future.delayed(
      Duration(milliseconds: 100 * updates.indexOf(update)),
      () => emitTaskUpdate(update),
    );
  }
}
```

---

## Complete Example: Task Management

```dart
class TaskSocketService {
  final IO.Socket socket;
  final StreamController<Task> _taskUpdates = StreamController.broadcast();
  
  Stream<Task> get taskUpdates => _taskUpdates.stream;
  
  TaskSocketService(this.socket) {
    _setupListeners();
  }
  
  void _setupListeners() {
    // Listen for task creation
    socket.on('6', (data) {
      if (data != null) {
        final task = Task.fromJson(data);
        _taskUpdates.add(task);
      }
    });
    
    // Listen for status changes
    socket.on('8', (data) {
      final response = jsonDecode(data);
      // Handle status change
    });
    
    // Listen for project updates
    socket.on('22', (_) {
      // Refresh project data
    });
  }
  
  void createTask({
    required String name,
    required String projectId,
    required String teamId,
  }) {
    final data = {
      'name': name,
      'project_id': projectId,
      'team_id': teamId,
      'sort_order': 0,
    };
    
    socket.emit('6', jsonEncode(data));
  }
  
  void updateTaskStatus({
    required String taskId,
    required String statusId,
    required String teamId,
  }) {
    final data = {
      'task_id': taskId,
      'status_id': statusId,
      'team_id': teamId,
    };
    
    socket.emit('8', jsonEncode(data));
  }
  
  void dispose() {
    _taskUpdates.close();
  }
}
```

---

## Troubleshooting

### Common Issues

1. **Connection fails**
   - Verify session cookie is valid
   - Check network connectivity
   - Ensure correct server URL

2. **Events not received**
   - Verify you've joined the project room
   - Check event ID is correct
   - Ensure listener is registered before emitting

3. **Data not updating**
   - Check JSON encoding/decoding
   - Verify all required fields are present
   - Check server logs for errors

### Debug Mode

```dart
void enableDebugMode(IO.Socket socket) {
  socket.onConnect((_) => print('[Socket] Connected'));
  socket.onDisconnect((_) => print('[Socket] Disconnected'));
  socket.onError((error) => print('[Socket] Error: $error'));
  
  // Log all events
  socket.onAny((event, data) {
    print('[Socket] Event: $event, Data: $data');
  });
}
```

---

## Summary

This guide covers all Socket.IO events in the Worklenz backend. Key points:

- Always authenticate after connecting (Event 0)
- Join project rooms to receive updates (Event 21)
- Use proper JSON encoding for all data
- Handle errors and timeouts gracefully
- Implement optimistic updates for better UX
- Clean up listeners when disposing components

For additional support, refer to the backend source code in `worklenz-backend/src/socket.io/`.
