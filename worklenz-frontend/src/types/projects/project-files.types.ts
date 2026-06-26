export type ProjectFilesSortField = 'name' | 'size' | 'created_at' | 'uploaded_by';
export type ProjectFilesSortOrder = 'asc' | 'desc';

export interface ProjectFile {
  id: string;
  name: string;
  size: number;
  type: string;
  created_at: string;
  uploaded_by?: string;
  url?: string;
}

export interface ProjectFilesResponse {
  files: ProjectFile[];
  total: number;
  storage_used: number;
  file_count: number;
}
