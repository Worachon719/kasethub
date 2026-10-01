/**
 * Pre-flight for the ProduceCategory enum narrowing.
 *
 * The 4-value enum required by the brief cannot be applied while rows still
 * carry removed values: Postgres refuses the USING cast, so `prisma db push`
 * fails rather than silently rewriting them. This script only COUNTS the rows
 * that would block the change, plus the dependents that a cleanup would take
 * with them, so the scope of the required deletion is known in advance.
 *
 * Strictly SELECTs. Run with: node scripts/check-enum-blockers.mjs
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * The four values the old enum had that the new one does not.
 *
 * Inlined into the SQL text rather than bound as a parameter. This is a
 * compile-time constant in this file, never user input, so there is nothing to
 * inject — and it sidesteps Prisma's inability to serialise a JS array as
 * text[] against an untyped `= any($1)`.
 */
const REMOVED_SQL = `('ORGANIC_GAP', 'PROCESSED', 'VEGETABLE', 'PROCESSING_GRADE')`;

async function main() {
  const blockers = await prisma.$queryRawUnsafe(`
    select l.lot_code                                   as lot_code,
           l.category::text                             as category,
           l.title_th                                   as title_th,
           coalesce(b.n, 0)                             as bids,
           coalesce(i.n, 0)                             as images,
           coalesce(o.n, 0)                             as orders
      from public.lots l
      left join lateral (
        select count(*)::int as n from public.bids where lot_id = l.id
      ) b on true
      left join lateral (
        select count(*)::int as n from public.lot_images where lot_id = l.id
      ) i on true
      left join lateral (
        select count(*)::int as n from public.orders where lot_id = l.id
      ) o on true
     where l.category::text in ${REMOVED_SQL}
     order by l.lot_code
  `);

  const byCategory = new Map();
  for (const b of blockers) {
    byCategory.set(b.category, (byCategory.get(b.category) ?? 0) + 1);
  }

  console.log(`Lots blocking the enum change: ${blockers.length}`);
  for (const [cat, n] of byCategory) console.log(`  ${cat.padEnd(20)} ${n}`);

  if (blockers.length === 0) {
    console.log("\nNothing blocks the enum change - push can proceed as-is.");
    return;
  }

  console.log("\nBlocking lots and the dependents a cleanup would remove:");
  console.log(
    "  " +
      "lot_code".padEnd(18) +
      "category".padEnd(18) +
      "bids images orders  title",
  );
  for (const b of blockers) {
    console.log(
      "  " +
        String(b.lot_code).padEnd(18) +
        String(b.category).padEnd(18) +
        `${b.bids}`.padEnd(5) +
        `${b.images}`.padEnd(7) +
        `${b.orders}`.padEnd(7) +
        ` ${b.title_th}`,
    );
  }

  // ChatMessage hangs off a deal room, not off a lot, so it is reached through
  // the orders of the blocking lots. It has no lot_id column.
  const [prices, chat] = await Promise.all([
    prisma.$queryRawUnsafe(
      `select count(*)::int as n from public.market_prices
        where category::text in ${REMOVED_SQL}`,
    ),
    prisma.$queryRawUnsafe(
      `select count(*)::int as n from public.chat_messages
        where order_id in (select id from public.orders
                           where lot_id in (select id from public.lots
                                             where category::text in ${REMOVED_SQL}))`,
    ),
  ]);

  console.log(
    `\nAlso blocking / affected: market_prices=${prices[0].n} chat_messages=${chat[0].n}`,
  );
  console.log(
    "\nEvery one of these is old seed data. Removing them is what lets the",
  );
  console.log(
    "4-value enum land; the rewritten seed then rebuilds the demo content.",
  );
}

main()
  .catch((e) => {
    console.error("FAILED:", e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
