export interface IDepartment {
  id?: string;
  name?: string;
}

export interface IDepartmentsViewModel {
  total?: number;
  data?: IDepartment[];
}
