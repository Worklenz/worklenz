import { createSlice, PayloadAction, createSelector } from '@reduxjs/toolkit';
import { GroupingState, TaskGroup } from '@/types/task-management.types';
import { RootState } from '@/app/store';
import { taskManagementSelectors } from './task-management.slice';

const initialState: GroupingState = {
  currentGrouping: 'status',
  customPhases: ['Planning', 'Development', 'Testing', 'Deployment'],
  groupOrder: {
    status: ['todo', 'doing', 'done'],
    priority: ['critical', 'high', 'medium', 'low'],
    phase: ['Planning', 'Development', 'Testing', 'Deployment'],
  },
  groupStates: {},
};

const groupingSlice = createSlice({
  name: 'grouping',
  initialState,
  reducers: {
    setCurrentGrouping: (state, action: PayloadAction<'status' | 'priority' | 'phase'>) => {
      state.currentGrouping = action.payload;
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
    
    updateGroupOrder: (state, action: PayloadAction<{ groupType: string; order: string[] }>) => {
      const { groupType, order } = action.payload;
      state.groupOrder[groupType] = order;
    },
    
    toggleGroupCollapsed: (state, action: PayloadAction<string>) => {
      const groupId = action.payload;
      if (!state.groupStates[groupId]) {
        state.groupStates[groupId] = { collapsed: false };
      }
      state.groupStates[groupId].collapsed = !state.groupStates[groupId].collapsed;
    },
    
    setGroupCollapsed: (state, action: PayloadAction<{ groupId: string; collapsed: boolean }>) => {
      const { groupId, collapsed } = action.payload;
      if (!state.groupStates[groupId]) {
        state.groupStates[groupId] = { collapsed: false };
      }
      state.groupStates[groupId].collapsed = collapsed;
    },
    
    collapseAllGroups: (state) => {
      Object.keys(state.groupStates).forEach(groupId => {
        state.groupStates[groupId].collapsed = true;
      });
    },
    
    expandAllGroups: (state) => {
      Object.keys(state.groupStates).forEach(groupId => {
        state.groupStates[groupId].collapsed = false;
      });
    },
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
} = groupingSlice.actions;

// Selectors
export const selectCurrentGrouping = (state: RootState) => state.grouping.currentGrouping;
export const selectCustomPhases = (state: RootState) => state.grouping.customPhases;
export const selectGroupOrder = (state: RootState) => state.grouping.groupOrder;
export const selectGroupStates = (state: RootState) => state.grouping.groupStates;

// Complex selectors using createSelector for memoization
export const selectCurrentGroupOrder = createSelector(
  [selectCurrentGrouping, selectGroupOrder],
  (currentGrouping, groupOrder) => groupOrder[currentGrouping] || []
);

export const selectTaskGroups = createSelector(
  [taskManagementSelectors.selectAll, selectCurrentGrouping, selectCurrentGroupOrder, selectGroupStates],
  (tasks, currentGrouping, groupOrder, groupStates) => {
    const groups: TaskGroup[] = [];
    
    // Get unique values for the current grouping
    const groupValues = groupOrder.length > 0 ? groupOrder : 
      [...new Set(tasks.map(task => {
        if (currentGrouping === 'status') return task.status;
        if (currentGrouping === 'priority') return task.priority;
        return task.phase;
      }))];
    
    groupValues.forEach(value => {
      const tasksInGroup = tasks.filter(task => {
        if (currentGrouping === 'status') return task.status === value;
        if (currentGrouping === 'priority') return task.priority === value;
        return task.phase === value;
      }).sort((a, b) => a.order - b.order);
      
      const groupId = `${currentGrouping}-${value}`;
      
      groups.push({
        id: groupId,
        title: value.charAt(0).toUpperCase() + value.slice(1),
        groupType: currentGrouping,
        groupValue: value,
        collapsed: groupStates[groupId]?.collapsed || false,
        taskIds: tasksInGroup.map(task => task.id),
        color: getGroupColor(currentGrouping, value),
      });
    });
    
    return groups;
  }
);

export const selectTasksByCurrentGrouping = createSelector(
  [taskManagementSelectors.selectAll, selectCurrentGrouping],
  (tasks, currentGrouping) => {
    const grouped: Record<string, typeof tasks> = {};
    
    tasks.forEach(task => {
      let key: string;
      if (currentGrouping === 'status') key = task.status;
      else if (currentGrouping === 'priority') key = task.priority;
      else key = task.phase;
      
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(task);
    });
    
    // Sort tasks within each group by order
    Object.keys(grouped).forEach(key => {
      grouped[key].sort((a, b) => a.order - b.order);
    });
    
    return grouped;
  }
);

// Helper function to get group colors
const getGroupColor = (groupType: string, value: string): string => {
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
    },
  };
  
  return colorMaps[groupType as keyof typeof colorMaps]?.[value as keyof any] || '#d9d9d9';
};

export default groupingSlice.reducer; 