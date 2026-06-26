# Socket.IO Quick Reference - Flutter/Dart

## Connection Setup

```dart
import 'package:socket_io_client/socket_io_client.dart' as IO;

final socket = IO.io('https://your-api-url.com', {
  'transports': ['websocket', 'polling'],
  'extraHeaders': {'Cookie': sessionCookie},
});

socket.connect();
socket.emit('0', userId); // Authenticate
```

## Event ID Reference

| Event ID | Event Name | Direction | Description |
|----------|-----------|-----------|-------------|
| 0 | LOGIN | Both | Authenticate socket connection |
| 6 | QUICK_TASK | Both | Create new task |
| 8 | TASK_STATUS_CHANGE | Both | Update task status |
| 9 | TASK_PRIORITY_CHANGE | Emit | Update task priority |
| 10 | TASK_NAME_CHANGE | Emit | Update task name |
| 11 | TASK_LABELS_CHANGE | Emit | Update task labels |
| 13 | TASK_END_DATE_CHANGE | Emit | Update task end date |
| 14 | TASK_START_DATE_CHANGE | Emit | Update task start date |
| 15 | TASK_TIME_ESTIMATION_CHANGE | Emit | Update time estimation |
| 16 | TASK_DESCRIPTION_CHANGE | Emit | Update task description |
| 17 | GET_TASK_PROGRESS | Both | Get/receive task progress |
| 18 | TASK_TIMER_START | Emit | Start task timer |
| 19 | TASK_TIMER_STOP | Emit | Stop task timer |
| 20 | TASK_SORT_ORDER_CHANGE | Emit | Reorder tasks |
| 21 | JOIN_OR_LEAVE_PROJECT_ROOM | Both | Join/leave project room |
| 22 | PROJECT_UPDATES_AVAILABLE | Listen | Project has updates |
| 23 | TASK_SUBSCRIBERS_CHANGE | Emit | Subscribe/unsubscribe task |
| 24 | PROJECT_SUBSCRIBERS_CHANGE | Emit | Subscribe/unsubscribe project |
| 25 | TASK_PHASE_CHANGE | Emit | Update task phase |
| 30 | PROJECT_HEALTH_CHANGE | Emit | Update project health |
| 31 | PROJECT_START_DATE_CHANGE | Emit | Update project start date |
| 32 | PROJECT_END_DATE_CHANGE | Emit | Update project end date |
| 33 | PROJECT_STATUS_CHANGE | Emit | Update project status |
| 34 | PROJECT_CATEGORY_CHANGE | Emit | Update project category |
| 54 | TASK_ASSIGNEES_CHANGE | Both | Assign/unassign members |
| 58 | UPDATE_TASK_PROGRESS | Emit | Update task progress % |
| 60 | TASK_PROGRESS_UPDATED | Listen | Task progress changed |
| 61 | GET_TASK_SUBTASKS_COUNT | Emit | Request subtasks count |
| 62 | TASK_SUBTASKS_COUNT | Listen | Receive subtasks count |
| 63 | GET_DONE_STATUSES | Emit+Ack | Get done statuses |
| 69 | CHAT_SEND_MESSAGE | Emit | Send chat message |
| 70 | CHAT_JOIN | Emit | Join chat room |
| 71 | CHAT_LEAVE | Emit | Leave chat room |
| 72 | CHAT_TYPING | Both | Typing indicator |
| 73 | CHAT_MESSAGE_READ | Emit | Mark messages read |

## Common Patterns

### Create Task
```dart
socket.emit('6', jsonEncode({
  'name': 'Task name',
  'project_id': 'uuid',
  'team_id': 'uuid',
}));

socket.on('6', (data) {
  final task = Task.fromJson(data);
});
```

### Update Task Status
```dart
socket.emit('8', jsonEncode({
  'task_id': 'uuid',
  'status_id': 'uuid',
  'team_id': 'uuid',
}));

socket.on('8', (data) {
  // Handle status update
});
```

### Join Project Room
```dart
socket.emit('21', jsonEncode({
  'id': 'project-uuid',
  'type': 'join',
}));

socket.on('22', (_) {
  // Project updates available
});
```

### Update Task Progress
```dart
socket.emit('58', jsonEncode({
  'task_id': 'uuid',
  'progress_value': 75.0,
  'parent_task_id': null,
}));

socket.on('60', (data) {
  if (data['should_prompt_for_done']) {
    // Show done status prompt
  }
});
```

### Assign Team Members
```dart
socket.emit('54', jsonEncode({
  'task_id': 'uuid',
  'team_id': 'uuid',
  'team_member_id': ['uuid1', 'uuid2'],
  'project_id': 'uuid',
  'reporter_id': 'uuid',
  'mode': 0, // 0=assign, 1=unassign
}));
```

### Send Chat Message
```dart
socket.emit('69', jsonEncode({
  'chatId': 'uuid',
  'message': 'Hello!',
  'messageType': 'text',
}));

socket.on('chat:message_received', (data) {
  // New message received
});
```

## Data Formats

### Date Format
```dart
'YYYY-MM-DD' // e.g., '2024-12-31'
```

### Time Estimation
```dart
{
  'hours': 5,
  'minutes': 30
}
```

### Mode Values
```dart
0 // Assign/Subscribe
1 // Unassign/Unsubscribe
```

## Error Handling

```dart
socket.onConnectError((error) {
  print('Connection error: $error');
});

socket.onError((error) {
  print('Socket error: $error');
});

socket.onDisconnect((reason) {
  print('Disconnected: $reason');
  // Implement reconnection logic
});
```

## Best Practices

1. **Always authenticate after connecting** (Event 0)
2. **Join project rooms** before expecting updates (Event 21)
3. **Use JSON encoding** for all complex data
4. **Handle null responses** (indicates failure)
5. **Implement optimistic updates** for better UX
6. **Clean up listeners** when disposing
7. **Implement reconnection logic** for network issues

## Example Service Class

```dart
class SocketService {
  late IO.Socket socket;
  
  void connect(String url, String cookie) {
    socket = IO.io(url, {
      'transports': ['websocket'],
      'extraHeaders': {'Cookie': cookie},
    });
    
    socket.connect();
    socket.onConnect((_) => authenticate());
  }
  
  void authenticate() {
    socket.emit('0', userId);
  }
  
  void joinProject(String projectId) {
    socket.emit('21', jsonEncode({
      'id': projectId,
      'type': 'join',
    }));
  }
  
  void createTask(String name, String projectId, String teamId) {
    socket.emit('6', jsonEncode({
      'name': name,
      'project_id': projectId,
      'team_id': teamId,
    }));
  }
  
  void dispose() {
    socket.disconnect();
    socket.dispose();
  }
}
```

## Debugging

```dart
// Enable debug logging
socket.onAny((event, data) {
  print('[Socket] $event: $data');
});
```

---

For detailed documentation, see [SOCKET_IO_FLUTTER_GUIDE.md](./SOCKET_IO_FLUTTER_GUIDE.md)
