import { z } from "zod";
import { CATEGORY_DEFS } from "@/lib/categories";
import { ALLOWED_IMAGE_TYPES } from "@/lib/storage";
import { MAX_LOT_IMAGES } from "@/lib/upload-limits";

/**
 * Derived from lib/categories so the API can never accept a category the UI
 * does not offer, or reject one it does. Requires zod >= 3.20 for enum-from-array.
 */
export const categorySchema = z.enum(
  CATEGORY_DEFS.map((c) => c.value) as [string, ...string[]],
) as unknown as z.ZodType<(typeof CATEGORY_DEFS)[number]["value"]>;

export const CATEGORY_VALUES = CATEGORY_DEFS.map((c) => c.value) as [
  (typeof CATEGORY_DEFS)[number]["value"],
  ...(typeof CATEGORY_DEFS)[number]["value"][],
];

/**
 * A browser-compressed `data:image/<type>;base64,<payload>` string.
 *
 * The shape is checked here as a cheap first pass; the bytes are decoded and
 * size-checked in lib/storage, which is the only place that can tell a real
 * image from a well-formed string full of nonsense.
 */
const DATA_URL_RE = /^data:(image\/(?:jpeg|png|webp|gif));base64,[A-Za-z0-9+/=\s]+$/i;

export const dataUrlSchema = z
  .string()
  .max(1_500_000, "รูปมีขนาดใหญ่เกินกำหนด")
  .regex(DATA_URL_RE, "รูปไม่ถูกต้อง กรุณาเลือกไฟล์รูปภาพอีกครั้ง");

export { ALLOWED_IMAGE_TYPES, MAX_LOT_IMAGES };

export const regionSchema = z.enum([
  "NORTH",
  "NORTHEAST",
  "CENTRAL",
  "EAST",
  "WEST",
  "SOUTH",
]);

export const lotStatusSchema = z.enum([
  "DRAFT",
  "ACTIVE",
  "RESERVED",
  "SOLD",
  "EXPIRED",
  "WITHDRAWN",
]);

/**
 * ระดับความด่วน — the facet buckets used by the surplus marketplace.
 * `critical` is under 24h, matching the design's red countdown state.
 */
export const urgencySchema = z.enum(["critical", "urgent", "moderate", "normal"]);
export type Urgency = z.infer<typeof urgencySchema>;

/** Query params for GET /api/lots */
export const lotQuerySchema = z.object({
  q: z.string().trim().min(1).max(120).optional(),
  category: categorySchema.optional(),
  province: z.string().trim().max(80).optional(),
  region: regionSchema.optional(),
  status: lotStatusSchema.default("ACTIVE"),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  minQty: z.coerce.number().int().min(0).optional(),
  surplusOnly: z
    .union([z.literal("true"), z.literal("false")])
    .transform((v) => v === "true")
    .optional(),
  organic: z
    .union([z.literal("true"), z.literal("false")])
    .transform((v) => v === "true")
    .optional(),
  urgency: urgencySchema.optional(),
  // ใกล้หมดอายุมากที่สุด | ราคาเสนอสูงสุด | ปริมาณมากสุด | คะแนนชาวสวนสูงสุด
  sort: z
    .enum(["expiring", "price_desc", "price_asc", "volume", "rating", "newest"])
    .default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(24),
});

export type LotQuery = z.infer<typeof lotQuerySchema>;

/** Body for POST /api/bids — the bidder now comes from the session. */
export const createBidSchema = z.object({
  lotId: z.string().min(10),
  pricePerKg: z.coerce.number().positive().max(1_000_000),
  quantityKg: z.coerce.number().int().positive().max(10_000_000),
  note: z.string().trim().max(500).optional(),
});

/** Body for PATCH /api/bids/:id */
export const resolveBidSchema = z.object({
  status: z.enum(["ACCEPTED", "REJECTED"]),
});

/** Body for POST /api/lots — the farmer now comes from the session. */
export const createLotSchema = z.object({
  titleTh: z.string().trim().min(2).max(160),
  titleEn: z.string().trim().min(2).max(160),
  category: categorySchema,
  grade: z.enum(["A", "B", "C", "PROCESSING"]).default("A"),
  variety: z.string().trim().max(80).optional(),
  askPricePerKg: z.coerce.number().positive().max(1_000_000),
  quantityKg: z.coerce.number().int().positive().max(10_000_000),
  minOrderKg: z.coerce.number().int().positive().max(10_000_000).default(1),
  /**
   * Required. A lot with no province cannot be routed, cannot appear in the
   * province facet, and defeats the "ships within Thailand only" promise the
   * listing makes to buyers. Optional used to mean the /sell form silently
   * posted a location-less lot that nobody could filter for.
   */
  provinceId: z.string().trim().min(1, "กรุณาเลือกจังหวัดที่ตั้งแปลงผลผลิต"),
  district: z.string().trim().max(80).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  coldChain: z.enum(["AMBIENT", "CHILLED", "FROZEN"]).default("AMBIENT"),
  organic: z.coerce.boolean().default(false),
  gapCertified: z.coerce.boolean().default(false),
  isSurplus: z.coerce.boolean().default(false),
  description: z.string().trim().max(2000).optional(),
  harvestDate: z.coerce.date().optional(),
  expiresAt: z.coerce.date().optional(),
  auctionEndsAt: z.coerce.date().optional(),
  /**
   * Up to MAX_LOT_IMAGES photos, as browser-compressed data URLs. They are
   * uploaded to storage by the route, which replaces each entry with the hosted
   * URL before the lot is written.
   *
   * Not `z.string().url()`: the browser never uploads a file directly, it
   * compresses to a `data:` URL and posts that. Validating for http(s) here
   * rejected every photo the /sell form could produce.
   */
  images: z.array(dataUrlSchema).max(MAX_LOT_IMAGES).default([]),
});

/** Body for POST /api/alerts — a broker's saved surplus watch. */
export const createWatchSchema = z.object({
  category: categorySchema,
  /** Omit or pass null for "anywhere in Thailand". */
  provinceId: z.string().trim().min(1).nullish(),
  label: z.string().trim().max(80).optional(),
  minQuantityKg: z.coerce
    .number()
    .int()
    .positive()
    .max(10_000_000)
    .nullish(),
});

/** Body for POST /api/deals/:id/messages */
export const sendMessageSchema = z
  .object({
    body: z.string().trim().max(2000).default(""),
    /** Already-hosted image, e.g. a Supabase Storage object. */
    imageUrl: z.string().url().max(600).optional(),
    /** Browser-compressed data URL; persisted by lib/storage before insert. */
    imageDataUrl: z.string().max(1_200_000).optional(),
    imageAlt: z.string().trim().max(200).optional(),
  })
  .refine((v) => v.body.length > 0 || !!v.imageUrl || !!v.imageDataUrl, {
    message: "A message needs text, an image, or both",
  });

/** Body for POST /api/deals/:id/counter-offer — renegotiated terms card */
export const counterOfferSchema = z.object({
  pricePerKg: z.coerce.number().positive().max(1_000_000),
  quantityKg: z.coerce.number().int().positive().max(10_000_000),
  body: z.string().trim().max(500).optional(),
});

/** Body for POST /api/auth/register */
export const registerSchema = z.object({
  nameTh: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s()]{8,20}$/, "Invalid phone number")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(200),
  role: z.enum(["FARMER", "BROKER", "BUYER"]),
  provinceId: z.string().optional(),
  district: z.string().trim().max(80).optional(),
  lineId: z.string().trim().max(60).optional(),
  whatsapp: z.string().trim().max(20).optional(),
  businessName: z.string().trim().max(160).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;

/** Body for PATCH /api/orders/:id */
export const updateOrderSchema = z.object({
  status: z.enum([
    "ESCROW_DEPOSITED",
    "QUALITY_INSPECTED",
    "LOADED_SHIPPED",
    "COMPLETED",
    "DISPUTED",
    "CANCELLED",
  ]),
  note: z.string().trim().max(500).optional(),
});
