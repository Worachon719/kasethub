import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas px-4 text-center">
      <p className="text-sm font-bold uppercase tracking-wide text-ink-muted">
        404
      </p>
      <h1 className="text-3xl font-bold text-ink">ไม่พบหน้าที่คุณค้นหา</h1>
      <p className="text-sm text-ink-secondary">
        The page you are looking for does not exist or has been moved.
      </p>
      <div className="mt-2 flex gap-3">
        <Link
          href="/"
          className="inline-flex h-11 items-center rounded-lg border-[1.5px] border-hairline bg-white px-5 text-sm font-semibold text-ink hover:bg-[#f8fafc]"
        >
          หน้าแรก
        </Link>
        <Link
          href="/market"
          className="inline-flex h-11 items-center rounded-lg bg-harvest px-5 text-sm font-semibold text-white hover:bg-[#c2410c]"
        >
          ไปที่ตลาด
        </Link>
      </div>
    </main>
  );
}
