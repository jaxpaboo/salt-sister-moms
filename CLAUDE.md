# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start                              # ng serve on http://localhost:4200
npm run build                          # production build -> dist/salt-sister-moms/browser/
npm run watch                          # dev-config build, rebuilds on change
npm test                               # ng test (Karma + Jasmine) — no spec files exist yet
npx firebase deploy --only hosting     # deploy dist/ to Firebase Hosting (project pinned in .firebaserc)
```

First-time setup requires copying `src/environments/firebase.env.example.ts` to
`src/environments/firebase.env.ts` (gitignored) and filling in the real
Firebase Web API key — see README.md for the full walkthrough. Without that
file, `AuthService` falls back to a placeholder key and sign-in fails with an
explicit error rather than a crash.

There is no linter or formatter configured (no ESLint/Prettier config in the
repo) — don't invent lint/format commands.

## Architecture

Angular 21 standalone app (no NgModules) using signals for all reactive
state. There is a single route tree with no lazy-loaded feature modules —
this is a one-page dashboard, not a multi-page app.

**State lives in two singleton services, not in components:**
- `AuthService` (`src/app/services/auth.service.ts`) — holds the Firebase
  Identity Toolkit session (idToken/refreshToken) in memory + localStorage,
  exposes `isAuthenticated`/`email` signals, and refreshes the token when it's
  within a minute of expiry via `ensureFreshToken()`.
- `ProjectsService` (`src/app/services/projects.service.ts`) — the single
  source of truth for `projects`, `sponsors`, `inspirations`, and
  `configurations` signals. All CRUD (create/update/delete/restore) goes
  through this service, which optimistically updates its own signals after
  each successful `DbService` call.
- `DbService` (`src/app/services/db.service.ts`) — a hand-rolled REST wrapper
  around the Firebase Realtime Database (`GET`/`PUT`/`PATCH`/`DELETE` against
  `<dbRoot>/<table>/<id>.json?auth=<idToken>`). There is no `@angular/fire`
  and no Firebase SDK anywhere — this keeps the dependency surface small and
  matches the pattern from the sibling `firemenu_v2` project. Auth against
  Identity Toolkit is likewise raw `HttpClient` calls, not an SDK.
  `proxy.conf.json` exists but is currently unused — auth/DB calls hit
  Google's hosts directly, not through the dev-server proxy.

**`AppComponent` is the orchestrator, not just a shell.** It owns *all*
modal visibility state (`showForm`, `showInspirationForm`, `showConfirm`,
etc.), all "editing X" state, and every open/close/save/delete handler for
every entity type. Child components (`project-form`, `inspiration-form`,
`sponsor-form`, `configuration-form`, `confirmation-toast`, `login-modal`)
are presentational: they take `@Input()` data and emit `@Output()` events
(`save`, `cancel`, `delete`) back up to `AppComponent`, which is the only
place that calls into `ProjectsService`. When adding a new entity type or
modal, follow this same pattern rather than giving a child component direct
access to `ProjectsService`.

**Routing is URL-sync only, not view-per-route.** `app.routes.ts` defines
`/projects`, `/inspirations`, `/sponsors`, `/trash` but every route has
`children: []` — there's no `router-outlet`-driven component swap. Instead
`AppComponent`'s constructor subscribes to `NavigationEnd` and calls
`syncTabFromUrl()` to derive `mainTab`/`showTrash` from the path, purely so
tabs are bookmarkable/deep-linkable. When adding a new top-level section, add
the route *and* a branch in `syncTabFromUrl()` — one without the other will
leave the URL and the visible tab out of sync.

**Data model — four flat tables at the RTDB root** (`projects`, `sponsors`,
`inspirations`, `configurations`), each a `Record<id, T>` that `DbService`
normalizes into `T[]`. Full field-by-field schema is documented in
README.md's "Data model" section — read that before adding fields.

- `project_id` is a client-generated `YYYYMMDDnnn` string (see
  `src/app/models/project-id.ts`), *not* Firebase's auto-id, chosen so ids
  sort chronologically and are human-readable. It's derived by counting
  same-day projects already in the in-memory `projects` signal, so it must
  be computed from data that's already been fetched — never assume the
  server enforces uniqueness.
- Sponsors/inspirations/configurations use timestamp-based ids
  (`spon_<ts36>`, `insp_<ts36>`, `conf_<ts36>`).
- Deleting a project is a soft-delete (`project_deleted: true` flag flipped
  via `PATCH`) so it can be restored from the Trash view;
  `activeProjects()`/`trashedProjects()` on `ProjectsService` split on that
  flag. Sponsors, inspirations, and configurations are hard-deleted.
- `materials` and `checklist` are both `ChecklistItem[]` (`{ text, done }`)
  and share one presentational component, `checklist-editor`. Older RTDB
  rows may still have `materials` as a legacy comma-separated string;
  `ProjectsService.migrateMaterials()` converts and writes those back on the
  first `refreshAll()` of the session (guarded to run once).
- The `configurations` table is an admin-editable key/value store (grouped
  by `configuration_name`, one row per `configuration_fieldname`) used to
  drive dropdown option lists — e.g. seasons and statuses — at runtime.
  Components fall back to the hardcoded `SEASON_OPTIONS`/`STATUS_OPTIONS`
  constants in `models/project.ts` when no matching configuration document
  exists yet, so a fresh install still works before an admin configures
  anything.

**Auth gates every mutation at the `AppComponent` level**: every
`openNew*`/`openEdit*`/`openConfiguration` handler checks
`auth.isAuthenticated()` first and redirects to the login modal instead of
opening the target form. Unauthenticated visitors can still browse
(`refreshAll()` runs regardless of auth state, per the effect in
`AppComponent`'s constructor), matching the "browse the demo, sign in to
edit" behavior described in the README.
