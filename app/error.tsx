"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas px-4 text-center">
      <h1 className="text-2xl font-bold text-ink">
        เกิดข้อผิดพลาดบางอย่าง
      </h1>
      <p className="max-w-md text-sm text-ink-secondary">
        {error.message || "An unexpected error occurred."}
      </p>
      {error.digest ? (
        <p className="tabular text-xs text-ink-muted">ref: {error.digest}</p>
      ) : null}
      <button
        onClick={reset}
        className="mt-2 inline-flex h-11 items-center rounded-lg bg-emerald px-5 text-sm font-semibold text-white hover:bg-emerald-dark"
      >
        ลองใหม่ / Try again
      </button>
    </main>
  );
}
