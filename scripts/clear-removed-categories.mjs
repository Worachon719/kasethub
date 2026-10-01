/**
 * Clear the rows that block the ProduceCategory enum narrowing.
 *
 * WHY THIS EXISTS
 * ---------------
 * The brief redefines ProduceCategory as exactly four values:
 *   FRESH_FRUIT, NATURAL_PRODUCT, READY_TO_EAT, DRIED_FOOD
 *
 * The database still carries the original five:
 *   FRESH_FRUIT, ORGANIC_GAP, PROCESSED, VEGETABLE, PROCESSING_GRADE
 *
 * Postgres will not drop enum values that rows still reference — the
 * `ALTER TABLE ... USING ("category"::text::"ProduceCategory_new")` cast in the
 * migration fails outright rather than silently rewriting them. So the rows
 * using removed values have to go before `prisma db push` can run.
 *
 * Every row removed here is old seed output from this project, on a dev
 * database. Nothing belonging to a real account is touched: the lots are named
 * explicitly, and MarketPrice is filtered on the removed category values only.
 *
 * SCOPE
 * -----
 *   lots          exactly the 6 named lot codes, and their bids / images /
 *                 orders / price logs / chat messages, which all cascade from
 *                 the Lot FK (see schema.prisma onDelete: Cascade)
 *   market_prices only rows whose category is one of the 4 removed values
 *
 * Everything else — the 4 users, 13 provinces, the supplier, and the 8 lots
 * that already use FRESH_FRUIT — is left in place.
 *
 * Run with: node scripts/clear-removed-categories.mjs
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** The lots to remove, named explicitly rather than matched by category. */
const BLOCKING_LOT_CODES = [
  "KH-2601-A03",
  "KH-2601-A05",
  "KH-2601-A08",
  "KH-2601-A09",
  "KH-2601-B01",
  "KH-2601-B03",
];

/** The enum values the new ProduceCategory no longer has. */
const REMOVED_CATEGORIES = [
  "ORGANIC_GAP",
  "PROCESSED",
  "VEGETABLE",
  "PROCESSING_GRADE",
];

const REMOVED_SQL = `(${REMOVED_CATEGORIES.map((c) => `'${c}'`).join(",")})`;

async function main() {
  console.log("== before ==");
  const [lotsBefore, pricesBefore] = await Promise.all([
    prisma.lot.count(),
    prisma.marketPrice.count(),
  ]);
  console.log(`   lots=${lotsBefore} market_prices=${pricesBefore}`);

  // --- Pre-flight: confirm the named lots are the ones we expect ----------
  /*
   * Raw SQL, not the model API. The generated client types `category` as the
   * NEW four-value enum, so `prisma.lot.findMany` fails to deserialise a row
   * that still says 'PROCESSED' - the very rows this script exists to remove.
   * That circularity is why every read here is raw SQL; the delete below can
   * still use the model API, because deleting never reads the column back.
   */
  const targets = await prisma.$queryRawUnsafe(
    `select id, lot_code as "lotCode", category::text as category, title_th as "titleTh"
       from public.lots
      where lot_code in (${BLOCKING_LOT_CODES.map((c) => `'${c}'`).join(",")})
      order by lot_code`,
  );

  if (targets.length === 0) {
    console.log("\nNo blocking lots found — already clear. Nothing to delete.");
    return;
  }

  console.log(`\n== deleting ${targets.length} lots (and cascaded dependents) ==`);
  for (const t of targets) {
    console.log(`   ${t.lotCode}  [${t.category}]  ${t.titleTh}`);
  }

  const missing = BLOCKING_LOT_CODES.filter(
    (code) => !targets.some((t) => t.lotCode === code),
  );
  if (missing.length > 0) {
    console.log(`\n   (not present, skipping: ${missing.join(", ")})`);
  }

  /*
   * Dependent counts, reported rather than assumed. There is no order on these
   * lots, so their chat threads hang off bids and cascade with them — worth
   * seeing the real numbers before deleting rather than trusting the shape.
   */
  const ids = targets.map((t) => t.id);
  const [bids, images, orders, priceLogs, prices] = await Promise.all([
    prisma.bid.count({ where: { lotId: { in: ids } } }),
    prisma.lotImage.count({ where: { lotId: { in: ids } } }),
    prisma.order.count({ where: { lotId: { in: ids } } }),
    prisma.priceLog.count({ where: { lotId: { in: ids } } }),
    prisma.marketPrice.count(),
  ]);
  console.log(
    `\n   dependents: bids=${bids} lot_images=${images} orders=${orders} price_logs=${priceLogs}`,
  );
  void prices;

  // --- Delete ------------------------------------------------------------
  // deleteMany, not delete: the cascade handles dependents in the database,
  // which is both faster and impossible to get subtly wrong from the client.
  const deletedLots = await prisma.lot.deleteMany({
    where: { id: { in: ids } },
  });

  /*
   * MarketPrice has no FK to Lot, so it is not cascaded and its `category`
   * column is the very thing being narrowed. Filtered by raw SQL because the
   * generated client types `category` as the NEW enum and so cannot express
   * 'ORGANIC_GAP' as a filter value at all.
   */
  const deletedPrices = await prisma.$executeRawUnsafe(
    `delete from public.market_prices where category::text in ${REMOVED_SQL}`,
  );

  console.log(
    `\n   deleted ${deletedLots.count} lots, ${deletedPrices} market_prices rows`,
  );

  console.log("\n== after ==");
  const [lotsAfter, pricesAfter, bidsAfter, chatAfter] = await Promise.all([
    prisma.lot.count(),
    prisma.marketPrice.count(),
    prisma.bid.count(),
    prisma.chatMessage.count(),
  ]);
  console.log(
    `   lots=${lotsAfter} market_prices=${pricesAfter} bids=${bidsAfter} chat_messages=${chatAfter}`,
  );

  // --- Verify the enum can now be narrowed --------------------------------
  const blockers = await prisma.$queryRawUnsafe(
    `select count(*)::int as n from public.lots
      where category::text in ${REMOVED_SQL}`,
  );
  const priceBlockers = await prisma.$queryRawUnsafe(
    `select count(*)::int as n from public.market_prices
      where category::text in ${REMOVED_SQL}`,
  );
  console.log(
    `\n== enum blockers remaining: lots=${blockers[0].n} market_prices=${priceBlockers[0].n} ==`,
  );
  console.log(
    blockers[0].n === 0 && priceBlockers[0].n === 0
      ? "Clear. `prisma db push --accept-data-loss` can now apply the new enum."
      : "Still blocked — do not push.",
  );
}

main()
  .catch((e) => {
    console.error("FAILED:", e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
