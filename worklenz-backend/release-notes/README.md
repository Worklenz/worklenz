# Release notes

Each file in this folder is one "What's New" release shown to users in the app.
Files are markdown with YAML frontmatter for metadata and a markdown body below
the `---` fence.

```md
---
title: "v2.4.0 — May 2026"
published_at: 2026-05-12
changelog_url: https://worklenz.com/changelog/v2-4-0
is_active: true
---

## New Features

**Bulk task assignment**
Select multiple tasks and assign them to a team member in one action.
```

## Fields

| Field | Required | Notes |
|---|---|---|
| `title` | Yes | Max 120 characters. Shown in the modal header. |
| `published_at` | Yes | `YYYY-MM-DD`. Starts the 7-day visibility window. |
| `changelog_url` | No | Must be a valid `http://` or `https://` URL, or omitted entirely. |
| `is_active` | Yes | Set to `false` to hide the release immediately without deleting the file. Only affects the nav tag and stops new notification-drawer rows from being created — see note below. |

Supported body markdown: H2/H3 headings, bullet/numbered lists, bold, italic,
inline code, and links. Raw HTML is not rendered.

## Release identity

A release's id is its filename without the `.md` extension. Renaming a file
after publishing is treated as retiring that release and publishing a new one
under a new id — anyone who already dismissed the old one will see the
renamed one again as if it were new. Edit a file's content freely without
renaming it to avoid this.

## Which release is shown

At most one release is shown per user at a time: the most recently published
`is_active: true` release whose `published_at` is within the last 7 days,
and that this user has not already dismissed (by opening and closing the
modal). The folder is re-read on every request, so editing a file or
flipping `is_active` takes effect immediately — no restart required.

## `is_active: false` does not retract an already-delivered notification

A release surfacing in the top nav (above) is separate from the same release
also being copied into a user's persistent notification-drawer list once it
becomes eligible. That drawer notification behaves like any other real
notification — it persists once created and stays clickable regardless of
the release's current `is_active`/`published_at` state, the same way an old
task-assignment notification keeps working after the task changes. Flipping
`is_active: false` hides the nav tag and stops the release from being copied
into anyone *new*'s notification list, but it does **not** revoke access for
users who already have that notification — they can still open it and read
the full content indefinitely. To fully retract content, edit or remove the
markdown body itself rather than relying on `is_active` alone.
