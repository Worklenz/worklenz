export interface IActivityLog {
  project_name?: string,
  description?: string,
  created_at?: string
}

export interface ITasksOverview {
  id?: string,
  color_code?: string,
  name?: string
  min_date?: Date
  max_date?: Date
}
