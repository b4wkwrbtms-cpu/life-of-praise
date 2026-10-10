# Mobile workspace v27

The mobile workspace follows the supplied references with warm ivory surfaces,
olive primary actions, quiet card borders, consistent type and a selected-icon
capsule in the bottom navigation. Existing worship data and permissions are
unchanged; no database migration is required.

## Changes

- Reorganized weekly actions into rehearsal, sharing and whole-week download.
- Made song rows, archive cards, profile, support, search and selection surfaces
  consistent. Support and global church management remain at the bottom.
- Kept primary archive actions visible; put history, duplication and destructive
  management in an accessible Radix menu. Existing confirmation dialogs remain.
- Expanded commonly used tap targets to 44–48 CSS px, including close, page,
  section-order, palette, color and adjustment controls. Inputs retain 16px type.
- Connected the whole fixed-song card label to its native checkbox.
- Remembered tab scroll positions in memory, scoped to account and church.
  Reselecting a tab returns to the top. Dialogs do not navigate the workspace.
- Made personal score tools collapsible on mobile, with a persistent entry.
  Choosing a cue collapses the tools; placement instructions and cancel remain
  visible above the score. Focus mode can be exited through the same entry.
- Fitted the personal score dialog to the visual viewport, with compact layouts
  for the software keyboard/landscape and safe-area spacing. Scroll and native
  pinch zoom on the paper and the existing marker drag geometry are preserved.
- Kept the song-setting/score navigation outside the editor's scrolling fieldset.

## Verification

Passed:

- `node tests/mobile-workspace.mjs`: actual hook/handler behavior for navigation,
  account/church isolation, primary destinations, role-specific archive actions,
  deletion confirmation, fixed selection, tool collapse and focus-mode return;
  static rendering of weekly actions; CSS compilation for Safari 15.4 and
  Chrome 100 targets without warnings.
- `node tests/editor-navigation.mjs`: selected-page retention, viewport geometry,
  stable pane navigation and responsive hero structure.
- `node tests/song-form-ui.mjs`: form identity and editor controls.
- `node tests/score-render.mjs`: PNG geometry, large repeat labels, markers,
  personal annotations and author-separated images.
- `node tests/week-download.mjs`: complete ordered ZIP, error/cancel boundaries,
  dynamic song-form rendering and no stale page cache reuse.
- `node tests/score-views.mjs` and `node tests/score-view-selection.mjs`: separate
  authors, late-response isolation, retry and accessible selection.
- TypeScript no-emit check, production build and whitespace check.

No production church data was used or changed in testing. Browser screenshot QA
and real iPhone/Android touch testing were unavailable in this environment.
CSS compilation and component tests do not establish real-device layout or
gesture compatibility; those checks remain unverified.
