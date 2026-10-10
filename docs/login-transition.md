# Direct Google / Apple login: transition requirements

Reviewed 2026-10-10. The live app still uses Sites dispatch-owned ChatGPT sign-in.
No Google or Apple sign-in has been enabled, and no provider credentials have been requested or stored.

## Confirmed boundary

The current Sites `identity-and-secrets` reference directs applications to preserve
platform-owned authentication and confirm platform support before adding external
providers. The exposed Site metadata/access tools do not expose a Google/Apple
provider configuration. This is not evidence that external OAuth can never be
supported; it means support on this host is unconfirmed.

Do not display provider buttons until the full login and callback flow is configured
and verified. Do not implement the platform-owned `/callback`, `/signin-with-chatgpt`
or `/signout-with-chatgpt` routes in this app.

## Required decisions before activation

1. Confirm a supported external-provider path with the host, or select an independent
   hosting and authentication environment while keeping the current app online.
2. Configure the app owner's Google OAuth client and Apple web sign-in application,
   exact production domains/callbacks and runtime secrets in the chosen environment.
3. Link a verified external provider identity to the existing internal profile ID.
   Require proof of both accounts or an explicit owner-reviewed recovery process.
   Never merge profiles or grant owner access merely because email text matches.
   Apple private-relay addresses must be supported.
4. Preserve internal IDs referenced by church memberships, services, personal scores,
   files, comments, invitations and development requests. Do not recreate members.
5. Keep leader approval, tenant membership checks and root administrator assignment
   independent from the login provider. Selecting a leader login option grants nothing.
6. Validate linking, sign-out/revocation, same-site return URLs, concurrent sessions,
   account switching, tenant isolation, invite callback recovery and iOS/Android
   standalone/browser flows. Keep a recovery path until every existing account is linked.

## Work shipped in this iteration

- A shared, bounded entry parser preserves a single invitation and its role through
  platform sign-in/sign-out. Ambiguous, repeated and empty invitation parameters are
  explained instead of silently choosing one. No invitation is stored in local storage.
- Signed-out users see the two joining paths and an actual app illustration, may
  enter a code before login, and may copy the current entry URL into their browser.
- Joining shows the authenticated account and an account-change link that retains
  the invitation. Role selection remains a navigation hint; server checks are unchanged.
- Initial authentication and server errors have separate recovery states instead of
  showing an uninitialized joining form. A 401 does not clear an already open editor's
  profile and thereby unmount its unsaved content. Full page navigation still requires
  saving work; no offline draft or cross-account restoration is claimed.
- API clients keep non-JSON upstream pages out of user error messages and preserve
  the distinction between expired authentication and denied church access.

Checks: `node tests/login-entry.mjs`, `node tests/church-governance.mjs`,
`node tests/app-setup.mjs`, TypeScript, and the Sites production build.
Browser/physical-device QA is separate from these automated checks.
