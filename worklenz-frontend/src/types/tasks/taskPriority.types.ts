export interface ITaskPriority {
  id: string;
  name: string;
  value: string;
  color_code?: string;
  color_code_dark?: string;
}

export interface ITaskPrioritiesGetResponse extends ITaskPriority {
  color_code?: string;
  color_code_dark?: string;
}
