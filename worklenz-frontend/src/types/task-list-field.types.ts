export interface TaskListField {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'checkbox';
  isVisible: boolean;
  order: number;
  width?: number;
  options?: {
    id: string;
    label: string;
    value: string;
    color?: string;
  }[];
}

export interface TaskListFieldGroup {
  id: string;
  name: string;
  fields: TaskListField[];
  order: number;
}

export interface TaskListFieldState {
  fields: TaskListField[];
  groups: TaskListFieldGroup[];
  loading: boolean;
  error: string | null;
}
