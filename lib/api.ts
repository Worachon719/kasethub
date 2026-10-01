import { NextResponse } from "next/server";
import { ZodError } from "zod";

/** Standard success envelope. `init` may carry extra headers. */
export function ok<T>(data: T, init?: ResponseInit & { headers?: HeadersInit }) {
  return NextResponse.json({ data }, { status: 200, ...init });
}

/** Standard error envelope. `extra` carries field-level detail when relevant. */
export function fail(
  message: string,
  status = 400,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json({ error: { message, ...extra } }, { status });
}

/**
 * An error that already knows its HTTP status. Thrown by the auth guards in
 * lib/session so `handleRouteError` can forward the response unchanged.
 */
export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly extra?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

type PrismaKnownError = Error & { code: string };

function isPrismaKnownError(error: unknown): error is PrismaKnownError {
  return (
    error instanceof Error &&
    typeof (error as { code?: unknown }).code === "string" &&
    error.name === "PrismaClientKnownRequestError"
  );
}

/**
 * Read and parse a JSON request body.
 *
 * `request.json()` throws a bare `SyntaxError` on a malformed body, which
 * `handleRouteError` has no case for — so a truncated payload from a flaky
 * client surfaced as 500 "Internal server error" and logged a stack trace,
 * reading like a server bug rather than the bad request it is. Turning it into
 * an `HttpError` here keeps every write route answering 422 with a message the
 * client can act on, and keeps the noise out of the error log.
 *
 * A body that parses to a non-object (a bare number, `"text"`, `null`) is
 * rejected the same way, because `schema.parse` on those either throws an
 * unhelpful message or, for `null`, silently short-circuits to undefined.
 */
export async function readJson(request: Request): Promise<unknown> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new HttpError("Invalid JSON body", 422);
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError("Request body must be a JSON object", 422);
  }
  return body;
}

/** Map thrown errors to HTTP responses without leaking internals. */
export function handleRouteError(error: unknown) {
  if (error instanceof HttpError) {
    return fail(error.message, error.status, error.extra);
  }

  if (error instanceof ZodError) {
    return fail("Validation failed", 422, {
      issues: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  if (isPrismaKnownError(error)) {
    if (error.code === "P2002") return fail("Record already exists", 409);
    if (error.code === "P2025") return fail("Record not found", 404);

    // P2028 — an interactive transaction's connection was closed under it
    // (timeout, or the pooler reclaimed the connection mid-flight).
    // P2034 — rolled back for a write conflict or a deadlock.
    //
    // Both are contention between concurrent writers, not malformed requests,
    // so they answer 409 "retry" rather than 500. A 500 here reads like a code
    // bug and pushes clients into giving up instead of retrying, which is the
    // opposite of what the caller should do.
    if (error.code === "P2028" || error.code === "P2034") {
      console.error("[api] transaction contention", error.code, error.message);
      return fail("This record changed while you were editing it. Please retry.", 409);
    }
  }

  // The engine failed to reach Postgres at all — a missing DATABASE_URL or a
  // dropped pooler connection. That is the service being unavailable, not a bad
  // request, so 503 rather than a 500 that reads like a code bug.
  if (error instanceof Error && error.name === "PrismaClientInitializationError") {
    console.error("[api] database unavailable", error.message);
    return fail("Database unavailable", 503);
  }

  console.error("[api] unhandled error", error);
  return fail("Internal server error", 500);
}
