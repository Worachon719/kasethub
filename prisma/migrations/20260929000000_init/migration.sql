-- KasetHub initial schema.
--
-- Generated with:
--   prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
--
-- This migration was NOT produced by `prisma migrate dev`. That command needs a
-- shadow database, and Supabase's connection pooler refuses to host one, so
-- `migrate dev` and `db push` both fail with P1014 on this project. The schema
-- reached the live database instead by running the equivalent statements
-- through `prisma db execute --file`, and this migration was then recorded with
-- `prisma migrate resolve --applied`.
--
-- Consequence to be aware of: the file describes the schema as a whole rather
-- than the incremental path that got here, which is correct for a fresh
-- database and wrong as a record of the change history. On a new environment
-- run `prisma migrate deploy` as normal; do not re-apply the earlier
-- prisma/sql/20260929_narrow_categories_and_add_storefront.sql, which is kept
-- only as the executed statement log for the existing database.

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('FARMER', 'BROKER', 'BUYER', 'ADMIN');

-- CreateEnum
CREATE TYPE "VerificationTier" AS ENUM ('UNVERIFIED', 'BASIC', 'VERIFIED', 'CERTIFIED');

-- CreateEnum
CREATE TYPE "LotStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RESERVED', 'SOLD', 'EXPIRED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ProduceCategory" AS ENUM ('FRESH_FRUIT', 'NATURAL_PRODUCT', 'READY_TO_EAT', 'DRIED_FOOD');

-- CreateEnum
CREATE TYPE "Grade" AS ENUM ('A', 'B', 'C', 'PROCESSING');

-- CreateEnum
CREATE TYPE "ColdChainStatus" AS ENUM ('AMBIENT', 'CHILLED', 'FROZEN');

-- CreateEnum
CREATE TYPE "BidStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ChatMessageKind" AS ENUM ('TEXT', 'OFFER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('ESCROW_DEPOSITED', 'QUALITY_INSPECTED', 'LOADED_SHIPPED', 'COMPLETED', 'DISPUTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Region" AS ENUM ('NORTH', 'NORTHEAST', 'CENTRAL', 'EAST', 'WEST', 'SOUTH');

-- CreateTable
CREATE TABLE "provinces" (
    "id" TEXT NOT NULL,
    "name_th" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "region" "Region" NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provinces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password_hash" TEXT,
    "line_id" TEXT,
    "whatsapp" TEXT,
    "name_th" TEXT,
    "name_en" TEXT,
    "avatar_url" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'FARMER',
    "verification" "VerificationTier" NOT NULL DEFAULT 'UNVERIFIED',
    "province_id" TEXT,
    "district" TEXT,
    "shop_name" TEXT,
    "shop_description" TEXT,
    "rating_avg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rating_count" INTEGER NOT NULL DEFAULT 0,
    "deal_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "name_th" TEXT NOT NULL,
    "name_en" TEXT,
    "tier" "VerificationTier" NOT NULL DEFAULT 'UNVERIFIED',
    "province_id" TEXT,
    "district" TEXT,
    "address" TEXT,
    "escrow_cap" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lots" (
    "id" TEXT NOT NULL,
    "lot_code" TEXT NOT NULL,
    "title_th" TEXT NOT NULL,
    "title_en" TEXT NOT NULL,
    "category" "ProduceCategory" NOT NULL,
    "grade" "Grade" NOT NULL DEFAULT 'A',
    "variety" TEXT,
    "description" TEXT,
    "ask_price_per_kg" DOUBLE PRECISION NOT NULL,
    "want_price_per_kg" DOUBLE PRECISION,
    "quantity_kg" INTEGER NOT NULL DEFAULT 0,
    "min_order_kg" INTEGER NOT NULL DEFAULT 1,
    "available_qty_kg" INTEGER NOT NULL DEFAULT 0,
    "status" "LotStatus" NOT NULL DEFAULT 'ACTIVE',
    "is_surplus" BOOLEAN NOT NULL DEFAULT false,
    "coldChain" "ColdChainStatus" NOT NULL DEFAULT 'AMBIENT',
    "organic" BOOLEAN NOT NULL DEFAULT false,
    "gap_certified" BOOLEAN NOT NULL DEFAULT false,
    "harvest_date" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "auction_ends_at" TIMESTAMP(3),
    "province_id" TEXT,
    "district" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "farmer_id" TEXT,
    "supplier_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lot_images" (
    "id" TEXT NOT NULL,
    "lot_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "alt_th" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lot_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bids" (
    "id" TEXT NOT NULL,
    "lot_id" TEXT NOT NULL,
    "bidder_id" TEXT NOT NULL,
    "price_per_kg" DOUBLE PRECISION NOT NULL,
    "quantity_kg" INTEGER NOT NULL,
    "note" TEXT,
    "status" "BidStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bids_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "order_code" TEXT NOT NULL,
    "lot_id" TEXT NOT NULL,
    "buyer_id" TEXT NOT NULL,
    "seller_id" TEXT,
    "quantity_kg" INTEGER NOT NULL,
    "price_per_kg" DOUBLE PRECISION NOT NULL,
    "subtotal_thb" INTEGER NOT NULL,
    "platform_fee" INTEGER NOT NULL DEFAULT 0,
    "net_payout_thb" INTEGER NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'ESCROW_DEPOSITED',
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_events" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "note" TEXT,
    "actor_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "order_id" TEXT,
    "bid_id" TEXT,
    "sender_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "image_url" TEXT,
    "image_alt" TEXT,
    "kind" "ChatMessageKind" NOT NULL DEFAULT 'TEXT',
    "offer_price_per_kg" DOUBLE PRECISION,
    "offer_quantity_kg" INTEGER,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "order_id" TEXT,
    "author_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broker_watches" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "category" "ProduceCategory" NOT NULL,
    "province_id" TEXT,
    "label" TEXT,
    "min_quantity_kg" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "broker_watches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_prices" (
    "id" TEXT NOT NULL,
    "category" "ProduceCategory" NOT NULL,
    "variety" TEXT,
    "province_id" TEXT,
    "price_per_kg" DOUBLE PRECISION NOT NULL,
    "change_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sparkline" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[],

    CONSTRAINT "market_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_logs" (
    "id" TEXT NOT NULL,
    "lot_id" TEXT NOT NULL,
    "price_per_kg" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'ASK',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "provinces_code_key" ON "provinces"("code");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_province_id_idx" ON "users"("province_id");

-- CreateIndex
CREATE INDEX "suppliers_province_id_idx" ON "suppliers"("province_id");

-- CreateIndex
CREATE INDEX "suppliers_tier_idx" ON "suppliers"("tier");

-- CreateIndex
CREATE UNIQUE INDEX "lots_lot_code_key" ON "lots"("lot_code");

-- CreateIndex
CREATE INDEX "lots_status_is_surplus_idx" ON "lots"("status", "is_surplus");

-- CreateIndex
CREATE INDEX "lots_category_idx" ON "lots"("category");

-- CreateIndex
CREATE INDEX "lots_province_id_idx" ON "lots"("province_id");

-- CreateIndex
CREATE INDEX "lots_farmer_id_idx" ON "lots"("farmer_id");

-- CreateIndex
CREATE INDEX "lots_expires_at_idx" ON "lots"("expires_at");

-- CreateIndex
CREATE INDEX "lots_ask_price_per_kg_idx" ON "lots"("ask_price_per_kg");

-- CreateIndex
CREATE INDEX "lot_images_lot_id_idx" ON "lot_images"("lot_id");

-- CreateIndex
CREATE INDEX "bids_lot_id_status_idx" ON "bids"("lot_id", "status");

-- CreateIndex
CREATE INDEX "bids_bidder_id_idx" ON "bids"("bidder_id");

-- CreateIndex
CREATE INDEX "bids_price_per_kg_idx" ON "bids"("price_per_kg");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_code_key" ON "orders"("order_code");

-- CreateIndex
CREATE INDEX "orders_buyer_id_idx" ON "orders"("buyer_id");

-- CreateIndex
CREATE INDEX "orders_seller_id_idx" ON "orders"("seller_id");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "order_events_order_id_idx" ON "order_events"("order_id");

-- CreateIndex
CREATE INDEX "chat_messages_order_id_created_at_idx" ON "chat_messages"("order_id", "created_at");

-- CreateIndex
CREATE INDEX "chat_messages_bid_id_created_at_idx" ON "chat_messages"("bid_id", "created_at");

-- CreateIndex
CREATE INDEX "chat_messages_sender_id_idx" ON "chat_messages"("sender_id");

-- CreateIndex
CREATE INDEX "reviews_subject_id_idx" ON "reviews"("subject_id");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_order_id_author_id_key" ON "reviews"("order_id", "author_id");

-- CreateIndex
CREATE INDEX "broker_watches_user_id_category_idx" ON "broker_watches"("user_id", "category");

-- CreateIndex
CREATE INDEX "broker_watches_province_id_idx" ON "broker_watches"("province_id");

-- CreateIndex
CREATE INDEX "market_prices_category_recorded_at_idx" ON "market_prices"("category", "recorded_at");

-- CreateIndex
CREATE INDEX "market_prices_province_id_idx" ON "market_prices"("province_id");

-- CreateIndex
CREATE INDEX "price_logs_lot_id_created_at_idx" ON "price_logs"("lot_id", "created_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "provinces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "provinces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "provinces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_farmer_id_fkey" FOREIGN KEY ("farmer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_images" ADD CONSTRAINT "lot_images_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bids" ADD CONSTRAINT "bids_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bids" ADD CONSTRAINT "bids_bidder_id_fkey" FOREIGN KEY ("bidder_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_bid_id_fkey" FOREIGN KEY ("bid_id") REFERENCES "bids"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broker_watches" ADD CONSTRAINT "broker_watches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broker_watches" ADD CONSTRAINT "broker_watches_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "provinces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_prices" ADD CONSTRAINT "market_prices_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "provinces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_logs" ADD CONSTRAINT "price_logs_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

