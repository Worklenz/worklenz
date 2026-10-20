export interface IWhatsNewRelease {
  id: string;
  title: string;
  body_markdown: string;
  published_at: string;
  changelog_url: string | null;
  preview_text: string;
}

// Latest published release regardless of the 7-day window or dismissals.
// `is_new` is true only while the release is still inside the window.
export interface ILatestWhatsNewRelease extends IWhatsNewRelease {
  is_new: boolean;
}
