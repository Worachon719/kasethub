/**
 * The marketplace's produce categories.
 *
 * This module is the single source of truth for the list, its order, and its
 * Thai labels. It was previously spelled out four times over — the home page
 * links, the /market facet rail, the /sell form, and the Zod enum — which meant
 * a category change had to land in all four or the filters and the form would
 * quietly disagree. Deriving the Zod enum from this list keeps them in step by
 * construction, and `satisfies` fails the build if the names ever drift from
 * the Prisma enum.
 *
 * Categories describe what the buyer receives, not how it was grown. "Organic"
 * and "GAP" are Lot.organic / Lot.gapCertified flags, not categories; broker
 * contact is a separate section at /brokers, not a category.
 */

export const CATEGORY_DEFS = [
  {
    value: "FRESH_FRUIT",
    th: "ผลไม้สด",
    en: "Fresh Fruit",
    /** Facet-rail hint and lot-card tooltip. */
    hint: "มะม่วง ทุเรียน ลำไย และผลไม้สดที่ต้องจำหน่ายเร็ว",
  },
  {
    value: "NATURAL_PRODUCT",
    th: "ผลิตภัณฑ์จากธรรมชาติ",
    en: "Natural Products",
    hint: "สมุนไพร ข้าว ถั่ว และผลิตผลจากธรรมชาติโดยไม่ผ่านการแปรรูป",
  },
  {
    value: "READY_TO_EAT",
    th: "สินค้าพร้อมทาน",
    en: "Ready to Eat",
    hint: "ผลิตภัณฑ์พร้อมบริโภคทันที ไม่ต้องผ่านการแปรรูปเพิ่ม",
  },
  {
    value: "DRIED_FOOD",
    th: "อาหารแห้ง",
    en: "Dried Food",
    hint: "ผลไม้แห้ง กล้วยแผ่นทอด อาหารแห้งเก็บได้นาน",
  },
] as const;

export type CategoryValue = (typeof CATEGORY_DEFS)[number]["value"];

/**
 * Display order matches CATEGORY_DEFS. Used wherever categories are listed:
 * the /market facet rail, the /sell picker, home page links, and lot cards.
 */
export const CATEGORIES: readonly {
  value: CategoryValue;
  th: string;
  en: string;
  hint: string;
}[] = CATEGORY_DEFS;

const BY_VALUE = new Map<string, (typeof CATEGORIES)[number]>(
  CATEGORIES.map((c) => [c.value, c]),
);

/** Thai label for a category, falling back to the raw value for unknown input. */
export function categoryLabel(value: string): string {
  return BY_VALUE.get(value)?.th ?? value;
}

/** Thai + English label, for filter controls that show both. */
export function categoryLabelBilingual(value: string): string {
  const c = BY_VALUE.get(value);
  return c ? `${c.th} / ${c.en}` : value;
}
