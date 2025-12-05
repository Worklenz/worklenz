# Socket.IO Troubleshooting Guide

Common issues and solutions when implementing Socket.IO in Flutter/Dart applications.

## 🔴 Connection Issues

### Issue: Socket won't connect

**Symptoms:**
- `onConnect` never fires
- Connection timeout
- `onConnectError` fires immediately

**Solutions:**

1. **Check server URL**
```dart
// ❌ Wrong
final socket = IO.io('http://localhost:3000');

// ✅ Correct
final socket = IO.io('https://api.worklenz.com');
```

2. **Verify session cookie**
```dart
// Make sure you have a valid session cookie from login
final cookie = await getSessionCookie(); // From login response
final socket = IO.io(baseUrl, {
  'extraHeaders': {'Cookie': cookie},
});
```

3. **Check transport configuration**
```dart
// Try with explicit transports
final socket = IO.io(baseUrl, {
  'transports': ['websocket', 'polling'],
  'autoConnect': false,
});
socket.connect();
```

4. **Enable debug logging**
```dart
socket.onAny((event, data) {
  print('[Socket] $event: $data');
});
```

---

### Issue: Connection drops frequently

**Symptoms:**
- `onDisconnect` fires unexpectedly
- Connection unstable
- Frequent reconnections

**Solutions:**

1. **Implement reconnection logic**
```dart
socket.onDisconnect((reason) {
  print('Disconnected: $reason');
  if (reason == 'io server disconnect') {
    // Server disconnected, reconnect manually
    socket.connect();
  }
  // Otherwise, socket will auto-reconnect
});
```

2. **Check network stability**
```dart
import 'package:connectivity_plus/connectivity_plus.dart';

Connectivity().onConnectivityChanged.listen((result) {
  if (result == ConnectivityResult.none) {
    socket.disconnect();
  } else {
    socket.connect();
  }
});
```

3. **Increase timeout**
```dart
final socket = IO.io(baseUrl, {
  'timeout': 20000, // 20 seconds
  'reconnectionDelay': 2000,
  'reconnectionAttempts': 5,
});
```

---

### Issue: "Session expired" or authentication fails

**Symptoms:**
- Socket connects but events don't work
- Server returns authentication errors
- User data not available

**Solutions:**

1. **Authenticate immediately after connection**
```dart
socket.onConnect((_) {
  print('Connected, authenticating...');
  socket.emit('0', userId); // LOGIN event
});

socket.on('0', (_) {
  print('Authentication successful');
});
```

2. **Refresh session cookie**
```dart
// If session expires, get new cookie
if (sessionExpired) {
  final newCookie = await refreshSession();
  socket.disconnect();
  socket = IO.io(baseUrl, {
    'extraHeaders': {'Cookie': newCookie},
  });
  socket.connect();
}
```

3. **Check cookie format**
```dart
// Ensure cookie includes session ID
// Format: connect.sid=s%3A<session-id>.<signature>
print('Cookie: $cookie');
```

---

## 🔴 Event Issues

### Issue: Events not being received

**Symptoms:**
- Emit works but no response
- Listener never fires
- Other users see updates but you don't

**Solutions:**

1. **Verify event ID**
```dart
// ❌ Wrong - using name instead of ID
socket.on('TASK_STATUS_CHANGE', handler);

// ✅ Correct - using numeric ID as string
socket.on('8', handler);
```

2. **Check if you joined the project room**
```dart
// Must join room to receive project updates
socket.emit('21', jsonEncode({
  'id': projectId,
  'type': 'join',
}));

// Now you'll receive updates
socket.on('22', (_) {
  print('Project updates available');
});
```

3. **Ensure listener is registered before emitting**
```dart
// ✅ Correct order
socket.on('6', (data) {
  print('Task created: $data');
});

socket.emit('6', jsonEncode({
  'name': 'New Task',
  'project_id': projectId,
  'team_id': teamId,
}));
```

4. **Check for null responses**
```dart
socket.on('6', (data) {
  if (data == null) {
    print('Task creation failed');
    return;
  }
  final task = Task.fromJson(data);
});
```

---

### Issue: JSON parsing errors

**Symptoms:**
- `FormatException: Unexpected character`
- Type cast errors
- Null reference errors

**Solutions:**

1. **Check if data needs decoding**
```dart
// Some events return already-parsed JSON
socket.on('6', (data) {
  // data is already a Map, don't decode
  final task = Task.fromJson(data);
});

// Some events return JSON strings
socket.on('8', (data) {
  // data is a String, decode first
  final response = jsonDecode(data);
});
```

2. **Handle null values**
```dart
factory Task.fromJson(Map<String, dynamic> json) {
  return Task(
    id: json['id'] as String,
    name: json['name'] as String,
    statusId: json['status_id'] as String?, // Nullable
    priority: json['priority'] as String?,
  );
}
```

3. **Validate data before parsing**
```dart
socket.on('6', (data) {
  if (data == null) {
    print('No data received');
    return;
  }
  
  try {
    final task = Task.fromJson(data);
    handleTask(task);
  } catch (e) {
    print('Parse error: $e');
    print('Data: $data');
  }
});
```

---

### Issue: Events emitted but not processed by server

**Symptoms:**
- No response from server
- No error messages
- Silent failures

**Solutions:**

1. **Verify JSON encoding**
```dart
// ❌ Wrong - not encoded
socket.emit('8', {
  'task_id': taskId,
  'status_id': statusId,
});

// ✅ Correct - properly encoded
socket.emit('8', jsonEncode({
  'task_id': taskId,
  'status_id': statusId,
  'team_id': teamId, // Don't forget required fields
}));
```

2. **Check required fields**
```dart
// Each event has required fields
// Example: TASK_STATUS_CHANGE requires:
socket.emit('8', jsonEncode({
  'task_id': taskId,      // Required
  'status_id': statusId,  // Required
  'team_id': teamId,      // Required
  'parent_task': null,    // Optional
}));
```

3. **Verify data types**
```dart
// Ensure correct types
socket.emit('58', jsonEncode({
  'task_id': taskId,           // String
  'progress_value': 75.5,      // double, not int
  'parent_task_id': null,      // String or null
}));
```

---

## 🔴 Project Room Issues

### Issue: Not receiving project updates

**Symptoms:**
- Event 22 never fires
- Other users see changes but you don't
- Updates only appear after refresh

**Solutions:**

1. **Join the project room**
```dart
void openProject(String projectId) {
  // Join room first
  socket.emit('21', jsonEncode({
    'id': projectId,
    'type': 'join',
  }));
  
  // Then listen for updates
  socket.on('22', (_) {
    refreshProjectData();
  });
}
```

2. **Leave previous room when switching projects**
```dart
void switchProject(String newProjectId) {
  // Leave current room
  if (currentProjectId != null) {
    socket.emit('21', jsonEncode({
      'id': currentProjectId,
      'type': 'leave',
    }));
  }
  
  // Join new room
  socket.emit('21', jsonEncode({
    'id': newProjectId,
    'type': 'join',
  }));
  
  currentProjectId = newProjectId;
}
```

3. **Verify room membership**
```dart
socket.on('21', (data) {
  // This event returns current room members
  final members = List<Map<String, dynamic>>.from(data);
  print('Room members: ${members.length}');
});
```

---

## 🔴 Performance Issues

### Issue: App becomes slow or unresponsive

**Symptoms:**
- UI freezes
- High memory usage
- Battery drain

**Solutions:**

1. **Limit room memberships**
```dart
// ❌ Don't join all projects
for (final project in allProjects) {
  socket.emit('21', jsonEncode({'id': project.id, 'type': 'join'}));
}

// ✅ Only join active project
socket.emit('21', jsonEncode({'id': activeProjectId, 'type': 'join'}));
```

2. **Debounce rapid updates**
```dart
import 'package:rxdart/rxdart.dart';

final _updateSubject = PublishSubject<String>();

_updateSubject
  .debounceTime(Duration(milliseconds: 300))
  .listen((taskId) {
    // Update UI
  });

socket.on('22', (_) {
  _updateSubject.add(projectId);
});
```

3. **Clean up listeners**
```dart
@override
void dispose() {
  // Remove all listeners
  socket.off('6');
  socket.off('8');
  socket.off('22');
  
  // Leave rooms
  socket.emit('21', jsonEncode({
    'id': projectId,
    'type': 'leave',
  }));
  
  super.dispose();
}
```

4. **Batch operations**
```dart
// ❌ Don't emit rapidly
for (final task in tasks) {
  socket.emit('8', jsonEncode({...}));
}

// ✅ Add delays
for (int i = 0; i < tasks.length; i++) {
  await Future.delayed(Duration(milliseconds: 100));
  socket.emit('8', jsonEncode({...}));
}
```

---

## 🔴 Data Synchronization Issues

### Issue: UI shows stale data

**Symptoms:**
- Changes not reflected immediately
- Inconsistent state between users
- Data conflicts

**Solutions:**

1. **Implement optimistic updates**
```dart
void updateTaskStatus(String taskId, String newStatusId) {
  // Update UI immediately
  setState(() {
    task.statusId = newStatusId;
  });
  
  // Send to server
  socket.emit('8', jsonEncode({
    'task_id': taskId,
    'status_id': newStatusId,
    'team_id': teamId,
  }));
  
  // Listen for confirmation
  socket.once('8', (data) {
    if (data == null) {
      // Rollback on failure
      setState(() {
        task.statusId = oldStatusId;
      });
      showError('Failed to update status');
    }
  });
}
```

2. **Handle project updates**
```dart
socket.on('22', (_) {
  // Refresh data when project updates
  fetchProjectData();
});
```

3. **Sync on reconnection**
```dart
socket.onConnect((_) {
  // Re-authenticate
  socket.emit('0', userId);
  
  // Re-join rooms
  if (currentProjectId != null) {
    socket.emit('21', jsonEncode({
      'id': currentProjectId,
      'type': 'join',
    }));
  }
  
  // Refresh data
  refreshAllData();
});
```

---

## 🔴 Chat Issues

### Issue: Messages not sending/receiving

**Symptoms:**
- Messages don't appear
- Typing indicators don't work
- Read receipts fail

**Solutions:**

1. **Join chat room first**
```dart
void openChat(String chatId) {
  // Join chat room
  socket.emit('70', jsonEncode({'chatId': chatId}));
  
  // Listen for messages
  socket.on('chat:message_received', (data) {
    final message = ChatMessage.fromJson(data);
    addMessage(message);
  });
}
```

2. **Handle message confirmation**
```dart
void sendMessage(String chatId, String message) {
  final tempId = Uuid().v4();
  
  // Add to UI optimistically
  addMessageToUI(tempId, message);
  
  // Send to server
  socket.emit('69', jsonEncode({
    'chatId': chatId,
    'message': message,
    'messageType': 'text',
    'tempId': tempId,
  }));
  
  // Listen for confirmation
  socket.on('chat:message_sent', (data) {
    final response = jsonDecode(data);
    if (response['success']) {
      updateMessageId(tempId, response['messageId']);
    } else {
      removeMessage(tempId);
      showError(response['error']);
    }
  });
}
```

3. **Leave chat when done**
```dart
@override
void dispose() {
  socket.emit('71', jsonEncode({'chatId': chatId}));
  socket.off('chat:message_received');
  socket.off('chat:message_sent');
  super.dispose();
}
```

---

## 🔴 Progress Tracking Issues

### Issue: Task progress not updating correctly

**Symptoms:**
- Progress percentage wrong
- Parent task progress not updating
- "Done" prompt not appearing

**Solutions:**

1. **Update progress correctly**
```dart
void updateProgress(String taskId, double progress) {
  socket.emit('58', jsonEncode({
    'task_id': taskId,
    'progress_value': progress, // 0-100
    'parent_task_id': parentTaskId,
  }));
}

// Listen for update
socket.on('60', (data) {
  final response = TaskProgressUpdatedResponse.fromJson(data);
  
  // Update UI
  updateTaskProgress(response.taskId, response.progressValue);
  
  // Show done prompt if needed
  if (response.shouldPromptForDone) {
    showDoneStatusPrompt(response.taskId);
  }
});
```

2. **Get done statuses**
```dart
void showDoneStatusPrompt(String taskId) {
  socket.emitWithAck('63', projectId, ack: (statuses) {
    final doneStatuses = (statuses as List)
        .map((s) => TaskStatus.fromJson(s))
        .toList();
    
    showStatusPicker(taskId, doneStatuses);
  });
}
```

3. **Handle parent task updates**
```dart
// When subtask progress changes, parent updates automatically
socket.on('60', (data) {
  final response = TaskProgressUpdatedResponse.fromJson(data);
  
  // Update both task and parent if exists
  updateTaskProgress(response.taskId, response.progressValue);
  
  // Parent task will receive its own update event
});
```

---

## 🛠️ Debugging Tools

### Enable Comprehensive Logging

```dart
class SocketDebugger {
  static void enable(IO.Socket socket) {
    // Connection events
    socket.onConnect((_) {
      print('🟢 [Socket] Connected');
      print('   Socket ID: ${socket.id}');
    });
    
    socket.onDisconnect((reason) {
      print('🔴 [Socket] Disconnected: $reason');
    });
    
    socket.onConnectError((error) {
      print('⚠️ [Socket] Connection Error: $error');
    });
    
    socket.onError((error) {
      print('❌ [Socket] Error: $error');
    });
    
    // All events
    socket.onAny((event, data) {
      print('📨 [Socket] Event: $event');
      print('   Data: ${_formatData(data)}');
    });
    
    // Outgoing events
    socket.onAnyOutgoing((event, data) {
      print('📤 [Socket] Emit: $event');
      print('   Data: ${_formatData(data)}');
    });
  }
  
  static String _formatData(dynamic data) {
    if (data == null) return 'null';
    if (data is String) {
      try {
        final decoded = jsonDecode(data);
        return JsonEncoder.withIndent('  ').convert(decoded);
      } catch (e) {
        return data;
      }
    }
    return JsonEncoder.withIndent('  ').convert(data);
  }
}

// Usage
SocketDebugger.enable(socket);
```

### Monitor Connection State

```dart
class SocketMonitor extends StatefulWidget {
  final IO.Socket socket;
  
  @override
  Widget build(BuildContext context) {
    return StreamBuilder(
      stream: Stream.periodic(Duration(seconds: 1)),
      builder: (context, snapshot) {
        return Container(
          padding: EdgeInsets.all(8),
          color: socket.connected ? Colors.green : Colors.red,
          child: Text(
            socket.connected ? 'Connected' : 'Disconnected',
            style: TextStyle(color: Colors.white),
          ),
        );
      },
    );
  }
}
```

---

## 📞 Getting Help

If you're still experiencing issues:

1. **Check the comprehensive guide**: [SOCKET_IO_FLUTTER_GUIDE.md](./SOCKET_IO_FLUTTER_GUIDE.md)
2. **Review backend source code**: `worklenz-backend/src/socket.io/`
3. **Enable debug logging** and examine the output
4. **Check server logs** for error messages
5. **Verify network connectivity** and firewall settings

## ✅ Checklist Before Reporting Issues

- [ ] Session cookie is valid and properly formatted
- [ ] Authenticated after connection (Event 0)
- [ ] Joined project room (Event 21)
- [ ] Using correct event IDs (numeric strings)
- [ ] JSON encoding complex data
- [ ] All required fields included
- [ ] Listeners registered before emitting
- [ ] Cleaned up listeners on dispose
- [ ] Checked server logs for errors
- [ ] Enabled debug logging

---

**Remember**: Most Socket.IO issues are related to authentication, room membership, or data formatting. Double-check these first!
