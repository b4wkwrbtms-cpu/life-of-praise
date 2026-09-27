# 생명의 찬양

A Korean worship-team workspace. Sign in using platform-owned ChatGPT authentication, then set a name and one of six musician positions or the congregation/ministry roles (성도, 교역자). Role labels never grant administrative permissions. Only the configured owner account can register and publish official worship plans. Team members require an invitation code plus the Site audience's viewing permission.

## Product

- Weekly scripture, set list, part-specific guidance and rehearsal notes.
- JPG/PNG and multi-page PDF score uploads into R2. PDF processing takes place in the browser using locally bundled PDF.js resources.
- Intro, V, V1, V2, PC, C, Inter, Bridge, Outro builder; adjustable top-space placement, an opaque white backing sized to wrapped form text, and optional added margin.
- Common score section labels (Intro, Verse, Verse 1, Verse 2, PC, Chorus, Inter, Bridge, Outro): tap above a staff to place a compact black outlined label; drag in two dimensions, adjust only the selected label’s size, or use keyboard-accessible position sliders. Inline labels with the same selected size use matching box dimensions and font size; V1/V2 stay abbreviated with no text-dependent shrinking. Top song-form position, width, font size and added header are stored separately for each score page. New edits preserve the original page width, with no left gutter. Previously published versions retain their original label layout. Markers are page-bound, shared on publication, and retained in archived versions and exports.
- Shared Canvas renderer for preview and downloadable PNGs. Published exports are persisted.
- User-isolated, editable performance cues with dragging, size/color, section links, undo and persistent exports.
- Date-based archive, immutable publication snapshots, copy-to-new-week workflow.
- Song and service discussions with replies, images, resolved and pinned states.
- Automatic refresh every five seconds while visible, with focus/reconnect refresh. Open scores never change without the viewer choosing the latest version.
- Installable home-screen manifest. Native push, offline cache, handwriting, and combined-PDF export remain future scope from the approved plan.

## Runtime

Logical bindings: D1 `DB`, R2 `BUCKET`. Runtime secret: `OWNER_EMAIL` (configured through Sites). The stable forwarded user ID owns records; the owner email is used only to authorize first profile creation. Source contains no production secret or owner address.

`db/schema.ts` and committed Drizzle migrations own the schema. Do not mutate schema during requests. Publishing uses immutable versions and optimistic revision checks. Personal annotations are versioned and scoped to the authenticated user; source replacements require review instead of silently reattaching markers.

## Validation

Use the Sites build workflow, then `node tests/api-integration.mjs` and `node tests/score-render.mjs`. Integration tests run against an isolated in-memory Miniflare instance with synthetic identities. They never touch production or the user's plans. Canvas tests use a generated staff fixture; no copyrighted score is bundled.

`pnpm exec tsc --noEmit` validates types. `pnpm run db:generate` generates migrations for deliberate schema changes. The app uses the existing Sites managed preview and publication scripts.

## Access

A new Site is owner-private. The owner must use Site sharing to authorize team viewers; application invitation codes then permit those signed-in users to join the team. Application invitations cannot override Site-level access. No app-owned passwords are stored.

## Preparation and rehearsal refinements

- Repeated song-form buttons: `Cx2` and `Bridge x 2`, including normalized pasted arrows, multiplication signs, commas and line breaks. Existing score section boxes keep their geometry.
- Opening an unchanged plan no longer writes a draft. Serial autosave, online retry, visible saved status, editing lock during publication and upload, and per-action undo/redo preserve work. Missing publication fields link to the relevant song.
- Mobile preparation has separate details and score workspaces, with page controls and page-specific header settings beside the preview.
- The archive includes unpublished and revised drafts; multi-selection safely discards only revisions of published worship, moves unpublished worship to trash, and restores multiple trashed services.
- The rehearsal reader supports page/width/150% views, minimal controls, next-song hints, remembered viewing position per published version on this device, and no page-turn during multi-touch zoom.
- Copying to chat supports optional full scripture, song forms and notices. New-week copies advance the service date.
- Personal-cue relocation keeps the original position until confirmed; rendering a common image never writes into personal annotations.

`node tests/workflow.mjs` checks repeat parsing, service selection, readiness and copy dates. No production records are seeded or modified by tests.

## Chat sharing and permanent trash deletion

Chat copy includes each song's saved YouTube or reference-audio URL by default, with a toggle to omit links. Empty or invalid links produce no dangling label. No external messages are sent automatically.

Admins can permanently delete one or selected trashed services. The confirmation names the dates/titles and explains that restoration will no longer be possible. The server atomically deletes the revision-matched service plus its versions, comments, personal cues and confirmations. Unreferenced associated file metadata and blobs are cleaned up; files referenced by other services (including trash), archived versions, fixed songs, personal sheets or comments are retained. Cleanup failure is logged without reversing a completed service deletion. Tests use isolated synthetic records only.
