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

Version 1 cannot persist nested lists, multiple paragraphs inside one quote or
list item, or callouts. The editor schema restricts those structures; imported
HTML is normalized to supported blocks while retaining text. Tab indentation
is deferred until the persisted format supports nesting.

Validation covers format round trips, imported HTML normalization, one editable
surface, cross-block formatting/undo, paragraph split/merge, multi-paragraph
paste/undo, click-to-write, list continuation/exit, checklists, and mentions.
Component interaction tests run under both Ant Design theme algorithms.

## Phase 2: Writing commands and contextual block controls

- Add searchable `/` commands with arrow navigation, Enter, Escape, and an
  accessible empty result state. Coordinate suggestion handling with `@` and `#`.
- Show a small plus and drag/menu handle beside the hovered or focused block.
  Provide touch access and keyboard move actions.
- Add “Turn into” and move duplicate/delete actions into the block menu.
- Verify shortcuts for headings, bullet/numbered lists, and checklists, including
  IME input and the overlap between heading shortcuts and task suggestions.
- Introduce a versioned content change for nested lists and callouts. Update
  backend validation, plain-text extraction, mention extraction, duplication,
  and legacy conversion before enabling those structures in the editor.
- Test Tab/Shift+Tab, mixed nested lists, paste, undo, and backend round trips.

## Phase 3: Layout and navigation

- Simplify the permanent formatting toolbar while retaining the floating toolbar
  and a discoverable route to formatting without a selection.
- Add a full-width preference while retaining the readable default width.
- Build breadcrumbs on the existing nested-page hierarchy.
- Add a heading outline with stable navigation targets and an empty state.
- Define favorite ownership/persistence, then add favorites to page navigation.
- Verify keyboard focus, mobile controls, contrast, and loading/error states in
  both themes and a real browser.
