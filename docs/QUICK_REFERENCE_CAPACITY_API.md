# 🚀 Capacity API - Quick Reference

## Setup (1 minute)

```bash
# Run migration
cd worklenz-backend
psql -U postgres -d worklenz -f database/sql/migrations/20260114000000-capacity-calculation-function.sql

# Start server
npm run dev
```

## API Endpoints

### 1. Daily Capacity
```http
GET /api/schedule-gannt-v2/capacity/daily?startDate=2026-01-13&endDate=2026-02-13
```

**Response:**
```json
[
  {
    "team_member_id": "uuid",
    "member_name": "John Doe",
    "member_email": "john@example.com",
    "daily_capacity": [
      {
        "date": "2026-01-13",
        "working_hours": 8,
        "allocated_hours": 6,
        "available_hours": 2,
        "utilization_percent": 75,
        "is_time_off": false,
        "is_weekend": false,
        "status": "normal",
        "projects": [
          {
            "project_id": "uuid",
            "project_name": "Project A",
            "allocated_hours": 4,
            "color_code": "#3b82f6"
          }
        ]
      }
    ],
    "summary": {
      "total_working_hours": 160,
      "total_allocated_hours": 120,
      "total_available_hours": 40,
      "average_utilization": 75,
      "days_overallocated": 0,
      "days_available": 15
    }
  }
]
```

### 2. Capacity Summary
```http
GET /api/schedule-gannt-v2/capacity/summary?startDate=2026-01-13&endDate=2026-02-13
```

**Response:**
```json
{
  "total_members": 10,
  "total_working_hours": 1600,
  "total_allocated_hours": 1200,
  "total_available_hours": 400,
  "average_utilization": 75,
  "days_overallocated": 5,
  "days_available": 150,
  "days_fully_allocated": 45,
  "days_normal": 100
}
```

### 3. Capacity Conflicts
```http
GET /api/schedule-gannt-v2/capacity/conflicts?startDate=2026-01-13&endDate=2026-02-13
```

**Response:**
```json
[
  {
    "type": "overallocation",
    "severity": "high",
    "team_member_id": "uuid",
    "member_name": "Jane Smith",
    "date": "2026-01-15",
    "working_hours": 8,
    "allocated_hours": 12,
    "overallocation_hours": 4,
    "utilization_percent": 150,
    "projects": [...],
    "message": "Jane Smith is over-allocated by 4.0 hours on 1/15/2026"
  }
]
```

## Status Values

| Status | Utilization | Color | Meaning |
|--------|-------------|-------|---------|
| `available` | 0-75% | 🟢 Green | Has capacity |
| `normal` | 75-100% | 🔵 Blue | Well utilized |
| `fully-allocated` | 100% | 🟡 Yellow | At capacity |
| `overallocated` | >100% | 🔴 Red | Over capacity |
| `unavailable` | N/A | ⚪ Gray | Time-off/weekend |

## Frontend Integration

```typescript
// 1. Add to scheduleApi.ts
fetchDailyCapacity: builder.query({
  query: ({ startDate, endDate, teamMemberId }) => 
    `/capacity/daily?startDate=${startDate}&endDate=${endDate}${teamMemberId ? `&teamMemberId=${teamMemberId}` : ''}`,
  providesTags: ['Capacity'],
}),

// 2. Use in component
const { data } = useFetchDailyCapacityQuery({
  startDate: '2026-01-13',
  endDate: '2026-02-13'
});

// 3. Render capacity
<DayAllocationCell 
  capacityData={data.body[0].daily_capacity[0]}
/>
```

## Testing

```bash
# Test endpoint
curl "http://localhost:3000/api/schedule-gannt-v2/capacity/daily?startDate=2026-01-13&endDate=2026-02-13"

# Test with specific member
curl "http://localhost:3000/api/schedule-gannt-v2/capacity/daily?startDate=2026-01-13&endDate=2026-02-13&teamMemberId=YOUR_UUID"
```

## Troubleshooting

**Error: "function calculate_member_capacity does not exist"**
→ Run the migration SQL file

**Error: "Organization not found"**
→ Check user authentication and organization setup

**Empty capacity data**
→ Verify team members exist and have allocations

**Incorrect calculations**
→ Check organization_working_days and hours_per_day settings
