# 생명의 찬양

A Korean worship-team workspace with separate church spaces. Sign in using platform-owned ChatGPT authentication. New leaders apply with a single-use invitation issued by the platform owner; the owner must approve the applicant and church together before a church or leader membership is created. Team invitations join only the issuing church and cannot grant leadership. The configured owner is the platform-wide administrator, while approved leaders manage only their own churches.

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

Logical bindings: D1 `DB`, R2 `BUCKET`. Runtime secret: `OWNER_EMAIL` (configured through Sites) identifies the platform-wide administrator. The stable forwarded user ID owns records and memberships. Source contains no production secret or owner address.

`db/schema.ts` and committed Drizzle migrations own the schema. Do not mutate schema during requests. Publishing uses immutable versions and optimistic revision checks. Personal annotations are versioned and scoped to the authenticated user; source replacements require review instead of silently reattaching markers.

## Validation

Use the Sites build workflow, then `node tests/api-integration.mjs` and `node tests/score-render.mjs`. Integration tests run against an isolated in-memory Miniflare instance with synthetic identities. They never touch production or the user's plans. Canvas tests use a generated staff fixture; no copyrighted score is bundled.

`node tests/church-isolation.mjs` starts with populated pre-migration tables, applies church and governance migrations, and checks scoped roles, approved church creation, cross-church IDs/files, private attachments, invitations, revoked membership, last-leader protection, suspension, and platform-owner access.

`node tests/church-governance.mjs` checks owner-only leader codes, code expiry/revocation/single use, approval and rejection, concurrent applications and approvals, blocked self-promotion, scoped development requests and replies, idempotent submissions, optimistic status updates, and suspended/revoked access. All test users and records are synthetic and isolated from production.

`pnpm exec tsc --noEmit` validates types. `pnpm run db:generate` generates migrations for deliberate schema changes. The app uses the existing Sites managed preview and publication scripts.

## Access

Site audience and application memberships are separate gates. The current Site audience is retained during updates; application invitations cannot override a restricted Site audience. No app-owned passwords are stored.

## Church spaces

- Logical tenant isolation uses shared D1/R2 infrastructure. Each church has its own leaders, memberships, invitations, worship plans, fixed-song catalog and files. Versions, discussions, personal cues and trash are checked through the owning service's church.
- The default church is `uelin`, displayed as **유엘인교회 찬양팀**. Schema defaults retain existing files, services and fixed songs. An idempotent data-only migration copies existing profiles into this church's memberships and preserves the old invitation. New accounts have no legacy membership.
- Only the platform owner issues leader application codes. Codes expire after seven days, accept one application, and are stored as hashes; the plaintext is displayed once on issuance. Applying creates no church or membership. Owner approval atomically creates the church and applicant's leadership; rejection records a reason and requires a new code to reapply. Direct church creation and local role promotion are blocked. Existing leaders and memberships are preserved.
- Membership roles and positions are separate for each church; disabling membership affects only that church. The final active leader cannot be removed. Church team codes never grant access to another church or permission to open a new church.
- The platform administrator can switch to any church, rename it, approve applications, and suspend/reopen its operation while preserving records. The default church cannot be suspended.
- Every resource API derives membership from authenticated identity and the selected church. Client headers, the selection cookie and file query parameters select context but never confer access. Immutable score URLs include church context so separate tabs remain independent.
- The platform owner enters 전체 교회 관리 from the header or the top of 내 정보: church list, approval queue, leader invitations, and development requests. It has no direct church-creation or team-join controls. Other members use 내 정보 for invited joining/switching or an owner-code-protected leader application. Approved leaders manage their own team invitations.

## Church development requests

- 개발자에게 부탁해요 is available in each church. Members can submit categorized requests and reply; only that church and the platform owner can read them. The server derives the church and author from membership, never from submitted body fields.
- The owner sees all requests with church/status/search filters, replies as 개발자, and changes status through 접수, 검토 중, 진행 중, 완료, 보류. Status changes use optimistic revision checks; request/reply IDs make retrying the same submission idempotent.
- This is a request and progress board. Church-specific development is carried out separately after reviewing a request; submissions do not execute code. Billing and the proposed monthly subscription are not enabled.

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
