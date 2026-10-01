/**
 * Upload limits shared by the browser and the server.
 *
 * Its own module because the client needs MAX_LOT_IMAGES to stop the user
 * picking a sixth photo, and lib/storage.ts cannot be imported from a client
 * component — it reads process.env at module scope and decodes base64 with
 * Buffer, neither of which belongs in a browser bundle.
 *
 * The server re-checks every one of these; sharing the number only means the
 * UI can fail fast rather than making the user discover the limit by way of a
 * 422.
 */

/** Photos per lot. Index 0 is the cover. */
export const MAX_LOT_IMAGES = 5;

/** Longest edge, in pixels, of a client-side compressed photo. */
export const MAX_IMAGE_EDGE = 1600;

/** JPEG quality for the client-side re-encode. */
export const IMAGE_QUALITY = 0.72;

/**
 * Per-file byte ceiling after compression.
 *
 * At 0.72 quality and a 1600 px edge, a phone photo lands in the 100-250 KB
 * range; 900 KB leaves generous headroom for a noisy high-resolution original
 * without letting one photo dominate the request.
 */
export const MAX_COMPRESSED_BYTES = 900 * 1024;

/** Formats the picker accepts, mirroring ALLOWED_IMAGE_TYPES in lib/storage. */
export const ACCEPTED_IMAGE_EXTENSIONS = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];
