export interface IProjectPriority {
  id: string;
  name: string;
  value: number;
  color_code?: string;
  color_code_dark?: string;
}

export interface IProjectPrioritiesGetResponse extends IProjectPriority {}
