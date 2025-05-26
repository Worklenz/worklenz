# Task Breakdown API

## Get Task Financial Breakdown

**Endpoint:** `GET /api/project-finance/task/:id/breakdown`

**Description:** Retrieves detailed financial breakdown for a single task, including members grouped by job roles with labor hours and costs.

### Parameters

- `id` (path parameter): UUID of the task

### Response

```json
{
  "success": true,
  "body": {
    "task": {
      "id": "uuid",
      "name": "Task Name",
      "project_id": "uuid",
      "billable": true,
      "estimated_hours": 10.5,
      "logged_hours": 8.25,
      "estimated_labor_cost": 525.0,
      "actual_labor_cost": 412.5,
      "fixed_cost": 100.0,
      "total_estimated_cost": 625.0,
      "total_actual_cost": 512.5
    },
    "grouped_members": [
      {
        "jobRole": "Frontend Developer",
        "estimated_hours": 5.25,
        "logged_hours": 4.0,
        "estimated_cost": 262.5,
        "actual_cost": 200.0,
        "members": [
          {
            "team_member_id": "uuid",
            "name": "John Doe",
            "avatar_url": "https://...",
            "hourly_rate": 50.0,
            "estimated_hours": 5.25,
            "logged_hours": 4.0,
            "estimated_cost": 262.5,
            "actual_cost": 200.0
          }
        ]
      },
      {
        "jobRole": "Backend Developer",
        "estimated_hours": 5.25,
        "logged_hours": 4.25,
        "estimated_cost": 262.5,
        "actual_cost": 212.5,
        "members": [
          {
            "team_member_id": "uuid",
            "name": "Jane Smith",
            "avatar_url": "https://...",
            "hourly_rate": 50.0,
            "estimated_hours": 5.25,
            "logged_hours": 4.25,
            "estimated_cost": 262.5,
            "actual_cost": 212.5
          }
        ]
      }
    ],
    "members": [
      {
        "team_member_id": "uuid",
        "name": "John Doe",
        "avatar_url": "https://...",
        "hourly_rate": 50.0,
        "job_title_name": "Frontend Developer",
        "estimated_hours": 5.25,
        "logged_hours": 4.0,
        "estimated_cost": 262.5,
        "actual_cost": 200.0
      },
      {
        "team_member_id": "uuid",
        "name": "Jane Smith",
        "avatar_url": "https://...",
        "hourly_rate": 50.0,
        "job_title_name": "Backend Developer",
        "estimated_hours": 5.25,
        "logged_hours": 4.25,
        "estimated_cost": 262.5,
        "actual_cost": 212.5
      }
    ]
  }
}
```

### Error Responses

- `404 Not Found`: Task not found
- `400 Bad Request`: Invalid task ID

### Usage

This endpoint is designed to work with the finance drawer component (`@finance-drawer.tsx`) to provide detailed cost breakdown information for individual tasks. The response includes:

1. **Task Summary**: Overall task financial information
2. **Grouped Members**: Members organized by job role with aggregated costs
3. **Individual Members**: Detailed breakdown for each team member

The data structure matches what the finance drawer expects, with members grouped by job roles and individual labor hours and costs calculated based on:
- Estimated hours divided equally among assignees
- Actual logged time per member
- Hourly rates from project rate cards
- Fixed costs added to the totals

### Frontend Usage Example

```typescript
import { projectFinanceApiService } from '@/api/project-finance-ratecard/project-finance.api.service';

// Fetch task breakdown
const fetchTaskBreakdown = async (taskId: string) => {
  try {
    const response = await projectFinanceApiService.getTaskBreakdown(taskId);
    const breakdown = response.body;
    
    console.log('Task:', breakdown.task);
    console.log('Grouped Members:', breakdown.grouped_members);
    console.log('Individual Members:', breakdown.members);
    
    return breakdown;
  } catch (error) {
    console.error('Error fetching task breakdown:', error);
    throw error;
  }
};

// Usage in React component
const TaskBreakdownComponent = ({ taskId }: { taskId: string }) => {
  const [breakdown, setBreakdown] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadBreakdown = async () => {
      setLoading(true);
      try {
        const data = await fetchTaskBreakdown(taskId);
        setBreakdown(data);
      } catch (error) {
        // Handle error
      } finally {
        setLoading(false);
      }
    };

    if (taskId) {
      loadBreakdown();
    }
  }, [taskId]);

  if (loading) return <Spin />;
  if (!breakdown) return null;

  return (
    <div>
      <h3>{breakdown.task.name}</h3>
      <p>Total Estimated Cost: ${breakdown.task.total_estimated_cost}</p>
      <p>Total Actual Cost: ${breakdown.task.total_actual_cost}</p>
      
      {breakdown.grouped_members.map(group => (
        <div key={group.jobRole}>
          <h4>{group.jobRole}</h4>
          <p>Hours: {group.estimated_hours} | Cost: ${group.estimated_cost}</p>
          {group.members.map(member => (
            <div key={member.team_member_id}>
              {member.name}: {member.estimated_hours}h @ ${member.hourly_rate}/h
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};
```

### Integration

This API complements the existing finance endpoints:
- `GET /api/project-finance/project/:project_id/tasks` - Get all tasks for a project
- `PUT /api/project-finance/task/:task_id/fixed-cost` - Update task fixed cost

The finance drawer component has been updated to automatically use this API when a task is selected, providing real-time financial breakdown data. 