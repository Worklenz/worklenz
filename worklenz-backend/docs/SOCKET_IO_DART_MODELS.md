# Socket.IO Dart Models Reference

This document provides Dart model classes for Socket.IO event payloads.

## Core Models

### Task Model

```dart
class Task {
  final String id;
  final String name;
  final String projectId;
  final String? statusId;
  final String? status;
  final String? colorCode;
  final String? colorCodeDark;
  final String? priorityId;
  final String? priority;
  final String? phaseId;
  final String? phaseName;
  final String? phaseColor;
  final String? description;
  final String? startDate;
  final String? endDate;
  final int? totalMinutes;
  final int sortOrder;
  final double? completeRatio;
  final int? completedCount;
  final int? totalTasksCount;
  final int? subTasksCount;
  final String? parentTaskId;
  final bool isSubTask;
  final DateTime? completedAt;
  final double? progressValue;
  final bool? manualProgress;
  final bool? billable;
  final String? scheduleId;
  final List<TaskAssignee>? assignees;
  final List<TaskLabel>? labels;
  
  Task({
    required this.id,
    required this.name,
    required this.projectId,
    this.statusId,
    this.status,
    this.colorCode,
    this.colorCodeDark,
    this.priorityId,
    this.priority,
    this.phaseId,
    this.phaseName,
    this.phaseColor,
    this.description,
    this.startDate,
    this.endDate,
    this.totalMinutes,
    this.sortOrder = 0,
    this.completeRatio,
    this.completedCount,
    this.totalTasksCount,
    this.subTasksCount,
    this.parentTaskId,
    this.isSubTask = false,
    this.completedAt,
    this.progressValue,
    this.manualProgress,
    this.billable,
    this.scheduleId,
    this.assignees,
    this.labels,
  });
  
  factory Task.fromJson(Map<String, dynamic> json) {
    return Task(
      id: json['id'] as String,
      name: json['name'] as String,
      projectId: json['project_id'] as String,
      statusId: json['status_id'] as String?,
      status: json['status'] as String?,
      colorCode: json['color_code'] as String?,
      colorCodeDark: json['color_code_dark'] as String?,
      priorityId: json['priority_id'] as String?,
      priority: json['priority'] as String?,
      phaseId: json['phase_id'] as String?,
      phaseName: json['phase_name'] as String?,
      phaseColor: json['phase_color'] as String?,
      description: json['description'] as String?,
      startDate: json['start_date'] as String?,
      endDate: json['end_date'] as String?,
      totalMinutes: json['total_minutes'] as int?,
      sortOrder: json['sort_order'] as int? ?? 0,
      completeRatio: (json['complete_ratio'] as num?)?.toDouble(),
      completedCount: json['completed_count'] as int?,
      totalTasksCount: json['total_tasks_count'] as int?,
      subTasksCount: json['sub_tasks_count'] as int?,
      parentTaskId: json['parent_task_id'] as String?,
      isSubTask: json['is_sub_task'] as bool? ?? false,
      completedAt: json['completed_at'] != null 
          ? DateTime.parse(json['completed_at'] as String)
          : null,
      progressValue: (json['progress_value'] as num?)?.toDouble(),
      manualProgress: json['manual_progress'] as bool?,
      billable: json['billable'] as bool?,
      scheduleId: json['schedule_id'] as String?,
      assignees: json['assignees'] != null
          ? (json['assignees'] as List)
              .map((a) => TaskAssignee.fromJson(a))
              .toList()
          : null,
      labels: json['labels'] != null
          ? (json['labels'] as List)
              .map((l) => TaskLabel.fromJson(l))
              .toList()
          : null,
    );
  }
  
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'project_id': projectId,
      'status_id': statusId,
      'priority_id': priorityId,
      'phase_id': phaseId,
      'description': description,
      'start_date': startDate,
      'end_date': endDate,
      'total_minutes': totalMinutes,
      'sort_order': sortOrder,
      'parent_task_id': parentTaskId,
      'progress_value': progressValue,
      'billable': billable,
      'schedule_id': scheduleId,
    };
  }
}
```

### Task Assignee Model

```dart
class TaskAssignee {
  final String? teamMemberId;
  final String? projectMemberId;
  final String? userId;
  final String? name;
  final String? avatarUrl;
  final String? colorCode;
  
  TaskAssignee({
    this.teamMemberId,
    this.projectMemberId,
    this.userId,
    this.name,
    this.avatarUrl,
    this.colorCode,
  });
  
  factory TaskAssignee.fromJson(Map<String, dynamic> json) {
    return TaskAssignee(
      teamMemberId: json['team_member_id'] as String?,
      projectMemberId: json['project_member_id'] as String?,
      userId: json['user_id'] as String?,
      name: json['name'] as String?,
      avatarUrl: json['avatar_url'] as String?,
      colorCode: json['color_code'] as String?,
    );
  }
}
```

### Task Label Model

```dart
class TaskLabel {
  final String id;
  final String name;
  final String colorCode;
  
  TaskLabel({
    required this.id,
    required this.name,
    required this.colorCode,
  });
  
  factory TaskLabel.fromJson(Map<String, dynamic> json) {
    return TaskLabel(
      id: json['id'] as String,
      name: json['name'] as String,
      colorCode: json['color_code'] as String,
    );
  }
  
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'color_code': colorCode,
    };
  }
}
```

### Task Status Model

```dart
class TaskStatus {
  final String id;
  final String name;
  final String? colorCode;
  final int sortOrder;
  final TaskStatusCategory? category;
  
  TaskStatus({
    required this.id,
    required this.name,
    this.colorCode,
    required this.sortOrder,
    this.category,
  });
  
  factory TaskStatus.fromJson(Map<String, dynamic> json) {
    return TaskStatus(
      id: json['id'] as String,
      name: json['name'] as String,
      colorCode: json['color_code'] as String?,
      sortOrder: json['sort_order'] as int,
      category: json['category'] != null
          ? TaskStatusCategory.fromJson(json['category'])
          : null,
    );
  }
}

class TaskStatusCategory {
  final String id;
  final String name;
  final bool isDone;
  final String? colorCode;
  
  TaskStatusCategory({
    required this.id,
    required this.name,
    required this.isDone,
    this.colorCode,
  });
  
  factory TaskStatusCategory.fromJson(Map<String, dynamic> json) {
    return TaskStatusCategory(
      id: json['id'] as String,
      name: json['name'] as String,
      isDone: json['is_done'] as bool,
      colorCode: json['color_code'] as String?,
    );
  }
}
```

### Task Priority Model

```dart
class TaskPriority {
  final String id;
  final String name;
  final String? colorCode;
  final int value;
  
  TaskPriority({
    required this.id,
    required this.name,
    this.colorCode,
    required this.value,
  });
  
  factory TaskPriority.fromJson(Map<String, dynamic> json) {
    return TaskPriority(
      id: json['id'] as String,
      name: json['name'] as String,
      colorCode: json['color_code'] as String?,
      value: json['value'] as int,
    );
  }
}
```

### Task Phase Model

```dart
class TaskPhase {
  final String id;
  final String name;
  final String? colorCode;
  final String? startDate;
  final String? endDate;
  
  TaskPhase({
    required this.id,
    required this.name,
    this.colorCode,
    this.startDate,
    this.endDate,
  });
  
  factory TaskPhase.fromJson(Map<String, dynamic> json) {
    return TaskPhase(
      id: json['id'] as String,
      name: json['name'] as String,
      colorCode: json['color_code'] as String?,
      startDate: json['start_date'] as String?,
      endDate: json['end_date'] as String?,
    );
  }
}
```

## Socket Event Request Models

### Create Task Request

```dart
class CreateTaskRequest {
  final String name;
  final String projectId;
  final String teamId;
  final String? statusId;
  final String? priorityId;
  final String? phaseId;
  final String? endDate;
  final int totalHours;
  final int totalMinutes;
  final int sortOrder;
  
  CreateTaskRequest({
    required this.name,
    required this.projectId,
    required this.teamId,
    this.statusId,
    this.priorityId,
    this.phaseId,
    this.endDate,
    this.totalHours = 0,
    this.totalMinutes = 0,
    this.sortOrder = 0,
  });
  
  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'project_id': projectId,
      'team_id': teamId,
      'status_id': statusId,
      'priority_id': priorityId,
      'phase_id': phaseId,
      'end_date': endDate,
      'total_hours': totalHours,
      'total_minutes': totalMinutes,
      'sort_order': sortOrder,
    };
  }
}
```

### Update Task Status Request

```dart
class UpdateTaskStatusRequest {
  final String taskId;
  final String statusId;
  final String teamId;
  final String? parentTask;
  
  UpdateTaskStatusRequest({
    required this.taskId,
    required this.statusId,
    required this.teamId,
    this.parentTask,
  });
  
  Map<String, dynamic> toJson() {
    return {
      'task_id': taskId,
      'status_id': statusId,
      'team_id': teamId,
      'parent_task': parentTask,
    };
  }
}
```

### Update Task Assignees Request

```dart
class UpdateTaskAssigneesRequest {
  final String taskId;
  final String teamId;
  final List<String> teamMemberIds;
  final String projectId;
  final String reporterId;
  final int mode; // 0 = assign, 1 = unassign
  
  UpdateTaskAssigneesRequest({
    required this.taskId,
    required this.teamId,
    required this.teamMemberIds,
    required this.projectId,
    required this.reporterId,
    required this.mode,
  });
  
  Map<String, dynamic> toJson() {
    return {
      'task_id': taskId,
      'team_id': teamId,
      'team_member_id': teamMemberIds,
      'project_id': projectId,
      'reporter_id': reporterId,
      'mode': mode,
    };
  }
}
```

### Update Task Progress Request

```dart
class UpdateTaskProgressRequest {
  final String taskId;
  final double progressValue; // 0-100
  final String? parentTaskId;
  
  UpdateTaskProgressRequest({
    required this.taskId,
    required this.progressValue,
    this.parentTaskId,
  });
  
  Map<String, dynamic> toJson() {
    return {
      'task_id': taskId,
      'progress_value': progressValue,
      'parent_task_id': parentTaskId,
    };
  }
}
```

### Join Project Room Request

```dart
class JoinProjectRoomRequest {
  final String projectId;
  final String type; // 'join' or 'leave'
  
  JoinProjectRoomRequest({
    required this.projectId,
    required this.type,
  });
  
  Map<String, dynamic> toJson() {
    return {
      'id': projectId,
      'type': type,
    };
  }
}
```

## Socket Event Response Models

### Task Status Change Response

```dart
class TaskStatusChangeResponse {
  final String id;
  final String? parentTask;
  final String statusId;
  final String colorCode;
  final String colorCodeDark;
  final double? completeRatio;
  final int? completedCount;
  final int? totalTasksCount;
  final DateTime? completedAt;
  final TaskStatusCategory? statusCategory;
  final bool completedDeps;
  
  TaskStatusChangeResponse({
    required this.id,
    this.parentTask,
    required this.statusId,
    required this.colorCode,
    required this.colorCodeDark,
    this.completeRatio,
    this.completedCount,
    this.totalTasksCount,
    this.completedAt,
    this.statusCategory,
    required this.completedDeps,
  });
  
  factory TaskStatusChangeResponse.fromJson(Map<String, dynamic> json) {
    return TaskStatusChangeResponse(
      id: json['id'] as String,
      parentTask: json['parent_task'] as String?,
      statusId: json['status_id'] as String,
      colorCode: json['color_code'] as String,
      colorCodeDark: json['color_code_dark'] as String,
      completeRatio: (json['complete_ratio'] as num?)?.toDouble(),
      completedCount: json['completed_count'] as int?,
      totalTasksCount: json['total_tasks_count'] as int?,
      completedAt: json['completed_at'] != null
          ? DateTime.parse(json['completed_at'] as String)
          : null,
      statusCategory: json['statusCategory'] != null
          ? TaskStatusCategory.fromJson(json['statusCategory'])
          : null,
      completedDeps: json['completed_deps'] as bool,
    );
  }
}
```

### Task Progress Updated Response

```dart
class TaskProgressUpdatedResponse {
  final String taskId;
  final double progressValue;
  final bool shouldPromptForDone;
  
  TaskProgressUpdatedResponse({
    required this.taskId,
    required this.progressValue,
    required this.shouldPromptForDone,
  });
  
  factory TaskProgressUpdatedResponse.fromJson(Map<String, dynamic> json) {
    return TaskProgressUpdatedResponse(
      taskId: json['task_id'] as String,
      progressValue: (json['progress_value'] as num).toDouble(),
      shouldPromptForDone: json['should_prompt_for_done'] as bool,
    );
  }
}
```

### Task Subtasks Count Response

```dart
class TaskSubtasksCountResponse {
  final String taskId;
  final int count;
  
  TaskSubtasksCountResponse({
    required this.taskId,
    required this.count,
  });
  
  factory TaskSubtasksCountResponse.fromJson(Map<String, dynamic> json) {
    return TaskSubtasksCountResponse(
      taskId: json['task_id'] as String,
      count: json['count'] as int,
    );
  }
}
```

## Chat Models

### Chat Message Model

```dart
class ChatMessage {
  final String id;
  final String chatId;
  final String senderId;
  final String senderName;
  final String senderType; // 'team_member' or 'client'
  final String message;
  final String messageType; // 'text', 'file', etc.
  final String? fileUrl;
  final DateTime createdAt;
  final bool isMe;
  
  ChatMessage({
    required this.id,
    required this.chatId,
    required this.senderId,
    required this.senderName,
    required this.senderType,
    required this.message,
    required this.messageType,
    this.fileUrl,
    required this.createdAt,
    required this.isMe,
  });
  
  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    return ChatMessage(
      id: json['id'] as String,
      chatId: json['chatId'] as String,
      senderId: json['senderId'] as String,
      senderName: json['senderName'] as String,
      senderType: json['senderType'] as String,
      message: json['message'] as String,
      messageType: json['messageType'] as String,
      fileUrl: json['fileUrl'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
      isMe: json['isMe'] as bool,
    );
  }
}
```

### Send Chat Message Request

```dart
class SendChatMessageRequest {
  final String chatId;
  final String message;
  final String messageType;
  final String? fileUrl;
  final String? tempId;
  
  SendChatMessageRequest({
    required this.chatId,
    required this.message,
    this.messageType = 'text',
    this.fileUrl,
    this.tempId,
  });
  
  Map<String, dynamic> toJson() {
    return {
      'chatId': chatId,
      'message': message,
      'messageType': messageType,
      'fileUrl': fileUrl,
      'tempId': tempId,
    };
  }
}
```

## Project Models

### Project Member Model

```dart
class ProjectMember {
  final String name;
  final String? avatarUrl;
  final String colorCode;
  
  ProjectMember({
    required this.name,
    this.avatarUrl,
    required this.colorCode,
  });
  
  factory ProjectMember.fromJson(Map<String, dynamic> json) {
    return ProjectMember(
      name: json['name'] as String,
      avatarUrl: json['avatar_url'] as String?,
      colorCode: json['color_code'] as String,
    );
  }
}
```

## Utility Extensions

### JSON Encoding Helper

```dart
import 'dart:convert';

extension SocketEmitExtension on Socket {
  void emitJson(String event, Map<String, dynamic> data) {
    emit(event, jsonEncode(data));
  }
  
  void emitModel(String event, dynamic model) {
    if (model is Map<String, dynamic>) {
      emitJson(event, model);
    } else if (model.toJson != null) {
      emitJson(event, model.toJson());
    } else {
      emit(event, model);
    }
  }
}
```

### Date Formatting Helper

```dart
extension DateFormatExtension on DateTime {
  String toSocketDateFormat() {
    return '${year.toString().padLeft(4, '0')}-'
           '${month.toString().padLeft(2, '0')}-'
           '${day.toString().padLeft(2, '0')}';
  }
}

// Usage
final date = DateTime.now();
final formattedDate = date.toSocketDateFormat(); // '2024-12-31'
```

## Complete Example Usage

```dart
import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'dart:convert';

class TaskSocketManager {
  final IO.Socket socket;
  
  TaskSocketManager(this.socket);
  
  // Create task
  void createTask(CreateTaskRequest request) {
    socket.emitJson('6', request.toJson());
  }
  
  // Update task status
  void updateTaskStatus(UpdateTaskStatusRequest request) {
    socket.emitJson('8', request.toJson());
  }
  
  // Update task progress
  void updateTaskProgress(UpdateTaskProgressRequest request) {
    socket.emitJson('58', request.toJson());
  }
  
  // Listen for task creation
  void onTaskCreated(Function(Task) callback) {
    socket.on('6', (data) {
      if (data != null) {
        final task = Task.fromJson(data);
        callback(task);
      }
    });
  }
  
  // Listen for status changes
  void onTaskStatusChanged(Function(TaskStatusChangeResponse) callback) {
    socket.on('8', (data) {
      final response = TaskStatusChangeResponse.fromJson(jsonDecode(data));
      callback(response);
    });
  }
  
  // Listen for progress updates
  void onTaskProgressUpdated(Function(TaskProgressUpdatedResponse) callback) {
    socket.on('60', (data) {
      final response = TaskProgressUpdatedResponse.fromJson(jsonDecode(data));
      callback(response);
    });
  }
}
```

---

These models provide type-safe interfaces for all Socket.IO events in the Worklenz application.
