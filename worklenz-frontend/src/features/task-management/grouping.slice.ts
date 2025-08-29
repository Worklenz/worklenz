import { createSlice, PayloadAction, createSelector } from '@reduxjs/toolkit';
import { TaskGroup } from '@/types/task-management.types';
import { RootState } from '@/app/store';
import { selectAllTasksArray } from './task-management.slice';

type GroupingType = 'status' | 'priority' | 'phase';

interface LocalGroupingState {
  currentGrouping: GroupingType | null;
  customPhases: string[];
  groupOrder: {
    status: string[];
    priority: string[];
    phase: string[];
  };
  groupStates: Record<string, { collapsed: boolean }>;
  collapsedGroups: string[];
}

// Local storage constants
const LOCALSTORAGE_GROUP_KEY = 'worklenz.tasklist.group_by';

// Utility functions for local storage
const loadGroupingFromLocalStorage = (): GroupingType | null => {
  try {
    const stored = localStorage.getItem(LOCALSTORAGE_GROUP_KEY);
    if (stored && ['status', 'priority', 'phase'].includes(stored)) {
      return stored as GroupingType;
    }
  } catch (error) {
    console.warn('Failed to load grouping from localStorage:', error);
  }
  return 'status'; // Default to 'status' instead of null
};

const saveGroupingToLocalStorage = (grouping: GroupingType | null): void => {
  try {
    if (grouping) {
      localStorage.setItem(LOCALSTORAGE_GROUP_KEY, grouping);
    } else {
      localStorage.removeItem(LOCALSTORAGE_GROUP_KEY);
    }
  } catch (error) {
    console.warn('Failed to save grouping to localStorage:', error);
  }
};

const initialState: LocalGroupingState = {
  currentGrouping: loadGroupingFromLocalStorage(),
  customPhases: ['Planning', 'Development', 'Testing', 'Deployment'],
  groupOrder: {
    status: ['todo', 'doing', 'done'],
    priority: ['critical', 'high', 'medium', 'low'],
    phase: ['Planning', 'Development', 'Testing', 'Deployment'],
  },
  groupStates: {},
  collapsedGroups: [],
};

const groupingSlice = createSlice({
  name: 'grouping',
  initialState,
  reducers: {
    setCurrentGrouping: (state, action: PayloadAction<GroupingType | null>) => {
      state.currentGrouping = action.payload;
      saveGroupingToLocalStorage(action.payload);
    },

    addCustomPhase: (state, action: PayloadAction<string>) => {
      const phase = action.payload.trim();
      if (phase && !state.customPhases.includes(phase)) {
        state.customPhases.push(phase);
        state.groupOrder.phase.push(phase);
      }
    },

    removeCustomPhase: (state, action: PayloadAction<string>) => {
      const phase = action.payload;
      state.customPhases = state.customPhases.filter(p => p !== phase);
      state.groupOrder.phase = state.groupOrder.phase.filter(p => p !== phase);
    },

    updateCustomPhases: (state, action: PayloadAction<string[]>) => {
      state.customPhases = action.payload;
      state.groupOrder.phase = action.payload;
    },

    updateGroupOrder: (
      state,
      action: PayloadAction<{ groupType: keyof LocalGroupingState['groupOrder']; order: string[] }>
    ) => {
      const { groupType, order } = action.payload;
      state.groupOrder[groupType] = order;
    },

    toggleGroupCollapsed: (state, action: PayloadAction<string>) => {
      const groupId = action.payload;
      const isCollapsed = state.collapsedGroups.includes(groupId);
      if (isCollapsed) {
        state.collapsedGroups = state.collapsedGroups.filter(id => id !== groupId);
      } else {
        state.collapsedGroups.push(groupId);
      }
    },

    setGroupCollapsed: (state, action: PayloadAction<{ groupId: string; collapsed: boolean }>) => {
      const { groupId, collapsed } = action.payload;
      if (!state.groupStates[groupId]) {
        state.groupStates[groupId] = { collapsed: false };
      }
      state.groupStates[groupId].collapsed = collapsed;
    },

    collapseAllGroups: (state, action: PayloadAction<string[]>) => {
      state.collapsedGroups = action.payload;
    },

    expandAllGroups: state => {
      state.collapsedGroups = [];
    },

    resetGrouping: () => initialState,
  },
});

export const {
  setCurrentGrouping,
  addCustomPhase,
  removeCustomPhase,
  updateCustomPhases,
  updateGroupOrder,
  toggleGroupCollapsed,
  setGroupCollapsed,
  collapseAllGroups,
  expandAllGroups,
  resetGrouping,
} = groupingSlice.actions;

// Selectors
export const selectCurrentGrouping = (state: RootState) => state.grouping.currentGrouping;
export const selectCustomPhases = (state: RootState) => state.grouping.customPhases;
export const selectGroupOrder = (state: RootState) => state.grouping.groupOrder;
export const selectGroupStates = (state: RootState) => state.grouping.groupStates;
export const selectCollapsedGroupsArray = (state: RootState) => state.grouping.collapsedGroups;

// Memoized selector to prevent unnecessary re-renders
export const selectCollapsedGroups = createSelector(
  [selectCollapsedGroupsArray],
  collapsedGroupsArray => new Set(collapsedGroupsArray)
);

export const selectIsGroupCollapsed = (state: RootState, groupId: string) =>
  state.grouping.collapsedGroups.includes(groupId);

// Complex selectors using createSelector for memoization
export const selectCurrentGroupOrder = createSelector(
  [selectCurrentGrouping, selectGroupOrder],
  (currentGrouping, groupOrder) => {
    if (!currentGrouping) return [];
    return groupOrder[currentGrouping] || [];
  }
);

export const selectTaskGroups = createSelector(
  [selectAllTasksArray, selectCurrentGrouping, selectCurrentGroupOrder, selectGroupStates],
  (tasks, currentGrouping, groupOrder, groupStates) => {
    const groups: TaskGroup[] = [];

    if (!currentGrouping) return groups;

    // Get unique values for the current grouping
    const groupValues =
      groupOrder.length > 0
        ? groupOrder
        : Array.from(
            new Set(
              tasks.map(task => {
                if (currentGrouping === 'status') return task.status;
                if (currentGrouping === 'priority') return task.priority;
                if (currentGrouping === 'phase') {
                  // For phase grouping, use 'Unmapped' for tasks without a phase
                  if (!task.phase || task.phase.trim() === '') {
                    return 'Unmapped';
                  } else {
                    return task.phase;
                  }
                }
                return task.phase;
              })
            )
          );

    groupValues.forEach(value => {
      if (!value) return; // Skip undefined values

      const tasksInGroup = tasks
        .filter(task => {
          if (currentGrouping === 'status') return task.status === value;
          if (currentGrouping === 'priority') return task.priority === value;
          if (currentGrouping === 'phase') {
            if (value === 'Unmapped') {
              return !task.phase || task.phase.trim() === '';
            } else {
              return task.phase === value;
            }
          }
          return task.phase === value;
        })
        .sort((a, b) => (a.order || 0) - (b.order || 0));

      const groupId = `${currentGrouping}-${value}`;

      groups.push({
        id: groupId,
        title: value.charAt(0).toUpperCase() + value.slice(1),
        taskIds: tasksInGroup.map(task => task.id),
        type: currentGrouping,
        color: getGroupColor(currentGrouping, value),
        collapsed: groupStates[groupId]?.collapsed || false,
        groupValue: value,
      });
    });

    return groups;
  }
);

export const selectTasksByCurrentGrouping = createSelector(
  [selectAllTasksArray, selectCurrentGrouping],
  (tasks, currentGrouping) => {
    const grouped: Record<string, typeof tasks> = {};

    if (!currentGrouping) return grouped;

    tasks.forEach(task => {
      let key: string;
      if (currentGrouping === 'status') {
        key = task.status;
      } else if (currentGrouping === 'priority') {
        key = task.priority;
      } else if (currentGrouping === 'phase') {
        // For phase grouping, use 'Unmapped' for tasks without a phase
        if (!task.phase || task.phase.trim() === '') {
          key = 'Unmapped';
        } else {
          key = task.phase;
        }
      } else {
        key = task.phase || 'Development';
      }

      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(task);
    });

    // Sort tasks within each group by order
    Object.keys(grouped).forEach(key => {
      grouped[key].sort((a, b) => (a.order || 0) - (b.order || 0));
    });

    return grouped;
  }
);

// Helper function to get group colors
const getGroupColor = (groupType: GroupingType, value: string): string => {
  const colorMaps = {
    status: {
      todo: '#f0f0f0',
      doing: '#1890ff',
      done: '#52c41a',
    },
    priority: {
      critical: '#ff4d4f',
      high: '#ff7a45',
      medium: '#faad14',
      low: '#52c41a',
    },
    phase: {
      Planning: '#722ed1',
      Development: '#1890ff',
      Testing: '#faad14',
      Deployment: '#52c41a',
      Unmapped: '#fbc84c69',
    },
  };

  const colorMap = colorMaps[groupType];
  return (colorMap as any)?.[value] || '#d9d9d9';
};

export default groupingSlice.reducer;
