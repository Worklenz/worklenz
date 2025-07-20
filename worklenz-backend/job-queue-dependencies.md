# Job Queue Dependencies

To use the job queue implementation for recurring tasks, add these dependencies to your package.json:

```json
{
  "dependencies": {
    "bull": "^4.12.2",
    "ioredis": "^5.3.2"
  },
  "devDependencies": {
    "@types/bull": "^4.10.0"
  }
}
```

## Installation

```bash
npm install bull ioredis
npm install --save-dev @types/bull
```

## Redis Setup

1. Install Redis on your system:
   - **Ubuntu/Debian**: `sudo apt install redis-server`
   - **macOS**: `brew install redis`
   - **Windows**: Use WSL or Redis for Windows
   - **Docker**: `docker run -d -p 6379:6379 redis:alpine`

2. Configure Redis connection in your environment variables:
   ```env
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_PASSWORD=your_password  # Optional
   REDIS_DB=0
   ```

## Configuration

Add these environment variables to control the recurring tasks behavior:

```env
# Service configuration
RECURRING_TASKS_ENABLED=true
RECURRING_TASKS_MODE=queue  # or 'cron'

# Queue configuration
RECURRING_TASKS_MAX_CONCURRENCY=5
RECURRING_TASKS_RETRY_ATTEMPTS=3
RECURRING_TASKS_RETRY_DELAY=2000

# Notifications
RECURRING_TASKS_NOTIFICATIONS_ENABLED=true
RECURRING_TASKS_EMAIL_NOTIFICATIONS=true
RECURRING_TASKS_PUSH_NOTIFICATIONS=true
RECURRING_TASKS_IN_APP_NOTIFICATIONS=true

# Audit logging
RECURRING_TASKS_AUDIT_LOG_ENABLED=true
RECURRING_TASKS_AUDIT_RETENTION_DAYS=90
```

## Usage

In your main application file, start the service:

```typescript
import { RecurringTasksService } from './src/services/recurring-tasks-service';

// Start the service
await RecurringTasksService.start();

// Get status
const status = await RecurringTasksService.getStatus();
console.log('Recurring tasks status:', status);

// Health check
const health = await RecurringTasksService.healthCheck();
console.log('Health check:', health);
```

## Benefits of Job Queue vs Cron

### Job Queue (Bull/BullMQ) Benefits:
- **Better scalability**: Can run multiple workers
- **Retry logic**: Built-in retry with exponential backoff
- **Monitoring**: Redis-based job monitoring and UI
- **Priority queues**: Handle urgent tasks first
- **Rate limiting**: Control processing rate
- **Persistence**: Jobs survive server restarts

### Cron Job Benefits:
- **Simplicity**: No external dependencies
- **Lower resource usage**: No Redis required
- **Predictable timing**: Runs exactly on schedule
- **Easier debugging**: Simpler execution model

## Monitoring

You can monitor the job queues using:
- **Bull Dashboard**: Web UI for monitoring jobs
- **Redis CLI**: Direct Redis monitoring
- **Application logs**: Built-in audit logging
- **Health checks**: Built-in health check endpoint

Install Bull Dashboard for monitoring:
```bash
npm install -g bull-board
```