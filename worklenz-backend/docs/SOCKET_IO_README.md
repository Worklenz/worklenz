# Worklenz Socket.IO Documentation

Complete documentation for implementing Socket.IO real-time features in Flutter/Dart mobile applications.

## 📚 Documentation Files

### 1. [SOCKET_IO_FLUTTER_GUIDE.md](./SOCKET_IO_FLUTTER_GUIDE.md)
**Comprehensive implementation guide** covering:
- Connection setup and authentication
- All 75+ socket events with detailed examples
- Request/response formats
- Error handling strategies
- Best practices and patterns
- Complete code examples

**Use this when:** You need detailed information about specific events or implementation patterns.

### 2. [SOCKET_IO_QUICK_REFERENCE.md](./SOCKET_IO_QUICK_REFERENCE.md)
**Quick reference sheet** with:
- Event ID mapping table
- Common usage patterns
- Code snippets for frequent operations
- Data format specifications
- Example service class

**Use this when:** You need quick lookup of event IDs or common patterns.

### 3. [SOCKET_IO_DART_MODELS.md](./SOCKET_IO_DART_MODELS.md)
**Type-safe Dart models** including:
- Complete model classes for all entities
- Request/response models
- JSON serialization/deserialization
- Utility extensions
- Usage examples

**Use this when:** You need to implement type-safe models in your Flutter app.

## 🚀 Quick Start

### 1. Install Dependencies

```yaml
# pubspec.yaml
dependencies:
  socket_io_client: ^2.0.3+1
```

### 2. Basic Setup

```dart
import 'package:socket_io_client/socket_io_client.dart' as IO;

// Connect to server
final socket = IO.io('https://your-api-url.com', {
  'transports': ['websocket', 'polling'],
  'extraHeaders': {
    'Cookie': sessionCookie, // From login
  },
});

socket.connect();

// Authenticate
socket.onConnect((_) {
  socket.emit('0', userId); // Event 0 = LOGIN
});
```

### 3. Common Operations

```dart
// Create a task
socket.emit('6', jsonEncode({
  'name': 'New Task',
  'project_id': projectId,
  'team_id': teamId,
}));

// Listen for task creation
socket.on('6', (data) {
  final task = Task.fromJson(data);
  print('Task created: ${task.id}');
});

// Join project room for real-time updates
socket.emit('21', jsonEncode({
  'id': projectId,
  'type': 'join',
}));

// Listen for project updates
socket.on('22', (_) {
  print('Project has updates');
  refreshProjectData();
});
```

## 📋 Event Categories

### Task Management (Events 6-20, 52-63)
- Create, update, delete tasks
- Change status, priority, assignees
- Update progress and time tracking
- Manage labels and phases

### Project Management (Events 21-35)
- Join/leave project rooms
- Update project properties
- Manage project subscriptions
- Handle project categories

### Real-time Collaboration (Events 2-5, 29)
- Notifications and invitations
- Comments and updates
- Team member changes
- Activity tracking

### Client Portal & Chat (Events 64-74)
- Chat messaging
- Typing indicators
- Read receipts
- Client notifications

## 🔑 Key Concepts

### Event IDs
All events use numeric IDs (0-74). Always use the ID as a string when emitting/listening:
```dart
socket.emit('6', data);  // ✅ Correct
socket.on('6', handler);  // ✅ Correct
```

### JSON Encoding
Complex data must be JSON-encoded:
```dart
socket.emit('8', jsonEncode({  // ✅ Correct
  'task_id': taskId,
  'status_id': statusId,
}));
```

### Project Rooms
Join project rooms to receive real-time updates:
```dart
// Join room
socket.emit('21', jsonEncode({'id': projectId, 'type': 'join'}));

// Now you'll receive updates via event 22
socket.on('22', (_) => refreshData());

// Leave when done
socket.emit('21', jsonEncode({'id': projectId, 'type': 'leave'}));
```

### Authentication
Always authenticate after connecting:
```dart
socket.onConnect((_) {
  socket.emit('0', userId); // Must be first action
});
```

## 🎯 Common Use Cases

### Creating and Updating Tasks

```dart
// Create task
void createTask(String name, String projectId, String teamId) {
  socket.emit('6', jsonEncode({
    'name': name,
    'project_id': projectId,
    'team_id': teamId,
  }));
}

// Update status
void updateStatus(String taskId, String statusId, String teamId) {
  socket.emit('8', jsonEncode({
    'task_id': taskId,
    'status_id': statusId,
    'team_id': teamId,
  }));
}

// Update progress
void updateProgress(String taskId, double progress) {
  socket.emit('58', jsonEncode({
    'task_id': taskId,
    'progress_value': progress,
  }));
}
```

### Managing Assignees

```dart
void assignMembers(String taskId, List<String> memberIds) {
  socket.emit('54', jsonEncode({
    'task_id': taskId,
    'team_id': teamId,
    'team_member_id': memberIds,
    'project_id': projectId,
    'reporter_id': currentUserId,
    'mode': 0, // 0 = assign
  }));
}
```

### Real-time Chat

```dart
// Join chat
socket.emit('70', jsonEncode({'chatId': chatId}));

// Send message
socket.emit('69', jsonEncode({
  'chatId': chatId,
  'message': 'Hello!',
  'messageType': 'text',
}));

// Listen for messages
socket.on('chat:message_received', (data) {
  final message = ChatMessage.fromJson(data);
  displayMessage(message);
});
```

## ⚠️ Important Notes

### Session Management
- Socket connections use HTTP session cookies
- Obtain session cookie from login API
- Include cookie in socket connection headers
- Re-authenticate if session expires

### Error Handling
```dart
socket.onConnectError((error) {
  print('Connection error: $error');
  // Implement retry logic
});

socket.onError((error) {
  print('Socket error: $error');
});

socket.onDisconnect((reason) {
  print('Disconnected: $reason');
  // Implement reconnection
});
```

### Performance Tips
1. **Join only necessary project rooms** - Don't join all projects at once
2. **Clean up listeners** - Remove listeners when disposing widgets
3. **Batch operations** - Add delays between rapid emissions
4. **Optimistic updates** - Update UI immediately, rollback on failure
5. **Debounce rapid changes** - Avoid overwhelming the server

### Common Pitfalls

❌ **Don't do this:**
```dart
// Forgetting to authenticate
socket.connect(); // Missing authentication

// Not encoding JSON
socket.emit('8', {'task_id': id}); // Should be jsonEncode()

// Not joining project room
socket.on('22', handler); // Won't receive updates without joining
```

✅ **Do this:**
```dart
// Proper authentication
socket.onConnect((_) => socket.emit('0', userId));

// Proper JSON encoding
socket.emit('8', jsonEncode({'task_id': id}));

// Join project room first
socket.emit('21', jsonEncode({'id': projectId, 'type': 'join'}));
socket.on('22', handler);
```

## 🔧 Debugging

### Enable Debug Logging

```dart
socket.onAny((event, data) {
  print('[Socket] Event: $event');
  print('[Socket] Data: $data');
});
```

### Check Connection Status

```dart
print('Connected: ${socket.connected}');
print('Disconnected: ${socket.disconnected}');
```

### Monitor Events

```dart
socket.onConnect((_) => print('✅ Connected'));
socket.onDisconnect((_) => print('❌ Disconnected'));
socket.onConnectError((e) => print('⚠️ Connection Error: $e'));
socket.onError((e) => print('⚠️ Error: $e'));
```

## 📖 Additional Resources

### Backend Source Code
- Socket.IO implementation: `worklenz-backend/src/socket.io/`
- Event definitions: `worklenz-backend/src/socket.io/events.ts`
- Command handlers: `worklenz-backend/src/socket.io/commands/`

### Related Documentation
- [Backend API Documentation](./BACKEND_DEPLOYMENT_GUIDE.md)
- [Authentication Guide](./APPLE_SIGN_IN_IMPLEMENTATION_GUIDE.md)
- [Task Management Guide](./enhanced-task-management-technical-guide.md)

## 🤝 Support

For issues or questions:
1. Check the comprehensive guide for detailed information
2. Review the quick reference for common patterns
3. Examine the Dart models for type definitions
4. Inspect backend source code for implementation details

## 📝 Version Information

- **Socket.IO Client Version**: 2.0.3+1 (Flutter)
- **Socket.IO Server Version**: Compatible with Node.js Socket.IO 4.x
- **Last Updated**: December 2024

---

**Happy coding! 🚀**

For detailed implementation examples, see [SOCKET_IO_FLUTTER_GUIDE.md](./SOCKET_IO_FLUTTER_GUIDE.md)
