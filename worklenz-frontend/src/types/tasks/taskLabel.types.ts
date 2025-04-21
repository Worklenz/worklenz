export interface ITaskLabel {
  id?: string;
  name?: string;
  color_code?: string;
  team_id?: string;
  selected?: boolean;
  end?: boolean;
  names?: string[];
  usage?: number;
}

export interface ITaskLabelFilter extends ITaskLabel {
  selected?: boolean;
}
