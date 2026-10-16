# Project docs editor phases

## Phase 1: One document editor

The page body uses one Tiptap/ProseMirror editor, so selection, paste, paragraph
operations, and undo/redo share a single document state. The page title remains
a separate field. Clicking the space below the last block creates a paragraph
or reuses an existing empty trailing paragraph.

The editor converts between its internal tree and the existing `version: 1`
section format at the API boundary. Existing IDs, marks, member/task mentions,
headings, flat lists, checklists, quotes, code, and dividers remain supported.
The API, autosave, mention resolution, and timestamp conflict checks retain
their existing contracts. No database migration is needed.

Local content echoes do not call `setContent`, which would replace selections
and disrupt undo history. The parent keys the editor by page ID and reload token;
opening another page or accepting a conflict reload mounts a fresh editor.

Block insertion and duplicate/delete/move actions remain accessible through
toolbar menus during this phase. Deletion requires confirmation. Native list
Enter continues items, and Enter on an empty item exits the list.

At the end of phase 1, version 1 could not persist nested lists, multiple
paragraphs inside one quote or list item, or callouts. Phase 2 introduces the
versioned format needed to enable these structures.

Validation covers format round trips, imported HTML normalization, one editable
surface, cross-block formatting/undo, paragraph split/merge, multi-paragraph
paste/undo, click-to-write, list continuation/exit, checklists, and mentions.
Component interaction tests run under both Ant Design theme algorithms.

## Phase 2: Writing commands and contextual block controls (implemented)

- Search `/` commands at the start of a document paragraph. Localized labels and
  search keywords cover paragraphs, three heading levels, bullet/numbered lists,
  checklists, quotes, code, dividers, and callouts. Arrow keys, Enter, Escape,
  pointer selection, outside dismissal, IME input, and empty results are handled.
  The editor announces the active command through `aria-activedescendant`.
- Hover or focus a block to reveal plus and drag/menu controls. The handle opens
  “Turn into,” duplicate, delete (with confirmation), and move up/down actions.
  Shift+F10 opens the current block's menu from the editor. Touch layouts keep
  controls available. Native dragging moves whole blocks within the same editor;
  private drag payloads from other editor instances are ignored.
- Natural list shortcuts (`- `, `1. `, `[] `, `## `), Tab/Shift+Tab, list
  continuation, empty Enter, and task-mention/heading overlap are covered.
- Version 2 supports recursive `children` on list items, quotes, and callouts,
  optional `start` on numbered lists, and optional `language` on code blocks.
  The first paragraph remains in `content`; subsequent blocks use `children`.
  Nesting is limited to 20 levels and content to 500 KB. Stable IDs and inline
  marks/mentions survive round trips, paste, conversions, and duplication.
- Backend validation, legacy conversion, plain-text search extraction, and mention
  extraction understand both versions. Member notifications still deduplicate
  mentions across the full tree, and code text does not generate mentions.
- Simple existing pages continue using version 1 until an advanced feature is
  used. Once upgraded, the editor retains version 2 even if advanced content is
  removed. The update API rejects a v1 content write over an existing v2 page,
  protecting it from older browser tabs. Title-only writes remain supported.
  Content writes still use `PUT /api/v1/project-documents/:id` with
  `expected_updated_at` and `content`. Invalid content or a version downgrade
  returns HTTP 400; timestamp conflicts retain the existing HTTP 409 response.

### Deployment and rollback

Deploy the backend support before (or together with) the frontend. No database
migration is necessary: the existing JSONB column stores both versions. Existing
v1 pages need no conversion job. Before rolling back to a backend that only reads
v1, export or explicitly convert v2 pages; a v1-only backend cannot read them.

### Validation

Frontend regression coverage includes slash search/navigation/dismissal,
composition, shortcuts, list indentation, contextual conversions, drag order,
versioned format round trips, and existing formatting and mentions. Backend
coverage includes nested round trips, legacy conversion, mention deduplication,
unsafe links, invalid IDs/types/numbering, depth/size limits, and downgrade
protection. Real Chrome interaction checks exercise native keyboard input,
menus, dragging, and desktop/mobile layout in both themes.

## Phase 3: Layout and navigation

- Simplify the permanent formatting toolbar while retaining the floating toolbar
  and a discoverable route to formatting without a selection.
- Add a full-width preference while retaining the readable default width.
- Build breadcrumbs on the existing nested-page hierarchy.
- Add a heading outline with stable navigation targets and an empty state.
- Define favorite ownership/persistence, then add favorites to page navigation.
- Verify keyboard focus, mobile controls, contrast, and loading/error states in
  both themes and a real browser.
