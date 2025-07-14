# Enhanced Task Management: User Guide

## What Is Enhanced Task Management?
The Enhanced Task Management system provides a modern, grouped view of your tasks with advanced features like drag-and-drop, bulk operations, and dynamic grouping. This system builds on WorkLenz's existing task infrastructure while offering improved productivity and organization tools.

## Why Use Enhanced Task Management?
- **Better Organization:** Group tasks by Status, Priority, or Phase for clearer project overview
- **Increased Productivity:** Bulk operations let you update multiple tasks at once
- **Intuitive Interface:** Drag-and-drop functionality makes task management feel natural
- **Rich Task Display:** See progress, assignees, labels, and due dates at a glance
- **Responsive Design:** Works seamlessly on desktop, tablet, and mobile devices

## Getting Started

### Accessing Enhanced Task Management
1. Navigate to your project workspace
2. Look for the enhanced task view option in your project interface
3. The system will display your tasks grouped by the current grouping method (default: Status)

### Understanding the Interface
The enhanced task management interface consists of several key areas:

- **Header Controls:** Task count, grouping selector, and action buttons
- **Task Groups:** Collapsible sections containing related tasks
- **Individual Tasks:** Rich task cards with metadata and actions
- **Bulk Action Bar:** Appears when multiple tasks are selected (blue bar)

## Task Grouping

### Available Grouping Options
You can organize your tasks using three different grouping methods:

#### 1. Status Grouping (Default)
Groups tasks by their current status:
- **To Do:** Tasks not yet started
- **Doing:** Tasks currently in progress  
- **Done:** Completed tasks

#### 2. Priority Grouping
Groups tasks by their priority level:
- **Critical:** Highest priority, urgent tasks
- **High:** Important tasks requiring attention
- **Medium:** Standard priority tasks
- **Low:** Tasks that can be addressed later

#### 3. Phase Grouping
Groups tasks by project phases:
- **Planning:** Tasks in the planning stage
- **Development:** Implementation and development tasks
- **Testing:** Quality assurance and testing tasks
- **Deployment:** Release and deployment tasks

### Switching Between Groupings
1. Locate the "Group by" dropdown in the header controls
2. Select your preferred grouping method (Status, Priority, or Phase)
3. Tasks will automatically reorganize into the new groups
4. Your grouping preference is saved for future sessions

### Group Features
Each task group includes:
- **Color-coded headers** with visual indicators
- **Task count badges** showing the number of tasks in each group
- **Progress indicators** showing completion percentage
- **Collapse/expand functionality** to hide or show group contents
- **Add task buttons** to quickly create tasks in specific groups

## Drag and Drop

### Moving Tasks Within Groups
1. Hover over a task to reveal the drag handle (⋮⋮ icon)
2. Click and hold the drag handle
3. Drag the task to your desired position within the same group
4. Release to drop the task in its new position

### Moving Tasks Between Groups
1. Click and hold the drag handle on any task
2. Drag the task over a different group
3. The target group will highlight to show it can accept the task
4. Release to drop the task into the new group
5. The task's properties (status, priority, or phase) will automatically update

### Drag and Drop Benefits
- **Instant Updates:** Task properties change automatically when moved between groups
- **Visual Feedback:** Clear indicators show where tasks can be dropped
- **Keyboard Accessible:** Alternative keyboard controls for accessibility
- **Mobile Friendly:** Touch-friendly drag operations on mobile devices

## Multi-Select and Bulk Operations

### Selecting Tasks
You can select multiple tasks using several methods:

#### Individual Selection
- Click the checkbox next to any task to select it
- Click again to deselect

#### Range Selection  
- Select the first task in your desired range
- Hold Shift and click the last task in the range
- All tasks between the first and last will be selected

#### Multiple Selection
- Hold Ctrl (or Cmd on Mac) while clicking tasks
- This allows you to select non-consecutive tasks

### Bulk Actions
When you have tasks selected, a blue bulk action bar appears with these options:

#### Change Status (when not grouped by Status)
- Update the status of all selected tasks at once
- Choose from available status options in your project

#### Set Priority (when not grouped by Priority)  
- Assign the same priority level to all selected tasks
- Options include Critical, High, Medium, and Low

#### More Actions
Additional bulk operations include:
- **Assign to Member:** Add team members to multiple tasks
- **Add Labels:** Apply labels to selected tasks
- **Archive Tasks:** Move multiple tasks to archive

#### Delete Tasks
- Permanently remove multiple tasks at once
- Confirmation dialog prevents accidental deletions

### Bulk Action Tips
- The bulk action bar only shows relevant options based on your current grouping
- You can clear your selection at any time using the "Clear" button
- Bulk operations provide immediate feedback and can be undone if needed

## Task Display Features

### Rich Task Information
Each task displays comprehensive information:

#### Basic Information
- **Task Key:** Unique identifier (e.g., PROJ-123)
- **Task Name:** Clear, descriptive title
- **Description:** Additional details when available

#### Visual Indicators
- **Progress Bar:** Shows completion percentage (0-100%)
- **Priority Indicator:** Color-coded dot showing task importance
- **Status Color:** Left border color indicates current status

#### Team and Collaboration
- **Assignee Avatars:** Profile pictures of assigned team members (up to 3 visible)
- **Labels:** Color-coded tags for categorization
- **Comment Count:** Number of comments and discussions
- **Attachment Count:** Number of files attached to the task

#### Timing Information
- **Due Dates:** When tasks are scheduled to complete
  - Red text: Overdue tasks
  - Orange text: Due today or within 3 days
  - Gray text: Future due dates
- **Time Tracking:** Estimated vs. logged time when available

### Subtask Support
Tasks with subtasks include additional features:

#### Expanding Subtasks
- Click the "+X" button next to task names to expand subtasks
- Subtasks appear indented below the parent task
- Click "−X" to collapse subtasks

#### Subtask Progress
- Parent task progress reflects completion of all subtasks
- Individual subtask progress is visible when expanded
- Subtask counts show total number of child tasks

## Advanced Features

### Real-time Updates
- Changes made by team members appear instantly
- Live collaboration with multiple users
- WebSocket connections ensure data synchronization

### Search and Filtering
- Use existing project search and filter capabilities
- Enhanced task management respects current filter settings
- Search results maintain grouping organization

### Responsive Design
The interface adapts to different screen sizes:

#### Desktop (Large Screens)
- Full feature set with all metadata visible
- Optimal drag-and-drop experience
- Multi-column layouts where appropriate

#### Tablet (Medium Screens)  
- Condensed but functional interface
- Touch-friendly interactions
- Simplified metadata display

#### Mobile (Small Screens)
- Stacked layout for easy navigation
- Large touch targets for selections
- Essential information prioritized

## Best Practices

### Organizing Your Tasks
1. **Choose the Right Grouping:** Select the grouping method that best fits your workflow
2. **Use Labels Consistently:** Apply meaningful labels for better categorization
3. **Keep Groups Balanced:** Avoid having too many tasks in a single group
4. **Regular Maintenance:** Review and update task organization periodically

### Collaboration Tips
1. **Clear Task Names:** Use descriptive titles that everyone understands
2. **Proper Assignment:** Assign tasks to appropriate team members
3. **Progress Updates:** Keep progress percentages current for accurate project tracking
4. **Use Comments:** Communicate about tasks using the comment system

### Productivity Techniques
1. **Batch Similar Operations:** Use bulk actions for efficiency
2. **Prioritize Effectively:** Use priority grouping during planning phases
3. **Track Progress:** Monitor completion rates using group progress indicators
4. **Plan Ahead:** Use due dates and time estimates for better scheduling

## Keyboard Shortcuts

### Navigation
- **Tab:** Move focus between elements
- **Enter:** Activate focused button or link
- **Esc:** Close open dialogs or clear selections

### Selection
- **Space:** Select/deselect focused task
- **Shift + Click:** Range selection
- **Ctrl + Click:** Multi-selection (Cmd + Click on Mac)

### Actions
- **Delete:** Remove selected tasks (with confirmation)
- **Ctrl + A:** Select all visible tasks (Cmd + A on Mac)

## Troubleshooting

### Common Issues

#### Tasks Not Moving Between Groups
- Ensure you have edit permissions for the tasks
- Check that you're dragging from the drag handle (⋮⋮ icon)
- Verify the target group allows the task type

#### Bulk Actions Not Working
- Confirm tasks are actually selected (checkboxes checked)
- Ensure you have appropriate permissions
- Check that the action is available for your current grouping

#### Missing Task Information
- Some metadata may be hidden on smaller screens
- Try expanding to full screen or using desktop view
- Check that task has the required information (assignees, labels, etc.)

### Performance Tips
- For projects with hundreds of tasks, consider using filters to reduce visible tasks
- Collapse groups you're not actively working with
- Clear selections when not performing bulk operations

## Getting Help
- Contact your workspace administrator for permission-related issues
- Check the main WorkLenz documentation for general task management help
- Report bugs or feature requests through your organization's support channels

## What's New
This enhanced task management system builds on WorkLenz's solid foundation while adding:
- Modern drag-and-drop interfaces
- Flexible grouping options
- Powerful bulk operation capabilities
- Rich visual task displays
- Mobile-responsive design
- Improved accessibility features 