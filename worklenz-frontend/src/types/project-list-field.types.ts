export interface ProjectListField {
  key: string;
  name: string;
  visible: boolean;
  order: number;
}

export interface ProjectListFieldState {
  fields: ProjectListField[];
  loading: boolean;
  error: string | null;
}

// Available project list field keys
export enum ProjectListFieldKey {
  FAVORITE = 'FAVORITE',
  NAME = 'NAME',
  CLIENT = 'CLIENT',
  PRIORITY = 'PRIORITY',
  STATUS = 'STATUS',
  TASKS_PROGRESS = 'TASKS_PROGRESS',
  CATEGORY = 'CATEGORY',
  UPDATED_AT = 'UPDATED_AT',
  END_DATE = 'END_DATE',
}

// Default visibility for each field
export const DEFAULT_PROJECT_FIELDS: ProjectListField[] = [
  { key: ProjectListFieldKey.FAVORITE, name: 'Favorite', visible: true, order: 0 },
  { key: ProjectListFieldKey.NAME, name: 'Name', visible: true, order: 1 },
  { key: ProjectListFieldKey.CLIENT, name: 'Client', visible: true, order: 2 },
  { key: ProjectListFieldKey.PRIORITY, name: 'Priority', visible: true, order: 3 },
  { key: ProjectListFieldKey.STATUS, name: 'Status', visible: true, order: 4 },
  { key: ProjectListFieldKey.TASKS_PROGRESS, name: 'Tasks Progress', visible: true, order: 5 },
  { key: ProjectListFieldKey.CATEGORY, name: 'Category', visible: true, order: 6 },
  { key: ProjectListFieldKey.UPDATED_AT, name: 'Last Updated', visible: true, order: 7 },
  { key: ProjectListFieldKey.END_DATE, name: 'Project End Date', visible: false, order: 8 },
];
