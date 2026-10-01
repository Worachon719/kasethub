// Removes artefacts created by the end-to-end pass.
//
// Scope is deliberately narrow: only lots whose title starts with the E2E
// marker. The 8 pre-existing KH-* lots and every seeded row are left alone.
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

const found = await p.lot.findMany({
  where: { titleTh: { startsWith: "E2E " } },
  select: { id: true, lotCode: true, titleTh: true, images: { select: { id: true } } },
});

if (found.length === 0) {
  console.log("no E2E lots found; nothing to remove");
} else {
  for (const l of found) {
    // lot_images cascade on delete, but the count is worth stating so a silent
    // cascade failure is visible in the log rather than inferred from a total.
    console.log(`removing ${l.lotCode} "${l.titleTh}" (${l.images.length} images)`);
  }
  const res = await p.lot.deleteMany({ where: { titleTh: { startsWith: "E2E " } } });
  console.log(`deleted ${res.count} lot(s)`);
}

await p.$disconnect();
