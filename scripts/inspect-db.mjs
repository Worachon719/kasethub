/**
 * Read-only inspection of the connected database.
 *
 * Uses $queryRawUnsafe deliberately: the generated Prisma client reflects the
 * NEW schema, and every model query against the old database fails with P2022
 * on columns that do not exist yet. Raw SQL is the one way to ask what is
 * actually there without changing anything.
 *
 * Strictly SELECTs. Run with: node --loader tsx scripts/inspect-db.mjs
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TABLES = [
  "users",
  "provinces",
  "lots",
  "lot_images",
  "bids",
  "orders",
  "chat_messages",
  "market_prices",
  "suppliers",
  "broker_watches",
  "reviews",
];

async function main() {
  const url = await prisma.$queryRawUnsafe(
    "select current_database() as db, current_user as usr, version() as ver",
  );
  console.log("== connection ==");
  console.log(url[0].db, "|", url[0].usr);
  console.log(String(url[0].ver).split(" on ")[0]);

  console.log("\n== existing tables ==");
  const tables = await prisma.$queryRawUnsafe(
    `select table_name from information_schema.tables
     where table_schema = 'public' order by table_name`,
  );
  console.log(tables.map((t) => t.table_name).join(", "));

  console.log("\n== row counts ==");
  for (const t of TABLES) {
    try {
      const rows = await prisma.$queryRawUnsafe(
        `select count(*)::int as n from public."${t}"`,
      );
      console.log(`  ${t.padEnd(16)} ${rows[0].n}`);
    } catch (e) {
      console.log(`  ${t.padEnd(16)} (does not exist)`);
    }
  }

  console.log("\n== ProduceCategory enum values in the database ==");
  const enums = await prisma.$queryRawUnsafe(
    `select e.enumlabel from pg_type t
     join pg_enum e on e.enumtypid = t.oid
     join pg_namespace n on n.oid = t.typnamespace
     where t.typname = 'ProduceCategory' and n.nspname = 'public'
     order by e.enumsortorder`,
  );
  console.log("  " + enums.map((e) => e.enumlabel).join(", "));

  console.log("\n== category values actually in use ==");
  try {
    const inUse = await prisma.$queryRawUnsafe(
      `select category, count(*)::int as n from public.lots group by category order by n desc`,
    );
    for (const r of inUse) console.log(`  ${String(r.category).padEnd(20)} ${r.n}`);
  } catch (e) {
    console.log("  (lots unreadable)");
  }

  console.log("\n== lot_code prefixes (which rows are seed-owned) ==");
  try {
    const codes = await prisma.$queryRawUnsafe(
      `select split_part(lot_code, '-', 1) as p, count(*)::int as n
       from public.lots group by 1 order by n desc limit 10`,
    );
    for (const r of codes) console.log(`  ${String(r.p).padEnd(20)} ${r.n}`);
  } catch (e) {
    console.log("  (lots unreadable)");
  }

  console.log("\n== users ==");
  try {
    const users = await prisma.$queryRawUnsafe(
      `select email, role, name_th from public.users order by created_at limit 20`,
    );
    for (const u of users)
      console.log(`  ${String(u.email).padEnd(34)} ${String(u.role).padEnd(8)} ${u.name_th ?? ""}`);
    console.log(`  (total: ${users.length})`);
  } catch (e) {
    console.log("  (users unreadable)");
  }
}

main()
  .catch((e) => {
    console.error("FAILED:", e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
