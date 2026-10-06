export interface IPractice {
  id?: string;
  name?: string;
}

export interface IPracticesViewModel {
  total?: number;
  data?: IPractice[];
}
