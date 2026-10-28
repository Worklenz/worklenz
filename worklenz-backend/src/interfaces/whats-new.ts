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

/** The most recently published release regardless of the 7-day window or the
 * requesting user's dismissals. `is_new` is true only while the release is
 * still inside the window, i.e. when the nav tag would show it. */
export interface ILatestRelease extends ICurrentRelease {
  is_new: boolean;
}
