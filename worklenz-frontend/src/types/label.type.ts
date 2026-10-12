export interface ITaskLabel {
  id?: string;
  name?: string;
  color?: string;
  color_code?: string;
  team_id?: string;
  selected?: boolean;
  end?: boolean;
  names?: string | string[];
  usage?: number;
}

export interface LabelType {
  labelId: string;
  labelName: string;
  labelColor: string;
}
