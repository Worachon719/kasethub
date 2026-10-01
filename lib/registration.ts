import { prisma } from "@/lib/prisma";

/**
 * Signup gating for the demo deployment.
 *
 * The marketplace is a university module deployed to a public URL, which means
 * the signup form is open to the whole internet while the database is a single
 * shared demo instance. Without a gate, anyone can fill it — and a class of
 * strangers writing into the same rows the presentation reads is a worse
 * failure than a closed form: the demo shows other people's junk instead of the
 * seeded scenario.
 *
 * Two independent controls, both readable from the environment so a presenter
 * can change the outcome without a deploy:
 *
 *   REGISTRATION_OPEN=false      closes signup outright, once the demo is over
 *   MAX_REGISTERED_USERS=25      allows a headcount of guests, then closes it
 *
 * Defaults are permissive while the demo is running and the cap is a backstop
 * rather than the primary control, because the goal is that visitors can try a
 * role of their own.
 *
 * The cap is enforced by counting rows rather than by trusting a counter
 * column: `count` is one cheap indexed query, it cannot drift out of sync with
 * reality, and on a database this size the cost is irrelevant next to the
 * bcrypt hash the same request is about to pay for.
 */

/** Parsed `MAX_REGISTERED_USERS`; absent or unparseable means "no cap". */
function maxUsers(): number | null {
  const raw = process.env.MAX_REGISTERED_USERS;
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/** `REGISTRATION_OPEN` defaults to open; only an explicit falsy value closes it. */
export function registrationEnabled(): boolean {
  const raw = process.env.REGISTRATION_OPEN?.trim().toLowerCase();
  if (!raw) return true;
  return raw !== "false" && raw !== "0" && raw !== "no" && raw !== "off";
}

export type RegistrationState = {
  open: boolean;
  /** Present only when `open` is false, so the UI can explain itself. */
  reason?: "disabled" | "full";
  /** Current account count, for showing remaining headroom on the form. */
  used: number;
  limit: number | null;
  remaining: number | null;
};

/**
 * Current signup state, for both the API guard and the /register page.
 *
 * A database error resolves to "open" rather than throwing: the page should
 * still render (with a broken province dropdown, which it already tolerates)
 * when the database is unreachable, and refusing to render a form at all would
 * hide the demo accounts behind a database outage.
 */
export async function registrationState(): Promise<RegistrationState> {
  const limit = maxUsers();
  const enabled = registrationEnabled();

  const used = await prisma.user
    .count()
    .catch(() => Number.NaN);

  if (!Number.isFinite(used)) {
    return { open: enabled, used: 0, limit, remaining: null };
  }

  const remaining = limit === null ? null : Math.max(0, limit - used);
  const full = limit !== null && used >= limit;

  if (!enabled) {
    return { open: false, reason: "disabled", used, limit, remaining };
  }
  if (full) {
    return { open: false, reason: "full", used, limit, remaining };
  }
  return { open: true, used, limit, remaining };
}