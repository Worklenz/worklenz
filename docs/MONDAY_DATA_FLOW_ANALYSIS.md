# Monday.com to Worklenz Data Flow Analysis

## Complete Data Pipeline Analysis

Based on deep code analysis, here's how Monday.com data flows into Worklenz:

---

## 1. 📡 **Monday.com API Data Structure**

### **GraphQL Query Structure**

```graphql
query ($boardId: [ID!]) {
  boards(ids: $boardId) {
    items_page(limit: 200) {
      items {
        id
        name
        column_values {
          id
          text
          value
        }
      }
    }
  }
}
```

### **Raw API Response Format**

```typescript
interface MondayItem {
  id: string; // e.g., "1234567890"
  name: string; // e.g., "Item 1", "Task ABC"
  column_values?: [
    // Array of all column data
    {
      id: string; // e.g., "status", "person", "date4"
      text?: string; // Human-readable display text
      value?: any; // Raw JSON data (can be complex objects)
    },
  ];
  created_at?: string; // ISO timestamp
  updated_at?: string; // ISO timestamp
}
```

---

## 2. 🔄 **Column Type Mappings**

### **Monday.com Column Types → Worklenz Fields**

```typescript
const MONDAY_TYPE_MAPPING = {
  // ✅ Basic Types
  text: "text", // → Simple text field
  long_text: "description", // → Task description
  numbers: "number", // → Numeric values

  // ✅ Selection Types
  status: "status", // → Task status
  dropdown: "select", // → Dropdown selection

  // ✅ People & Assignment
  people: "assignees", // → Task assignees (EMAILS EXTRACTED)

  // ✅ Date & Time
  date: "date", // → Single date picker
  timeline: "dateRange", // → Start/end date range

  // ✅ Labels & Tags
  tags: "labels", // → Task labels/tags

  // ✅ Other Types
  checkbox: "checkbox", // → True/false values
  rating: "rating", // → Star ratings
  location: "location", // → Geographic location
  link: "url", // → Website URLs
  email: "email", // → Email addresses
  phone: "phone", // → Phone numbers
  world_clock: "timezone", // → Timezone data
};
```

---

## 3. 📊 **Data Processing Pipeline**

### **Step 1: Raw Data Extraction**

```typescript
const rawItem = {
  // System Fields (IDs and Names)
  "Item name": item.name, // → Task title
  name: item.name, // → Duplicate for matching
  id: item.id, // → Monday.com item ID
  "Item ID": item.id, // → Duplicate for matching

  // Timestamps (if available)
  "Created Date": item.created_at, // → Creation timestamp
  created_at: item.created_at, // → Duplicate for matching
  "Updated Date": item.updated_at, // → Last modified timestamp
  updated_at: item.updated_at, // → Duplicate for matching

  // Column Data (Dynamic based on board structure)
  [column.title]: displayValue, // → Human-readable column name
  [column.id]: displayValue, // → Monday.com column ID
  [`${column.title}_raw`]: rawValue, // → Raw JSON data
  [`${column.id}_raw`]: rawValue, // → Raw JSON data by ID
};
```

### **Step 2: Smart Field Detection**

```typescript
const findColumnValue = (types: string[], titles: string[]) => {
  // 1. Try to find by Monday.com column type
  for (const type of types) {
    const column = columns.find((c) => c.type === type);
    if (column) {
      const value = item.column_values?.find((c) => c.id === column.id);
      if (value?.text) return value.text; // ✅ Returns display text
    }
  }

  // 2. Try to find by human-readable column title
  for (const title of titles) {
    const value = rawItem[title];
    if (value && typeof value === "string" && value.trim()) {
      return value.trim(); // ✅ Returns clean string
    }
  }

  return null;
};
```

---

## 4. 👥 **User/Email Data Processing**

### **Monday.com People Field Structure**

```json
// Monday.com "people" column value example:
{
  "id": "person",
  "text": "John Doe, Jane Smith",
  "value": "{\"personsAndTeams\":[
    {\"id\":12345,\"kind\":\"person\",\"name\":\"John Doe\",\"email\":\"john@company.com\"},
    {\"id\":67890,\"kind\":\"person\",\"name\":\"Jane Smith\",\"email\":\"jane@company.com\"}
  ]}"
}
```

### **How Emails Are Extracted**

```typescript
// Current Implementation: Uses display text
const assignee = findColumnValue(
  ["people", "person"],
  ["Person", "Assignee", "Owner", "Team Member"],
);
// ✅ Returns: "John Doe, Jane Smith" (display names)

// 🔍 EMAIL EXTRACTION MISSING:
// Raw JSON contains actual email addresses that could be parsed!
const peopleData = JSON.parse(columnValue.value);
const emails = peopleData.personsAndTeams.map((person) => person.email);
// ❌ Currently not implemented - only using display text
```

### **User Mapping Process**

```typescript
// In imports-service.ts - user mapping logic:
const resolveAssignees = (value?: string | null) => {
  if (!value) return [];

  const normalized = value.toString().trim();
  const lower = normalized.toLowerCase();

  // 1. Direct mapping lookup
  const direct = assigneeMap.get(normalized);

  // 2. Email matching
  const emailMatch = assigneeMap.get(lower);

  // 3. Team member email matching
  const teamMemberId = teamMemberEmailMap.get(lower);

  // 4. Team member name matching
  const nameKey = normalizeAssigneeToken(normalized);
  const nameMatch = teamMemberNameMap.get(nameKey);

  return teamMemberId || direct || emailMatch || nameMatch ? [matchedId] : [];
};
```

---

## 5. 📋 **Field Mapping Examples**

### **Status Field Processing**

```typescript
// Monday.com status column:
{
  "id": "status",
  "text": "Working on it",  // ✅ This gets mapped
  "value": "{\"label\":\"Working on it\",\"color\":\"#fdab3d\"}"
}

// Maps to Worklenz status field
```

### **Date Field Processing**

```typescript
// Monday.com date column:
{
  "id": "date4",
  "text": "2026-01-30",     // ✅ This gets mapped
  "value": "{\"date\":\"2026-01-30\"}"
}

// Maps to Worklenz due_at field
```

### **Timeline Field Processing**

```typescript
// Monday.com timeline column:
{
  "id": "timeline",
  "text": "Jan 25 - Feb 10", // ✅ This gets mapped
  "value": "{\"from\":\"2026-01-25\",\"to\":\"2026-02-10\"}"
}

// Maps to Worklenz start_at field (from date)
```

---

## 6. 🎯 **Current Data Types Flowing to Worklenz**

### **✅ Successfully Mapped Data Types:**

1. **Strings**: Task names, descriptions, status labels
2. **Display Text**: Human-readable column values
3. **Simple Values**: Numbers, ratings, text fields
4. **Date Strings**: ISO date formats from date/timeline columns
5. **Label Names**: Tag/label display names

### **⚠️ Limited Processing:**

1. **People Fields**: Only display names, not actual emails
2. **Complex JSON**: Raw values not fully utilized
3. **Timeline Ranges**: Only start date extracted, not end date
4. **Location Data**: GPS coordinates not extracted
5. **Link Metadata**: Only URL text, not link titles

### **❌ Missing/Not Processed:**

1. **Actual Email Addresses**: Available in raw JSON but not extracted
2. **User IDs**: Monday.com user IDs not mapped
3. **Complex Object Properties**: Rich data in JSON values
4. **File Attachments**: Not processed in current queries
5. **Subitems**: Hierarchical task data not included
6. **Board Metadata**: Board-level information not captured

---

## 7. 🔄 **Data Flow Summary**

```
Monday.com Board
    ↓ (GraphQL API)
Raw JSON Response
    ↓ (monday-provider.ts)
Processed Item Data
    ↓ (buildRawItem)
Enhanced Raw Object
    ↓ (field mapping)
StageTaskRow Objects
    ↓ (imports-service.ts)
Worklenz Tasks
```

### **Key Processing Points:**

1. **API Response** → Raw Monday.com data with IDs, names, column_values
2. **Column Processing** → Smart field detection by type and title
3. **Data Extraction** → Text values extracted, JSON values partially parsed
4. **Field Mapping** → Source fields mapped to Worklenz target fields
5. **User Resolution** → Display names mapped to Worklenz team members
6. **Task Creation** → Final Worklenz tasks with populated fields

---

## 8. 🛠️ **Enhancement Opportunities**

### **Email Extraction Improvement**

```typescript
// Enhanced people field processing:
const extractEmails = (columnValue: MondayColumnValue): string[] => {
  if (columnValue.value) {
    try {
      const data = JSON.parse(columnValue.value);
      if (data.personsAndTeams) {
        return data.personsAndTeams
          .filter((person) => person.email)
          .map((person) => person.email);
      }
    } catch (e) {}
  }
  return [];
};
```

### **Timeline Range Processing**

```typescript
// Enhanced timeline processing:
const extractDateRange = (
  columnValue: MondayColumnValue,
): { start?: string; end?: string } => {
  if (columnValue.value) {
    try {
      const data = JSON.parse(columnValue.value);
      return {
        start: data.from,
        end: data.to,
      };
    } catch (e) {}
  }
  return {};
};
```

This analysis shows that while basic data flows correctly, there are opportunities to extract richer information from Monday.com's JSON responses, particularly for people fields (emails) and complex column types.
