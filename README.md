# KasetHub

ตลาดสินค้าเกษตรล้นสวน / Thai agricultural surplus marketplace — a Next.js 15
App Router project wired to PostgreSQL (Supabase) through Prisma, configured for
Vercel.

> The `kasethub*/` folders at the repo root are the original Stitch design exports
> (`code.html` + `screen.png`). They are kept as source reference for the design
> system and are not part of the build.

## Stack

| Layer     | Choice                                                  |
| --------- | ------------------------------------------------------- |
| Framework | Next.js 15.5 (App Router, Server Components)            |
| Language  | TypeScript, `strict: true`                              |
| Styling   | Tailwind CSS 3.4, tokens from `kasethub/DESIGN.md`      |
| Database  | PostgreSQL via Prisma 5 (Supabase-compatible)           |
| Auth      | NextAuth v4, credentials + JWT sessions, bcrypt           |
| Validation| Zod at the API boundary                                 |
| Storage   | Supabase Storage for lot photos + chat photos (inline fallback) |
| Hosting   | Vercel (`vercel.json` — region `sin1`)                  |

## Layout

```
app/
  layout.tsx              fonts (Plus Jakarta Sans + Prompt), metadata
  page.tsx                landing page
  market/page.tsx         faceted marketplace (urgency/category/region counts,
                          min-lot-size chips, grid|list, sort)
  lots/[id]/page.tsx      lot detail, photo gallery, bid form, bid board, escrow
                          gauge, grower panel
  sell/page.tsx           farmer-only listing form (up to 5 photos, province required)
  dashboard/page.tsx      role-aware: seller metrics or buyer bids/orders
  dashboard/shop/page.tsx grower storefront editor
  deals/page.tsx          every thread the signed-in user is party to
  deals/[id]/page.tsx     negotiation room (chat, offer cards, accept)
  alerts/page.tsx         broker/buyer surplus watches + matching urgent lots
  brokers/page.tsx        supplier directory
  shop/[id]/page.tsx      public grower storefront
  login/page.tsx          credentials sign-in
  register/page.tsx       4-step registration with role selection
  terms/, privacy/        placeholder policy pages
  api/
    auth/[...nextauth]/route.ts
    auth/register/route.ts
    health/route.ts       liveness + DB round-trip
    lots/route.ts         GET list/filters, POST create (uploads photos), DELETE withdraw
    lots/[id]/route.ts    GET / PATCH / DELETE
    bids/route.ts         GET bid board, POST place bid
    bids/[id]/route.ts    PATCH accept|reject (creates escrow order), DELETE
    orders/[id]/route.ts  GET deal + timeline, PATCH advance escrow
    deals/[id]/route.ts            GET thread + viewer capabilities
    deals/[id]/messages/route.ts   GET transcript, POST message (photo or text)
    deals/[id]/counter-offer/route.ts  POST new terms from the counterparty
    deals/[id]/accept/route.ts      POST accept → escrow order
    alerts/route.ts        GET watches + matches, POST create watch, DELETE watch
    shop/route.ts          GET public storefront payload, PATCH own storefront
    market/prices/route.ts market price index
    provinces/route.ts    geography lookup
components/
  auth/                   login form, registration wizard, sign-out, provider
  alerts/                 watch manager, alert card (countdown + bid CTA)
  chat/                   deal room, message parts, offer cards, image picker
  dashboard/              bid approval / withdrawal controls
  lots/                   lot form, photo picker, gallery, bid form, bid board
  shop/                   storefront editor, LINE contact button
  ui/                     button, badge, card, input, countdown
  lot-card.tsx, market-ticker.tsx, site-header.tsx, escrow-gauge.tsx
lib/
  auth.ts                 NextAuth options, bcrypt helpers
  session.ts              currentUser / requireUser / requireRole
  categories.ts           the 4 produce categories + Thai labels (single source)
  deal.ts                 thread resolution, participants, capabilities, messages
  orders.ts               acceptBid — the escrow transaction
  alerts.ts               watch → matching-lot query + header badge count
  storage.ts              image storage (Supabase or inline data URL)
  upload-limits.ts        upload constants shared by browser and server
  prisma.ts               cached Prisma client singleton
  lots.ts, lot-query.ts   list select + shared where/orderBy/facet builders
  validations.ts          Zod schemas
  api.ts                  response envelopes + error mapping
  queries.ts              server-side page queries
  utils.ts                THB / weight / countdown / spoilage formatting
prisma/
  schema.prisma, seed.ts
scripts/
  generate-placeholders.mjs  deterministic SVG produce artwork → public/produce/
  check-enum-blockers.mjs    read-only: what blocks the ProduceCategory change
  inspect-db.mjs             read-only: schema/row-count survey
middleware.ts             page-level session gate
```

## Local setup

Node 18.18+, 19.8+, or 20+ (built and verified on 22.x). This is Next 15's own
floor — see `engines` in `package.json`.

```bash
npm install

cp .env.example .env.local     # then paste your Supabase connection string
                               # and set NEXTAUTH_SECRET (npx auth secret)
npm run prisma:generate
npm run prisma:deploy          # create tables (see "Migrations" below)
npm run db:seed                # optional: sample data + demo accounts
npm run dev
```

The seed prints a password for the demo accounts. `NEXTAUTH_SECRET` is not
optional — sessions are JWTs, so without a secret next-auth cannot sign the
cookie and `/login` fails.

### Migrations

`prisma migrate deploy` is the supported path. Do **not** reach for
`prisma migrate dev` or `prisma db push` against a Supabase pooler: both need
to create a shadow database, the pooler refuses, and they fail with `P1014`.
`migrate dev` is still fine locally against a plain Postgres instance.

The initial migration in `prisma/migrations/20260929000000_init` was written by
hand from `prisma migrate diff --from-empty` and recorded with
`prisma migrate resolve --applied`, because the schema had already been applied
to the live database. It describes the schema as a whole, so it is right for a
fresh environment and is *not* a record of how the live database got there.
`prisma/sql/20260929_narrow_categories_and_add_storefront.sql` is the statement
log that actually ran, kept for reference — do not re-apply it.

`prisma migrate diff --from-schema-datasource prisma/schema.prisma
--to-schema-datamodel prisma/schema.prisma` is the check that the live database
and `schema.prisma` still agree. It currently reports no difference.

`prisma migrate status` is the lighter check — it only reads
`_prisma_migrations`, so unlike `migrate diff` it does not need a shadow
database and works through the pooler. It currently reports "Database schema is
up to date".

The two files in `prisma/sql/` are one-off statements that were run by hand, not
migration history:

- `20260929_narrow_categories_and_add_storefront.sql` — already folded into the
  initial migration; do not re-apply.
- `20261001_enable_rls.sql` — enables RLS on every table. Additive and
  idempotent, so re-running it is harmless, but it is not tracked in
  `_prisma_migrations`; apply it manually on any new environment.

### Connection pool

Put `connection_limit` and `pool_timeout` on `DATABASE_URL`. Left alone, Prisma
sizes the pool at `(2 x CPU count) + 1`, which is 5 on a 2-core machine — and one
rendered page opens several connections at once (session, lot, bids, ticker,
alert count). That pool ran dry during ordinary browsing and surfaced as
`P2024 Timed out fetching a new connection`, i.e. a 500 from a perfectly
healthy database. The default in `.env.example` is 15/20; lower it on
serverless, where every instance holds its own pool.

Sessions are JWTs rather than database rows. NextAuth v4 rejects a credentials
provider on the `database` strategy (`CALLBACK_CREDENTIALS_JWT_ERROR`), so JWT
is the only option that supports password sign-in. The cost is that sign-out
clears the cookie rather than deleting a row, so a session cannot be revoked
server-side before it expires.

## Produce categories

`ProduceCategory` has exactly four main categories, and `lib/categories.ts` is
the single source of truth for the list, their order, and their Thai labels:

| Value            | ภาษาไทย            | English          |
| ---------------- | ------------------ | ---------------- |
| `FRESH_FRUIT`    | ผลไม้สด             | Fresh Fruit      |
| `NATURAL_PRODUCT`| ผลิตภัณฑ์จากธรรมชาติ | Natural Product  |
| `READY_TO_EAT`   | สินค้าพร้อมทาน       | Ready to Eat     |
| `DRIED_FOOD`     | อาหารแห้ง           | Dried Food       |

`lib/validations.ts` derives `categorySchema` from that list, so the market
filters, the `/sell` picker, the home tiles and the API enum cannot drift. A
label is never derived by stripping underscores off the enum value.

Broker/buyer contact stays a separate `/brokers` main-nav section, not a fifth
category.

Narrowing the enum from its original five values is a **breaking** change to any
existing rows. Postgres will not drop enum values that rows still use, so the
old categories must be cleared first:

```bash
node scripts/check-enum-blockers.mjs   # read-only: lists the blocking rows
```

## Lot photos

- Up to **5** photos per lot, attached on `/sell`.
- The browser re-encodes each file to JPEG (1400 px longest edge, q0.72) before
  upload, so a 5 MB phone photo becomes roughly 150 KB.
- `POST /api/lots` receives the photos as `data:` URLs, validates type and size
  server-side, then uploads them through `lib/storage.ts` and writes the
  resulting URLs as `LotImage` rows.
- **The first photo is the cover.** Order is set by an explicit "ตั้งเป็นปก"
  action rather than drag and drop, and `LotImage.sortOrder` is the only
  ordering any reader relies on — the cover renders on lot cards, the market
  grid and the detail hero, and the detail view has a thumbnail gallery.
- Without `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` the images are kept as
  inline data URLs, bounded by `MAX_INLINE_BYTES`. That is a development
  convenience, not production storage.

## Surplus alerts

`BrokerWatch` is a saved filter, not a stored alert row — matching lots are
computed at read time. A materialised `Alert` table would need a background job
to create, a sweep to expire and a cascade to clean up, and the moment any of
those lapses a broker is looking at a stale list. A watch cannot go stale.

- `/alerts` — brokers and buyers only. Create/delete watches; see the matching
  lots sorted by remaining time, each with a countdown and an "เสนอราคา" button.
- A watch matches an `ACTIVE` lot in the same category that expires within
  **2 days** (the `critical` + `urgent` window), optionally narrowed to one
  province and a minimum quantity.
- An empty watch list matches **nothing**. The `where` builder returns `null` for
  it rather than `{ OR: [] }`, which would match every lot.
- The site header shows a live match count, but only for roles that can use
  alerts. With no watches set up the query short-circuits without touching the
  lots table.

## Grower storefronts

`User.shopName`, `User.shopDescription` and `User.lineId` are optional — a
grower who has not filled them in still lists produce, they just have no shop
page. `/shop/[id]` 404s when there is no shop name, because a page with a name
and a province is not worth indexing.

- `/dashboard/shop` — edit your own storefront, FARMER or ADMIN only.
- `/shop/[id]` — public: shop name, description, province, review rating, and
  active lots as cards. Linked from the grower panel on lot detail and from lot
  cards.
- "ติดต่อทาง LINE" opens `https://line.me/ti/p/~{lineId}` in a new tab, and is
  rendered **only** when `lineId` is set. The bare handle is validated on write
  so the deep link cannot be malformed.
- Storefronts are a grower feature; brokers and buyers deliberately have none.

### Contact privacy

Phone numbers and email addresses are never exposed on a public page. This is
enforced at the query layer, not by remembering to hide a field:

- Every public select is an explicit field list. `lotInclude` in particular uses
  a named `farmer.select` rather than `farmer: true`, because the latter returns
  `passwordHash`, `phone`, `email` and `whatsapp` in the lot-create response.
- `whatsapp` is a phone number, so a `wa.me` link on the lot page would defeat
  the rule. The column is not selected at all, which means the payload cannot
  leak it even if a stray reference is reintroduced.
- Real enquiries run through the deal room, which logs the conversation against
  a bid.

### Connecting to Supabase

In Supabase → Project Settings → Database → Connection string, use:

- **local dev** — the Session pooler (port `5432`) for both variables
- **Vercel** — `DATABASE_URL` = Transaction pooler (port `6543`,
  `?pgbouncer=true&connection_limit=1`), `DIRECT_URL` = Session pooler (port `5432`)

Serverless functions open a connection per invocation, and a direct connection
will exhaust the pooler under load, so `DATABASE_URL` in production is always a
pooler string. `DIRECT_URL` stays on the Session pooler because Prisma takes
Postgres advisory locks while running migrations, which the Transaction pooler
does not support — pointing `DIRECT_URL` at 6543 makes `migrate deploy` fail
rather than silently do nothing.

### Row Level Security

RLS is enabled on every table in `public`
(`prisma/sql/20261001_enable_rls.sql`), with no policies. That is intentional and
it does not affect the app: Prisma connects as `postgres`, the table owner, and
Postgres exempts the owner from RLS.

What it does affect is the Supabase REST layer. With RLS off, the `anon` and
`authenticated` roles that PostgREST authenticates as can read every table using
only the project's public anon key — including `users.password_hash`,
`users.phone` and the full `chat_messages` transcript. That key ships in the
client bundle, so it is not a secret. Deny-by-default is the right posture
because the browser talks to this app, never to PostgREST directly.

## API

All responses share an envelope: `{ data, meta }` on success,
`{ error: { message, ... } }` on failure.

| Method   | Route                   | Notes                                                     |
| -------- | ----------------------- | --------------------------------------------------------- |
| `GET`    | `/api/health`           | 503 when the database is unreachable                        |
| `POST`   | `/api/auth/register`    | Creates the account; brokers also get a `Supplier` row      |
| `GET`    | `/api/lots`             | `q, category, province, region, status, minPrice, maxPrice, minQty, urgency, surplusOnly, organic, sort, page, perPage` |
| `POST`   | `/api/lots`             | Farmer/ADMIN only; generates a `KH-YYMMDD-XXXX` lot code   |
| `DELETE` | `/api/lots?id=`         | Withdraws a listing (owner or ADMIN)                       |
| `GET`    | `/api/lots/[id]`        | Detail with images, farmer, top pending bids                |
| `PATCH`  | `/api/lots/[id]`        | Reprice, adjust quantity, change status (owner or ADMIN)    |
| `GET`    | `/api/bids`             | Public bid board: `lotId`, `bidderId`, `status`, `perPage`  |
| `POST`   | `/api/bids`             | Buyer/Broker/ADMIN; validates lot status, min order, stock  |
| `PATCH`  | `/api/bids/[id]`        | `ACCEPTED` runs a transaction: reject rivals, reserve lot, create the escrow order |
| `DELETE` | `/api/bids/[id]`        | Bidder withdraws a pending offer                            |
| `GET`    | `/api/deals/[id]`       | Thread, standing terms, and the viewer's capabilities       |
| `GET`    | `/api/deals/[id]/messages`  | Transcript, oldest first, 200 at a time                  |
| `POST`   | `/api/deals/[id]/messages`  | Text and/or a photo (`imageDataUrl` or `imageUrl`)        |
| `POST`   | `/api/deals/[id]/counter-offer` | New price/quantity from the counterparty           |
| `POST`   | `/api/deals/[id]/accept` | Farmer accepts; delegates to `lib/orders.ts` `acceptBid`   |
| `GET`    | `/api/orders/[id]`      | Escrow events plus deal chat                                |
| `PATCH`  | `/api/orders/[id]`      | Advance the escrow milestone; `COMPLETED` marks the lot SOLD |
| `GET`    | `/api/market/prices`    | `category`, `provinceId`, `perPage`                         |
| `GET`    | `/api/provinces`        | `?region=` filter                                           |
| `GET`    | `/api/alerts`           | Watches plus matching urgent lots (BROKER/BUYER/ADMIN)       |
| `POST`   | `/api/alerts`           | Save a watch; `category` required, `provinceId`/`minQuantityKg` optional |
| `DELETE` | `/api/alerts?id=`       | Stop watching (own watches only)                             |
| `GET`    | `/api/shop?id=`         | Public storefront payload — no phone, email or `whatsapp`    |
| `PATCH`  | `/api/shop`             | Edit own storefront (FARMER/ADMIN)                           |

`/market` and the `/api/lots` route share `lib/lot-query.ts`, so page and API
results cannot drift apart.

### Authorization

No mutating route accepts an owner id from the request. The acting user always
comes from the session, and the role is re-read from the database on each
request rather than trusted from the cookie:

- `lib/session.ts` exposes `currentUser`, `requireUser`, and `requireRole`; the
  role guards throw `HttpError`, which `handleRouteError` maps to 401/403.
  Because the session is a 30-day JWT, the role is looked up per request so a
  demoted account loses its permissions immediately instead of at expiry.
- `POST /api/lots` — FARMER or ADMIN; `farmerId` is the session user.
- `POST /api/bids` — BUYER, BROKER, or ADMIN; `bidderId` is the session user,
  and bidding on your own lot is rejected.
- `/api/alerts` — BROKER, BUYER, or ADMIN. A farmer has nothing to watch: they
  are the ones publishing, and pointing them at other farmers' expiring lots
  would be an invitation to undercut each other.
- `PATCH /api/shop` — FARMER or ADMIN, and always against the session's own id.
- Deal and order routes resolve the thread first and 404 anything the caller is
  not party to. A 404 rather than a 403, so a stranger cannot probe which deal
  ids exist.
- `GET /api/bids` stays public with a `bidderId` filter on purpose: the bid board
  is part of the design and is meant to be visible.

`middleware.ts` gates `/dashboard`, `/sell`, `/deals` and `/alerts` at the page
level. It uses `withAuth` rather than `getServerSession` because the latter would
pull Prisma into the Edge bundle.

### Transactions and double submits

Every `prisma.$transaction` gets explicit `{ maxWait: 10000, timeout: 30000 }`
(`TRANSACTION_OPTIONS` in `lib/orders.ts`). Two rules keep them from timing out:

- **Read-only lookups happen outside the transaction.** A `findUnique` that
  cannot change under the transaction's snapshot does not belong inside it.
- **The transaction body stays sequential.** Independent queries are batched
  with `Promise.all` in the *read* phase, which is free, but never inside an
  interactive transaction: concurrent queries on one connection provoke P2028.
  `handleRouteError` maps P2028/P2034 to 409 so the client can retry.

Every action button disables itself and shows a pending label while its request
is in flight, backed by a `useRef` in-flight lock for the same-tick second click
that never sees a re-render. Register, login, bid submit, accept, reject,
withdraw, counter-offer, send message, escrow milestone, and lot create are all
covered.

One trap worth naming, because it produced a bug that reported itself as
something else: capture `event.currentTarget` **before** the first `await`.
React nulls `currentTarget` once the handler returns, so an
`event.currentTarget.reset()` after an `await` throws a `TypeError` — and if the
`try` block wrapped both the request and the code after it, the `catch` filed
that as "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ" while the row had in fact saved, so the
user retried against a request that had already succeeded. `watch-manager.tsx`
is the fixed reference; keep each `try` scoped to the fetch alone.

### Escrow milestones

`ESCROW_PROGRESSION` in `lib/deal.ts` is the single ordered list of milestones,
and both `PATCH /api/orders/[id]` (which rejects out-of-order moves with 409) and
the deal room's advance button read it. The button's label and its request body
come from one `nextEscrowStep` call, so they cannot disagree.

Either party may advance a step. Milestones are shared work — the farmer
inspects and loads, the buyer confirms delivery — so splitting the permission
would mean encoding an assumption about who is looking at the screen, which the
API does not do either.

## Deploying to Vercel

```bash
npx vercel
```

Set these as project environment variables:

- `DATABASE_URL` — Supabase **Transaction pooler** string (port 6543), with
  `?pgbouncer=true&connection_limit=1`. Serverless instances each hold their own
  pool, so a large `connection_limit` exhausts Supabase's connection budget
  rather than helping.
- `DIRECT_URL` — required. The **Session pooler** string (port 5432), which is
  what `prisma migrate deploy` and `prisma generate` read through
  `directUrl` in the schema. PgBouncer in transaction mode does not support the
  advisory locks Prisma takes while migrating.
- `NEXTAUTH_SECRET` — `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
  or `npx auth secret`. Must be a real random string, not the text of the
  command; anything committed to a repo is public, so a shared "secret" lets
  anyone mint a session cookie for any account id.
- `NEXTAUTH_URL` — the production origin, e.g. `https://kasethub.vercel.app`.
  Must match the deployed domain or the sign-in redirect never settles.
- `NEXT_PUBLIC_SITE_URL` — the production origin, for absolute links
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` —
  optional; without them chat photos are stored inline (capped at 700 KB)
  instead of in Storage

`vercel.json` pins the region to `bom1` (Mumbai, the same region as the
Supabase project — a cross-region round trip costs ~60 ms on every query, so
this one is worth matching), runs
`prisma migrate deploy && prisma generate && next build`, and marks `/api/*` as
`no-store`. `@prisma/client` is listed in `serverExternalPackages` so the query
engine is installed natively per build instead of being bundled into the lambda.

Migrations run as part of the build, which means `DIRECT_URL` has to be set in
Vercel or the build fails on the first deploy. If you would rather gate schema
changes behind a manual step, drop `prisma migrate deploy` from `buildCommand`
and apply them from a workstation instead — the command is
`npx prisma migrate deploy`, reads `directUrl` → `DIRECT_URL`, and is idempotent
(re-running against an up-to-date database reports "No pending migrations to
apply" and exits 0).

After the first deploy, set `NEXTAUTH_URL` and `NEXT_PUBLIC_SITE_URL` to the real
production origin and redeploy. `localhost:3000` in those two variables is the
single most common cause of a sign-in loop that never settles.

### Order of operations

1. Push the repo, import it in Vercel, and set all eight environment variables
   **before** the first deploy. Deploying with a placeholder `NEXTAUTH_SECRET`
   and then patching it invalidates every cookie issued in between.
2. Create the `chat-attachments` bucket in Supabase → Storage if you are setting
   `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`. `lib/storage.ts` falls back to
   inline data URLs when they are absent, which works but caps uploads at 700 KB.
3. Apply `prisma/sql/20261001_enable_rls.sql` on every new environment. It is
   not part of migration history, so the build command will not run it.
4. Put real content in `/terms` and `/privacy` before opening the site to the
   public — both are placeholders.

## Design system

`kasethub/DESIGN.md` is the source of truth. Tokens are mapped in
`tailwind.config.ts` and CSS custom properties in `app/globals.css`:

- primary emerald `#15803D` · harvest orange `#EA580C` · amber `#F97316`
- canvas `#FAFAF9` · borders `#E2E8F0` · ink `#0F172A`
- spoilage tiers: `<48h` red, `3–5d` amber, `>5d` green
- `tabular` class on all prices, tonnages, and countdowns
- `:lang(th)` gets 1.65 line-height so Thai tone marks never clip

## Scripts

| Script                 | Purpose                                     |
| ---------------------- | ------------------------------------------- |
| `dev`                  | Next dev server                             |
| `build`                | `prisma generate` then `next build`          |
| `start`                | Production server                           |
| `lint`                 | ESLint via `next lint`                      |
| `typecheck`            | `tsc --noEmit`                              |
| `prisma:generate`      | Regenerate the client                       |
| `prisma:push`          | Sync schema without migrations — **fails on a Supabase pooler** (`P1014`); use `prisma:deploy` |
| `prisma:migrate`       | `prisma migrate dev` — also needs a shadow DB, so same caveat |
| `prisma:deploy`        | Apply migrations (CI / production)          |
| `prisma:studio`        | Prisma Studio                               |
| `db:seed`              | Load sample data                            |

Committed, read-only diagnostics and maintenance helpers:

| Script                                     | Purpose                                                        |
| ------------------------------------------ | -------------------------------------------------------------- |
| `node scripts/inspect-db.mjs`              | Surveys schema and row counts via raw SQL                      |
| `node scripts/check-enum-blockers.mjs`     | Lists the rows blocking a `ProduceCategory` change            |
| `node scripts/clear-removed-categories.mjs` | Deletes rows holding an enum value the schema no longer has   |
| `node scripts/make-test-images.mjs`        | Writes decodable PNGs to `tmp-e2e-images/` for photo uploads  |
| `node scripts/cleanup-e2e-lots.mjs`        | Removes lots whose title starts with `E2E ` (photos cascade)   |

The last three read and write through the Prisma client. The enum-clearing
script is the exception: it is raw SQL throughout, because a client generated
from the narrowed enum cannot deserialise a legacy `'PROCESSED'` value at all —
`prisma.lot.findMany` throws before a `where` clause is ever considered.

## Dependency audit

`npm audit` is clean: **0 vulnerabilities** as of 2026-09-29. Getting there
required a framework upgrade, which is worth explaining because npm's own
suggested remedy (`npm audit fix --force` → `next@16`) overshoots by one major.

The starting point was 5 findings (1 critical, 4 high) against `next@14.2.35`
and its bundled `postcss` and `glob`. Two facts cut the problem down:

- Every `next` advisory has an upper bound below `15.5.24`. The critical
  aggregate is just the maximum severity across ~25 advisories, not one bug.
- `next@15.5.26` still accepts `react@^18.2.0`, so this was a **one**-major
  upgrade, not two. React stayed at 18.3.1.

What changed:

| Package                          | From       | To         | Why                                                            |
| -------------------------------- | ---------- | ---------- | -------------------------------------------------------------- |
| `next`                           | `14.2.35`  | `15.5.26`  | Clears all 25 `next` advisories, including both critical RCEs.  |
| `eslint-config-next`             | `14.2.35`  | `15.5.26`  | Match the framework major.                                      |
| `postcss` (override under `next`) | `8.4.31`   | `8.5.28`   | Next 15 still pins a `postcss` below the `8.5.23` fix line.    |
| `glob` (override)                | `10.4.5`   | `10.5.0`   | `-c/--cmd` shell injection; dev-only, but still a finding.     |

The two `overrides` in `package.json` are the reason this was a patch rather
than a fork. The `postcss` override is **scoped to `next`** — a top-level
`postcss` override is rejected by npm with `EOVERRIDE`, because it contradicts
the direct `postcss: ^8` devDependency.

### Upgrading to Next 15

Two breaking changes actually applied, both mechanical:

- **`params` and `searchParams` are now `Promise`s.** Typed as
  `Promise<{ id: string }>` and awaited once at the top of each handler, with
  the result aliased to `id`. Awaiting once per handler (rather than at every
  use site) means a missed migration shows up as a type error instead of a
  silent extra round trip. `app/market/page.tsx` keeps the resolved object
  under the name `searchParams`, so it still flows into `hrefWith`,
  `FilterPanel` and `Results` unchanged — those are ordinary components and
  still take it synchronously.
- **`experimental.serverComponentsExternalPackages` → `serverExternalPackages`**
  (top level in 15).

The two Next 15 changes that *could* have broken things did not apply, which is
worth knowing before the next upgrade:

- **GET Route Handlers are no longer cached by default.** All 16 API routes
  already declare `force-dynamic`, so this is a no-op here.
- **`fetch` is no longer cached by default.** There is exactly one server-side
  `fetch` in the codebase — the Supabase Storage upload in `lib/storage.ts` —
  and it is a mutation.

`next lint` is deprecated in 15 (removed in 16) and still passes, but it prints
a warning on every run. `eslint-config-next` was moved to 15 for the audit, not
because the lint config needed it.

The `images.formats: ["image/webp"]` pin stays. It is not what fixed the AVIF
RCE — the upgrade did — but it is a cheap, explicit statement that AVIF
offloading is not wanted here.

## Seed data

`prisma/seed.ts` builds a realistic Thai marketplace: 16 provinces, 7 demo
accounts with real names, shop names and LINE ids, 24 lots across the four
categories with per-kg prices and quantities, a market price index, 6 broker
watches, bids on at-risk lots, one completed order with a chat thread, and one
live negotiation.

Lot expiry is spread deliberately — `1` day (critical), `2` days (urgent) and
`9`–`300` days (comfortable) — so the urgency facets, the countdown styling and
the alert matching all have something real to show on a fresh clone. Auction
countdowns are set on the at-risk lots.

**Idempotency.** Reference data (provinces, users, the supplier, watches) is
upserted on stable keys. Volatile rows (lots, bids, orders, chat, market prices)
are deleted and rebuilt, scoped to `lotCode startsWith "KH-DEMO-"` so a lot you
created by hand is never destroyed.

**Placeholders.** `scripts/generate-placeholders.mjs` deterministically writes 14
SVGs (4 category bases + 10 variety-specific) into `public/produce/`. They are
generated rather than hand-authored, and served from the local `public` folder —
nothing references an external image host.

The demo password is shared across all seed accounts: **`kasethub123`**.
