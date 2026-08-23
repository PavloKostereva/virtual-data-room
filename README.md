# Vault

Virtual data room for due diligence: nested folders, uploads with progress, file preview,
and sharing via public links or named recipients.

**Stack:** Next.js 15 · React · TypeScript · Tailwind · Prisma · PostgreSQL · S3-compatible storage

| | |
|---|---|
| Live app | https://virtual-data-room-mu.vercel.app/ |
| Owner | `demo@vault.app` / `demo1234` |
| Guest | `guest@vault.app` / `demo1234` (sees **Shared with me**) |

---

## Setup

Needs Node 20+ and PostgreSQL 14+.

```bash
npm install
cp .env.example .env          # fill DATABASE_URL + Supabase keys + AUTH_SECRET
npm run db:deploy
npm run db:seed               # optional demo data + demo logins below
npm run dev                   # http://localhost:3000
```

After `db:seed` (and on the live app), sign in with:

| Role | Email | Password |
|---|---|---|
| Owner (full access, owns the seeded room) | `demo@vault.app` | `demo1234` |
| Guest (sees **Shared with me**) | `guest@vault.app` | `demo1234` |

You can also register any new email — no confirmation mail is sent.
Forgot password issues a one-time code on screen (this demo does not send email).
The seeded demo logins cannot be reset, so reviewers always have a working account.

Docker Postgres if needed:

```bash
docker run -d --name vault-db -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=dataroom postgres:16
```

### Env

**Local `.env` (5 variables):**

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Postgres |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable key (`sb_publishable_…`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret key — required for registration + `db:seed` |
| `AUTH_SECRET` | ≥32 chars — upload tickets only |

**Vercel (+4 for file storage):** `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` from Supabase Storage → S3.  
`STORAGE_DRIVER`, `S3_ENDPOINT`, and `NEXT_PUBLIC_APP_URL` are automatic.  
Use Supabase **pooler** URL (port 6543) for `DATABASE_URL`.

### Scripts

`dev` · `build` · `start` · `lint` · `typecheck` · `db:deploy` · `db:seed` · `test:smoke`

---

## What’s included

- Auth (Supabase email/password, forgot-password codes, change password, Prisma `User` sync)
- Nested folders, breadcrumbs, recursive delete with size preview
- Multi-file drag-and-drop upload, PDF/image preview, rename / move / delete
- Name conflicts: version, rename, or cancel
- Share room / folder / file — public link or invite by email; revoke anytime
- Search in folder subtree + file versioning (extra credit)
- Room list filter, rename room, share link expiry, copy item link

---

## Architecture

One Next.js app: UI + `/api/*` Route Handlers. Layers stay separate:

```
app/api     → HTTP only (Zod + defineRoute)
server/services → business rules
server/storage  → local | S3 drivers
components/hooks → UI + TanStack Query
```

Uploads never stream through the API: ticket → presigned PUT → finalize metadata.
Access always goes through `access.service` (user session or share token) with an
`AccessBoundary` so a shared subfolder cannot leak parents.

---

## Data model

```
User → DataRoom → Folder (tree via parentId + path)
                     ↓
                   File → FileVersion[]
Share (DATA_ROOM | FOLDER | FILE) → ShareGrant[]
```

Key choices:

1. **Root is a real folder** (`parentId = NULL`) — no special cases for files at room root.
2. **`Folder.path`** = `/rootId/.../selfId/` — subtree delete/stats/share resolution are prefix scans.
3. **Polymorphic `Share` + `Role`** — viewer/editor/owner without a remodel; UI only issues VIEWER today.

---

## How it scales

**Subtree size / count:** `WHERE path LIKE folder.path || '%'` aggregates (indexed). At very large
subtrees, denormalize `fileCount` / `totalSize` on `Folder`.

**100k files in one room:** keyset pagination (not offset), indexes on `(parentId, updatedAt)`,
trigram GIN for name search, bytes via blob store (not the API).

**Per-user roles later:** `Role` already on `Share` / `ShareGrant`; expose it in the share UI and
gate writes with the existing `canWrite` path — no schema rewrite.

---

## Deploy

1. Postgres (Neon/Supabase) — use a **pooled** URL on serverless  
2. S3-compatible bucket + CORS for browser PUT/GET (`STORAGE_DRIVER=local` won’t work on Vercel)  
3. Set env on Vercel → `npm run db:deploy` → `npm run db:seed` → `vercel --prod`

**Supabase Auth:** Registration uses the Admin API (`SUPABASE_SERVICE_ROLE_KEY`) to create confirmed users directly — no confirmation email is sent and no Supabase dashboard toggle is needed.

---

## Test

With `npm run dev` running:

```bash
npm run test:smoke   # 81 API checks
```

After deploy, open **`GET /api/health`** — returns JSON with configuration, database, and storage checks (and hints if something is missing).

---

## AI usage

Built with AI assistance (Cursor) as a pair-programmer. AI helped with scaffolding, seed/smoke
scripts, and mechanical cleanup. Data model, access boundaries, upload handshake, and product
scope were human decisions; generated code was reviewed and edited.
