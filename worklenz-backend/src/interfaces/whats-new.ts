export interface IReleaseNote {
  id: string;
  title: string;
  body_markdown: string;
  published_at: string;
  changelog_url: string | null;
  is_active: boolean;
}

export interface ICurrentRelease {
  id: string;
  title: string;
  body_markdown: string;
  published_at: string;
  changelog_url: string | null;
  preview_text: string;
}
