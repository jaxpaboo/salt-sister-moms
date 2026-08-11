# Salty Ideas (Salt Sister Moms)

A private, single-user website for tracking **Salty Ideas** — craft / lifestyle
projects that the Salt Sister Moms team wants to plan, draft, archive, and
post. Built as a private Angular SPA backed by Firebase Realtime Database,
sharing the auth + DB patterns established in
[`firemenu_v2`](../temp/firemenu_v2/README.md).

The site is designed primarily for use on a laptop, with a responsive
layout that also reads well on a standard mobile browser.

---

## Stack

- **Angular 21** (standalone components, signals, the new `provide*` API)
- **Firebase Realtime Database** for storage
- **Firebase Identity Toolkit REST API** for email / password auth
  (no `@angular/fire`, no `firebase` SDK — keeps the dependency surface tiny)
- **Firebase Hosting** for deployment
- SCSS, no extra UI framework

## What's in here

```
src/
  app/
    app.component.{ts,html,scss}       # Dashboard shell, wires services → views
    app.config.ts                      # provideRouter / provideHttpClient
    components/
      app-header/                      # Branding, tabs, sign-in / new-idea controls
      confirmation-toast/              # Confirm-before-delete dialog
      login-modal/                     # Email/password login form
      project-card/                    # Individual Salty Idea card
      project-list/                    # Dashboard grid of cards
      project-form/                    # Create / edit modal
    models/
      project.ts                       # Project interface + enum-ish option lists
      sponsor.ts                       # Sponsor table shape
      inspiration.ts                   # Inspiration table shape
      project-id.ts                    # YYYYMMDDnnn generator
    services/
      auth.service.ts                  # signIn / signOut / token refresh
      db.service.ts                    # Tiny RTDB REST CRUD wrapper
      projects.service.ts              # Project + sponsor + inspiration state
  environments/
    firebase.env.example.ts            # Tracked template for local secrets
    firebase.env.ts                    # (GITIGNORED) real values go here
  index.html
  main.ts
  styles.scss
```

The three Firebase tables — `projects`, `sponsors`, `inspirations` — live at
the root of the Realtime Database and are described in detail under
**Data model** below.

## First-time setup

```bash
# 1. Install Angular's CLI locally if you haven't already.
npm install -g @angular/cli

# 2. Install dependencies.
npm install

# 3. Copy the env template and fill in the Firebase Web API key.
#    Create a user in the Firebase Console (Authentication → Sign-in method →
#    Email/Password) and then paste the matching Web API key here.
cp src/environments/firebase.env.example.ts src/environments/firebase.env.ts
# Edit src/environments/firebase.env.ts and replace the placeholder.

# 4. Sign in to Firebase from the CLI so `firebase deploy` works.
npx firebase login

# 5. Make sure the project ID in .firebaserc lines up with your Firebase
#    project. This repo ships pointing at "salt-sister-moms".
```

## Run locally

```bash
npm start
```

That runs `ng serve` with `proxy.conf.json` mapping `/firebase-api` to the
Identity Toolkit host. Open <http://localhost:4200/>.

## Build for production

```bash
npm run build
```

Output goes to `dist/salt-sister-moms/browser/` (this is what
`firebase.json` points at for hosting).

## Deploy

```bash
npx firebase deploy --only hosting
```

The `.firebaserc` already pins the default project to `salt-sister-moms`, so
no flags are needed. Run `npx firebase use --add` if you ever need to point
the CLI at a different project.

## Data model

### `projects`

| Field | Type | Notes |
| --- | --- | --- |
| `project_id` | string | YYYYMMDDnnn, generated on create (see below) |
| `idea_title` | string | Required, free text |
| `idea_description` | string | Long form, optional |
| `seasons` | string[] | Subset of the `SeasonOccasion` union |
| `status` | string | One of `STATUS_OPTIONS` |
| `work_in_process` | bool | Checkbox — yes/no |
| `post_date` | string | `YYYY-MM-DD` only |
| `due_date` | string | `YYYY-MM-DD` only |
| `canva_printable` | string | URL to the Canva design |
| `difficulty` | string | `easy` / `medium` / `hard` / `expert` |
| `sponsor_id` | string | FK into `sponsors` |
| `inspiration_id` | string | FK into `inspirations` |
| `materials` | `{ text: string; done: boolean }[]` | Same shape as `checklist`; one row per material |
| `checklist` | `{ text: string; done: boolean }[]` | Per-project |
| `repostable` | string | `Yes` / `No` / `Maybe` |
| `interest_level` | number \| null | 1–5 stars |
| `updated_at` | string | ISO timestamp, set on every save |

### `sponsors`

| Field | Type |
| --- | --- |
| `sponsor_id` | string |
| `name` | string |
| `description` | string |
| `contact` | string |
| `email` | string |
| `phone_number` | string |
| `product` | string |

### `inspirations`

| Field | Type |
| --- | --- |
| `inspiration_id` | string |
| `name` | string |
| `image_link` | string |
| `video_link` | string |
| `comments` | string |
| `materials` | string |

## The `project_id` scheme

Each project gets a string id shaped like `YYYYMMDDnnn`, where `YYYYMMDD`
is the date the row was created and `nnn` is a zero-padded, 1-based counter
that resets every calendar day. So the first project created on August 10,
2026 is `20260810001`, the second is `20260810002`, and so on.

The id is generated client-side from `src/app/models/project-id.ts`, which
counts existing rows for the day and adds one. The first three rows for the
day will be `…001`, `…002`, `…003`.

This means we **don't** use Firebase's auto-id for projects; we deliberately
use the user-friendly id as the RTDB key so it's sortable and human-readable.

## Security rules (recommended starting point)

Realtime Database rules live in the Firebase Console under **Realtime
Database → Rules**. A bare-minimum rule for a private single-user site looks
like this:

```json
{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null",
    "projects": {
      ".indexOn": ["status", "updated_at"]
    },
    "sponsors": {},
    "inspirations": {}
  }
}
```

Add `.validate` rules as the schema matures.

## Security note on the API key

The Firebase **Web API key** is a public identifier — it identifies the
project, not your data. Real access control still has to happen in the
database rules. Even so, treat it like any other secret: rotate it if it
ever ends up in a place you don't trust (e.g. a public conversation
transcript) and keep the dev `.env` file out of git.
