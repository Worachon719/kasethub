-- Narrow ProduceCategory to the four categories in the brief, add the
-- storefront columns, and create broker_watches.
--
-- Generated from `prisma migrate diff` against the live database, then
-- reordered by hand. Two reasons it is not applied with `prisma db push`:
--
--   1. P1014. `db push` builds a shadow database to detect drift, and the
--      Supabase pooler will not allow one to be created. Applying the exact
--      deterministic SQL skips the shadow database entirely.
--
--   2. The generated diff contains an ordering bug. It emits
--      `ALTER TABLE "broker_watches" ALTER COLUMN "category"` before
--      `CREATE TABLE "broker_watches"`, because it assumes the table already
--      exists. Run as-is it fails on the missing table. The statements below
--      perform exactly the same set of operations in a valid order: the enum
--      swap happens first, and broker_watches is then created against the
--      already-narrowed type.
--
-- Additive only. No column and no row is dropped.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Narrow the enum on the two tables that already exist.
--
-- Postgres cannot remove a value from an enum, so the type is rebuilt and the
-- columns are cast across. This only works because the rows using the old
-- values were cleared first (scripts/clear-removed-categories.mjs) — the cast
-- fails outright on a row still holding e.g. 'PROCESSED'.
-- ---------------------------------------------------------------------------
CREATE TYPE "ProduceCategory_new" AS ENUM (
    'FRESH_FRUIT',
    'NATURAL_PRODUCT',
    'READY_TO_EAT',
    'DRIED_FOOD'
);

ALTER TABLE "lots"
    ALTER COLUMN "category" TYPE "ProduceCategory_new"
    USING ("category"::text::"ProduceCategory_new");

ALTER TABLE "market_prices"
    ALTER COLUMN "category" TYPE "ProduceCategory_new"
    USING ("category"::text::"ProduceCategory_new");

ALTER TYPE "ProduceCategory" RENAME TO "ProduceCategory_old";
ALTER TYPE "ProduceCategory_new" RENAME TO "ProduceCategory";
DROP TYPE "ProduceCategory_old";

-- ---------------------------------------------------------------------------
-- 2. Storefront columns. Nullable, so no existing user row needs a backfill.
-- ---------------------------------------------------------------------------
ALTER TABLE "users"
    ADD COLUMN "shop_description" TEXT,
    ADD COLUMN "shop_name" TEXT;

-- ---------------------------------------------------------------------------
-- 3. broker_watches. Created now that the enum is narrowed, so the column
--    picks up the four-value type directly.
-- ---------------------------------------------------------------------------
CREATE TABLE "broker_watches" (
    "id"            TEXT NOT NULL,
    "user_id"       TEXT NOT NULL,
    "category"      "ProduceCategory" NOT NULL,
    "province_id"   TEXT,
    "label"         TEXT,
    "min_quantity_kg" INTEGER,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "broker_watches_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "broker_watches_user_id_category_idx"
    ON "broker_watches"("user_id", "category");

CREATE INDEX "broker_watches_province_id_idx"
    ON "broker_watches"("province_id");

ALTER TABLE "broker_watches"
    ADD CONSTRAINT "broker_watches_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "broker_watches"
    ADD CONSTRAINT "broker_watches_province_id_fkey"
    FOREIGN KEY ("province_id") REFERENCES "provinces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
