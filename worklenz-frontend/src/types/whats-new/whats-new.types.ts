export interface IWhatsNewRelease {
  id: string;
  title: string;
  body_markdown: string;
  published_at: string;
  changelog_url: string | null;
  preview_text: string;
}
