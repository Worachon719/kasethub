import { NextRequest } from "next/server";
import { fail, handleRouteError, ok, readJson } from "@/lib/api";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registrationState } from "@/lib/registration";
import { registerSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Verification tier granted immediately after signup, by role. */
const TIER_FOR_ROLE = {
  FARMER: "BASIC",
  BROKER: "UNVERIFIED",
  BUYER: "UNVERIFIED",
} as const;

/** Message shown when signup is closed or the guest headcount is used up. */
const CLOSED_MESSAGE =
  "การสมัครบัญชีใหม่ปิดอยู่ชั่วคราว กรุณาใช้บัญชีทดลองที่หน้าเข้าสู่ระบบแทน";

/**
 * POST /api/auth/register — create an account with a chosen role.
 *
 * The role picker on /register drives `role`; ADMIN is not selectable. Nothing
 * is trusted beyond the Zod-validated body, and the session is not created
 * here — the client follows up with signIn so a single code path handles both
 * fresh and returning users.
 *
 * Signup is gated by lib/registration: a public deployment writes into one
 * shared demo database, so the account count is checked before the insert
 * rather than after, and the gate is read from the environment so a presenter
 * can close the form after a demo without a redeploy.
 */
export async function POST(request: NextRequest) {
  try {
    const gate = await registrationState();
    if (!gate.open) {
      return fail(CLOSED_MESSAGE, 403, { reason: gate.reason });
    }

    const body = registerSchema.parse(await readJson(request));

    const existing = await prisma.user.findUnique({
      where: { email: body.email },
      select: { id: true },
    });
    if (existing) {
      return fail("An account with this email already exists", 409);
    }

    if (body.phone) {
      const phoneTaken = await prisma.user.findUnique({
        where: { phone: body.phone },
        select: { id: true },
      });
      if (phoneTaken) {
        return fail("This phone number is already registered", 409);
      }
    }

    const passwordHash = await hashPassword(body.password);

    const user = await prisma.user.create({
      data: {
        email: body.email,
        phone: body.phone ?? null,
        passwordHash,
        nameTh: body.nameTh,
        lineId: body.lineId ?? null,
        whatsapp: body.whatsapp ?? null,
        role: body.role,
        verification: TIER_FOR_ROLE[body.role],
        provinceId: body.provinceId ?? null,
        district: body.district ?? null,
      },
      select: {
        id: true,
        email: true,
        nameTh: true,
        role: true,
        verification: true,
      },
    });

    // Brokers operate under a business entity; create their supplier record so
    // they appear in the /brokers directory straight away.
    if (body.role === "BROKER") {
      await prisma.supplier.create({
        data: {
          ownerId: user.id,
          nameTh: body.businessName?.trim() || body.nameTh,
          provinceId: body.provinceId ?? null,
          district: body.district ?? null,
        },
      });
    }

    return ok(user, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
