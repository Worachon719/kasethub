/**
 * Generates the produce placeholder artwork served from /public/produce.
 *
 * The seed points LotImage.url at these files so a fresh `db:seed` produces a
 * marketplace that looks like a marketplace without reaching out to an image
 * host — no external requests, no API keys, nothing to rate-limit or 404 later.
 * They are flat vector shapes on a per-category gradient, which is all a
 * placeholder has to be: recognisable at 4:3 card size, legible when the lot
 * detail page blows it up.
 *
 * Run with:  node scripts/generate-placeholders.mjs
 * Output is deterministic, so re-running produces byte-identical files and
 * never shows up as noise in a diff.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "produce",
);

const W = 1200;
const H = 900;

/** Category-wide palette. `deep` shades the motif, `wash` tints its highlight. */
const PALETTES = {
  FRESH_FRUIT: { from: "#fef3c7", to: "#fcd34d", deep: "#b45309", wash: "#fffbeb" },
  NATURAL_PRODUCT: { from: "#ecfdf5", to: "#86efac", deep: "#15803d", wash: "#f0fdf4" },
  READY_TO_EAT: { from: "#fff7ed", to: "#fdba74", deep: "#c2410c", wash: "#fffbeb" },
  DRIED_FOOD: { from: "#fdf6e3", to: "#e7c98b", deep: "#92400e", wash: "#fefce8" },
};

const CATEGORY_LABELS = {
  FRESH_FRUIT: "ผลไม้สด",
  NATURAL_PRODUCT: "ผลิตภัณฑ์จากธรรมชาติ",
  READY_TO_EAT: "สินค้าพร้อมทาน",
  DRIED_FOOD: "อาหารแห้ง",
};

/**
 * Motifs, drawn in a 0..200 local box and scaled into place.
 *
 * Deliberately schematic. The point is a recognisable silhouette at card size,
 * not botanical accuracy — anything more detailed turns to mush once the image
 * is scaled down to a 300px-wide card.
 */
const MOTIFS = {
  /** Kidney-shaped body with a stem and a leaf. */
  mango: (c) => `
    <path d="M100 55c22 0 34 14 44 30 14 22 40 42 40 74 0 42-38 71-84 71S16 201 16 159c0-24 12-38 26-52 14-14 18-30 30-40 6-5 16-12 28-12Z" fill="${c.deep}"/>
    <path d="M100 55c14 0 22 8 30 18" stroke="#166534" stroke-width="7" fill="none" stroke-linecap="round"/>
    <path d="M132 44c22-16 46-14 58 2-18 16-42 18-58-2Z" fill="#15803d"/>
    <ellipse cx="70" cy="140" rx="17" ry="27" fill="${c.wash}" opacity="0.55" transform="rotate(-22 70 140)"/>`,

  /** Cluster of berries on a woody stem. */
  longan: (c) => `
    <path d="M100 34c3 0 5 2 5 5v18" stroke="#78350f" stroke-width="8" fill="none" stroke-linecap="round"/>
    <path d="M100 52c-4 16-20 26-36 32M100 52c4 16 20 26 36 32M100 52v34" stroke="#a16207" stroke-width="6" fill="none" stroke-linecap="round"/>
    ${[
      [100, 104, 30],
      [58, 128, 27],
      [142, 128, 27],
      [100, 158, 28],
      [66, 180, 24],
      [136, 180, 24],
    ]
      .map(
        ([x, y, r]) =>
          `<circle cx="${x}" cy="${y}" r="${r}" fill="${c.deep}"/><circle cx="${x - r * 0.3}" cy="${y - r * 0.35}" r="${r * 0.28}" fill="${c.wash}" opacity="0.5"/>`,
      )
      .join("")}`,

  /** Spiky husk: overlapping triangular thorns around an ovoid body. */
  durian: (c) => `
    <path d="M100 42c46 0 74 36 74 82 0 40-32 66-74 66S26 164 26 124c0-46 28-82 74-82Z" fill="${c.deep}"/>
    ${Array.from({ length: 22 }, (_, i) => {
      const a = (i / 22) * Math.PI * 2;
      const x = 100 + Math.cos(a) * 74;
      const y = 116 + Math.sin(a) * 78;
      const deg = (a * 180) / Math.PI;
      return `<path d="M${x.toFixed(1)} ${y.toFixed(1)} l-7 -20 l14 0 Z" fill="${c.deep}" transform="rotate(${deg.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
    }).join("")}
    <path d="M100 42V22" stroke="#166534" stroke-width="9" stroke-linecap="round" fill="none"/>
    <ellipse cx="74" cy="108" rx="16" ry="24" fill="${c.wash}" opacity="0.4" transform="rotate(-20 74 108)"/>`,

  /** Round fruit with the four-lobed green calyx that makes it unmistakable. */
  mangosteen: (c) => `
    <path d="M100 66c44 0 72 32 72 74 0 38-32 62-72 62s-72-24-72-62c0-42 28-74 72-74Z" fill="${c.deep}"/>
    <path d="M100 34c10 14 24 20 40 16-6 16-20 24-40 24s-34-8-40-24c16 4 30-2 40-16Z" fill="#15803d"/>
    <ellipse cx="72" cy="130" rx="15" ry="22" fill="${c.wash}" opacity="0.5" transform="rotate(-22 72 130)"/>
    <ellipse cx="128" cy="140" rx="10" ry="16" fill="${c.wash}" opacity="0.35" transform="rotate(20 128 140)"/>`,

  /** Stacked ridged chips. */
  bananaChip: (c) => `
    ${[0, 1, 2, 3, 4]
      .map((i) => {
        const y = 52 + i * 36;
        const squeeze = 1 - Math.abs(i - 2) * 0.09;
        const w = 128 * squeeze;
        return `<g transform="translate(0 ${y})">
          <path d="M${100 - w} 18 q${w * 0.5} -22 ${w * 2} 0 q-${w * 0.5} 22 -${w * 2} 0Z" fill="${c.deep}"/>
          <path d="M${100 - w * 0.6} 12 q${w * 0.6} -12 ${w * 1.2} 0" stroke="${c.wash}" stroke-width="4" fill="none" opacity="0.5"/>
        </g>`;
      })
      .join("")}`,

  /** Flat chewy strips. */
  driedSlice: (c) => `
    ${[
      [100, 60, -12],
      [72, 104, 8],
      [128, 108, -6],
      [100, 150, 14],
      [86, 196, -10],
    ]
      .map(
        ([x, y, rot]) =>
          `<g transform="rotate(${rot} ${x} ${y})">
            <path d="M${x - 46} ${y} q46 -16 92 0 q-46 16 -92 0Z" fill="${c.deep}"/>
            <path d="M${x - 30} ${y - 2} q30 -8 60 0" stroke="${c.wash}" stroke-width="4" fill="none" opacity="0.45"/>
          </g>`,
      )
      .join("")}`,

  /** Leafy sprig. */
  herbs: (c) => `
    <path d="M100 208V70" stroke="#15803d" stroke-width="9" stroke-linecap="round" fill="none"/>
    ${[92, 122, 152, 182]
      .map((y, i) => {
        const dir = i % 2 === 0 ? -1 : 1;
        return `<path d="M100 ${y} q${dir * 46} -6 ${dir * 62} -22 q-${dir * 16} 30 -${dir * 62} 22Z" fill="${c.deep}"/>`;
      })
      .join("")}
    <path d="M100 70c0-22 10-38 26-46-4 22-12 36-26 46Z" fill="${c.deep}"/>`,

  /** Crosshatched ovoid. */
  pineapple: (c) => `
    <path d="M100 66c40 0 62 32 62 76 0 40-26 66-62 66s-62-26-62-66c0-44 22-76 62-76Z" fill="${c.deep}"/>
    ${[0, 1, 2, 3, 4, 5]
      .map((i) => {
        const y = 88 + i * 20;
        return `<path d="M42 ${y} q58 ${i % 2 ? 14 : -14} 116 0" stroke="${c.wash}" stroke-width="4" fill="none" opacity="0.4"/>`;
      })
      .join("")}
    ${[-30, -12, 6, 24]
      .map(
        (x) =>
          `<path d="M${100 + x} 66 L${100 + x * 0.5} 24" stroke="#15803d" stroke-width="8" stroke-linecap="round" fill="none"/>`,
      )
      .join("")}`,

  /** Small round fruit with a blossom end. */
  longanSingle: (c) => `
    <circle cx="100" cy="128" r="66" fill="${c.deep}"/>
    <path d="M100 62v-22" stroke="#78350f" stroke-width="8" stroke-linecap="round"/>
    <ellipse cx="74" cy="106" rx="17" ry="25" fill="${c.wash}" opacity="0.5" transform="rotate(-24 74 106)"/>
    <path d="M78 168q22 12 44 0" stroke="${c.wash}" stroke-width="5" fill="none" opacity="0.35"/>`,

  /** Assorted plated items — the "ready to eat" bucket. */
  readyTray: (c) => `
    <ellipse cx="100" cy="130" rx="84" ry="60" fill="${c.deep}"/>
    <ellipse cx="100" cy="122" rx="72" ry="48" fill="${c.wash}" opacity="0.5"/>
    ${[
      [70, 112, 20],
      [112, 106, 16],
      [94, 140, 22],
      [128, 140, 14],
    ]
      .map(
        ([x, y, r]) =>
          `<circle cx="${x}" cy="${y}" r="${r}" fill="${c.deep}"/><circle cx="${x - r * 0.3}" cy="${y - r * 0.3}" r="${r * 0.3}" fill="${c.wash}" opacity="0.55"/>`,
      )
      .join("")}`,
};

/**
 * fileSlug -> { category, motif, label }
 *
 * `label` is the Thai text drawn on the artwork itself. Variety-specific files
 * override the category label so a card shows "มะม่วงน้ำดอกไม้" rather than the
 * generic "ผลไม้สด".
 */
const ASSETS = {
  "fresh-fruit": { category: "FRESH_FRUIT", motif: "mango" },
  "fresh-fruit-longan": {
    category: "FRESH_FRUIT",
    motif: "longan",
    label: "ลำไย",
  },
  "fresh-fruit-durian": { category: "FRESH_FRUIT", motif: "durian", label: "ทุเรียน" },
  "fresh-fruit-mangosteen": {
    category: "FRESH_FRUIT",
    motif: "mangosteen",
    label: "มังคะ",
  },
  "fresh-fruit-pineapple": {
    category: "FRESH_FRUIT",
    motif: "pineapple",
    label: "สับปะรด",
  },
  "natural-product": { category: "NATURAL_PRODUCT", motif: "herbs" },
  "natural-product-herbs": {
    category: "NATURAL_PRODUCT",
    motif: "herbs",
    label: "สมุนไพรสด",
  },
  "ready-to-eat": { category: "READY_TO_EAT", motif: "readyTray" },
  "ready-to-eat-mango": {
    category: "READY_TO_EAT",
    motif: "longanSingle",
    label: "มะม่วงน้ำปลาหวาน",
  },
  "ready-to-eat-durian": {
    category: "READY_TO_EAT",
    motif: "durian",
    label: "ทุเรียนทอด",
  },
  "dried-food": { category: "DRIED_FOOD", motif: "bananaChip" },
  "dried-food-banana-chip": {
    category: "DRIED_FOOD",
    motif: "bananaChip",
    label: "กล้วยแผ่นทอด",
  },
  "dried-food-dried-mango": {
    category: "DRIED_FOOD",
    motif: "driedSlice",
    label: "มะม่วงแห้ง",
  },
  "dried-food-longan": {
    category: "DRIED_FOOD",
    motif: "longanSingle",
    label: "ลำไยแห้ง",
  },
};

/** Escape the few characters that would break out of an XML text node. */
function esc(s) {
  return s.replace(/[&<>"]/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

function buildSvg({ category, motif, label }) {
  const c = PALETTES[category];
  const text = label ?? CATEGORY_LABELS[category];
  // Motif occupies a 200-unit box; scale and centre it in the 1200x900 frame.
  const scale = 2.05;
  const offsetX = (W - 200 * scale) / 2;
  const offsetY = (H - 220 * scale) / 2 - 40;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(text)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${c.from}"/>
      <stop offset="100%" stop-color="${c.to}"/>
    </linearGradient>
    <radialGradient id="vignette" cx="0.5" cy="0.42" r="0.72">
      <stop offset="60%" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.07"/>
    </radialGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <g transform="translate(${offsetX.toFixed(1)} ${offsetY.toFixed(1)}) scale(${scale})">
    ${MOTIFS[motif](c)}
  </g>
  <rect width="${W}" height="${H}" fill="url(#vignette)"/>

  <text x="${W / 2}" y="${H - 74}" text-anchor="middle"
        font-family="'Noto Sans Thai','Leelawadee UI',Tahoma,'Apple SD Gothic Neo',sans-serif"
        font-size="58" font-weight="700" fill="${c.deep}">${esc(text)}</text>
  <text x="${W / 2}" y="${H - 32}" text-anchor="middle"
        font-family="'Noto Sans Thai','Leelawadee UI',Tahoma,sans-serif"
        font-size="26" font-weight="600" fill="${c.deep}" opacity="0.62">KasetHub</text>
</svg>
`;
}

await mkdir(OUT_DIR, { recursive: true });
let written = 0;
for (const [slug, spec] of Object.entries(ASSETS)) {
  await writeFile(join(OUT_DIR, `${slug}.svg`), buildSvg(spec), "utf8");
  written += 1;
}
console.log(`Wrote ${written} placeholder SVGs to ${OUT_DIR}`);
