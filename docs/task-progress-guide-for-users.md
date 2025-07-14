# WorkLenz Task Progress Guide for Users

## Introduction
WorkLenz offers three different ways to track and calculate task progress, each designed for different project management needs. This guide explains how each method works and when to use them.

## Default Progress Method

WorkLenz uses a simple completion-based approach as the default progress calculation method. This method is applied when no special progress methods are enabled.

### Example

If you have a parent task with four subtasks and two of the subtasks are marked complete:
- Parent task: Not done
- 2 subtasks: Done
- 2 subtasks: Not done

The parent task will show as 40% complete (2 completed out of 5 total tasks).

## Available Progress Tracking Methods

WorkLenz provides these progress tracking methods:

1. **Manual Progress** - Directly input progress percentages for tasks
2. **Weighted Progress** - Assign importance levels (weights) to tasks
3. **Time-based Progress** - Calculate progress based on estimated time

Only one method can be enabled at a time for a project. If none are enabled, progress will be calculated based on task completion status.

## How to Select a Progress Method

1. Open the project drawer by clicking on the project settings icon or creating a new project
2. In the project settings, find the "Progress Calculation Method" section
3. Select your preferred method
4. Save your changes

## Manual Progress Method

### How It Works

- You directly enter progress percentages (0-100%) for tasks without subtasks
- Parent task progress is calculated as the average of all subtask progress values
- Progress is updated in real-time as you adjust values

### When to Use Manual Progress

- For creative or subjective work where completion can't be measured objectively
- When task progress doesn't follow a linear path
- For projects where team members need flexibility in reporting progress

### Example

If you have a parent task with three subtasks:
- Subtask A: 30% complete
- Subtask B: 60% complete  
- Subtask C: 90% complete

The parent task will show as 60% complete (average of 30%, 60%, and 90%).

## Weighted Progress Method

### How It Works

- You assign "weight" values to tasks to indicate their importance
- More important tasks have higher weights and influence the overall progress more
- You still enter manual progress percentages for tasks without subtasks
- Parent task progress is calculated using a weighted average

### When to Use Weighted Progress

- When some tasks are more important or time-consuming than others
- For projects where all tasks aren't equal
- When you want key deliverables to have more impact on overall progress

### Example

If you have a parent task with three subtasks:
- Subtask A: 50% complete, Weight 60% (important task)
- Subtask B: 75% complete, Weight 20% (less important task)
- Subtask C: 25% complete, Weight 100% (critical task)

The parent task will be approximately 39% complete, with Subtask C having the greatest impact due to its higher weight.

### Important Notes About Weights

- Default weight is 100% if not specified
- Weights range from 0% to 100%
- Setting a weight to 0% removes that task from progress calculations
- Only explicitly set weights for tasks that should have different importance
- Weights are only relevant for subtasks, not for independent tasks

### Detailed Weighted Progress Calculation Example

To understand how weighted progress works with different weight values, consider this example:

For a parent task with two subtasks:
- Subtask A: 80% complete, Weight 50%
- Subtask B: 40% complete, Weight 100%

The calculation works as follows:

1. Each subtask's contribution is: (weight × progress) ÷ (sum of all weights)
2. For Subtask A: (50 × 80%) ÷ (50 + 100) = 26.7% 
3. For Subtask B: (100 × 40%) ÷ (50 + 100) = 26.7%
4. Total parent progress: 26.7% + 26.7% = 53.3%

The parent task would be approximately 53% complete.

This shows how the subtask with twice the weight (Subtask B) has twice the influence on the overall progress calculation, even though it has a lower completion percentage.

## Time-based Progress Method

### How It Works

- Use the task's time estimate as its "weight" in the progress calculation
- You still enter manual progress percentages for tasks without subtasks
- Tasks with longer time estimates have more influence on overall progress
- Parent task progress is calculated based on time-weighted averages

### When to Use Time-based Progress

- For projects with well-defined time estimates
- When task importance correlates with its duration
- For billing or time-tracking focused projects
- When you already maintain accurate time estimates

### Example

If you have a parent task with three subtasks:
- Subtask A: 40% complete, Estimated Time 2.5 hours
- Subtask B: 80% complete, Estimated Time 1 hour
- Subtask C: 10% complete, Estimated Time 4 hours

The parent task will be approximately 29% complete, with the lengthy Subtask C pulling down the overall progress despite Subtask B being mostly complete.

### Important Notes About Time Estimates

- Tasks without time estimates don't influence progress calculations
- Time is converted to minutes internally (a 2-hour task = 120 minutes)
- Setting a time estimate to 0 removes that task from progress calculations
- Time estimates serve dual purposes: scheduling/resource planning and progress weighting

### Detailed Time-based Progress Calculation Example

To understand how time-based progress works with different time estimates, consider this example:

For a parent task with three subtasks:
- Subtask A: 40% complete, Estimated Time 2.5 hours
- Subtask B: 80% complete, Estimated Time 1 hour
- Subtask C: 10% complete, Estimated Time 4 hours

The calculation works as follows:

1. Convert hours to minutes: A = 150 min, B = 60 min, C = 240 min
2. Total estimated time: 150 + 60 + 240 = 450 minutes
3. Each subtask's contribution is: (time estimate × progress) ÷ (total time)
4. For Subtask A: (150 × 40%) ÷ 450 = 13.3%
5. For Subtask B: (60 × 80%) ÷ 450 = 10.7%
6. For Subtask C: (240 × 10%) ÷ 450 = 5.3%
7. Total parent progress: 13.3% + 10.7% + 5.3% = 29.3%

The parent task would be approximately 29% complete.

This demonstrates how tasks with longer time estimates (like Subtask C) have more influence on the overall progress calculation. Even though Subtask B is 80% complete, its shorter time estimate means it contributes less to the overall progress than the partially-completed but longer Subtask A.

### How It Works

- Tasks are either 0% (not done) or 100% (done)
- Parent task progress = (completed tasks / total tasks) × 100%
- Both the parent task and all subtasks count in this calculation

### When to Use Default Progress

- For simple projects with clear task completion criteria
- When binary task status (done/not done) is sufficient
- For teams new to project management who want simplicity

### Example

If you have a parent task with four subtasks and two of the subtasks are marked complete:
- Parent task: Not done
- 2 subtasks: Done
- 2 subtasks: Not done

The parent task will show as 40% complete (2 completed out of 5 total tasks).

## Best Practices

1. **Choose the Right Method for Your Project**
   - Consider your team's workflow and reporting needs
   - Match the method to your project's complexity

2. **Be Consistent**
   - Stick with one method throughout the project
   - Changing methods mid-project can cause confusion

3. **For Manual Progress**
   - Update progress regularly
   - Establish guidelines for progress reporting

4. **For Weighted Progress**
   - Assign weights based on objective criteria
   - Don't overuse extreme weights

5. **For Time-based Progress**
   - Keep time estimates accurate and up to date
   - Consider using time tracking to validate estimates

## Frequently Asked Questions

**Q: Can I change the progress method mid-project?**
A: Yes, but it may cause progress values to change significantly. It's best to select a method at the project start.

**Q: What happens to task progress when I mark a task complete?**
A: When a task is marked complete, its progress automatically becomes 100%, regardless of the progress method.

**Q: How do I enter progress for a task?**
A: Open the task drawer, go to the Info tab, and use the progress slider for tasks without subtasks.

**Q: Can different projects use different progress methods?**
A: Yes, each project can have its own progress method.

**Q: What if I don't see progress fields in my task drawer?**
A: Progress input is only visible for tasks without subtasks. Parent tasks' progress is automatically calculated.