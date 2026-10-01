/**
 * "ติดต่อทาง LINE" button for a storefront.
 *
 * Renders nothing at all when the grower has not set a LINE id, rather than a
 * disabled button: a greyed-out "contact" control reads as broken, whereas its
 * absence is honest — this farm prefers to deal through the platform's deal
 * room, where the conversation is recorded against the bid.
 *
 * A plain server component; there is no state, only an external link.
 */
export function ShopContact({
  lineId,
  shopName,
}: {
  lineId: string | null;
  shopName: string;
}) {
  if (!lineId) return null;

  // line.me's deep-link format is /ti/p/~{id} — the tilde is what makes it
  // resolve to the account rather than a search, and the id is the bare handle
  // with no domain and no leading @. The API validates that shape on write so
  // this cannot produce a dead link.
  const href = `https://line.me/ti/p/~${lineId}`;

  return (
    <a
      href={href}
      target="_blank"
      // noreferrer also covers the opener case: the LINE page should not be
      // able to navigate this tab, and it should not learn where the visit
      // came from.
      rel="noopener noreferrer"
      className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border-[1.5px] border-[#06c755] px-5 text-sm font-bold text-[#06c755] transition-colors hover:bg-[#f0fff5]"
    >
      {/* LINE's mark is a speech bubble; an inline SVG keeps it from being a
          request to an external icon host. */}
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
        <path d="M12 2C6.48 2 2 5.94 2 10.8c0 2.76 1.46 5.22 3.73 6.83-.16.6-.6 2.2-.66 2.53-.08.46.34.45.75.26.35-.16 2.4-1.5 3.32-2.07.9.22 1.85.34 2.86.34 5.52 0 10-3.94 10-8.8S17.52 2 12 2Zm5.2 10.9c-.5 0-.9-.4-.9-.9s.4-.9.9-.9.9.4.9.9-.4.9-.9.9Zm-5.2 0c-.5 0-.9-.4-.9-.9s.4-.9.9-.9.9.4.9.9-.4.9-.9.9Zm-5.1-.2c-.25 0-.45-.2-.45-.45 0-.23.2-.43.45-.43h2.2c.25 0 .45.2.45.43s-.2.45-.45.45h-2.2Zm.3-2.85c0-.25.2-.45.45-.45h4.6c.25 0 .45.2.45.45s-.2.45-.45.45h-4.6c-.25 0-.45-.2-.45-.45Z" />
      </svg>
      ติดต่อทาง LINE
      <span className="sr-only">— {shopName} (เปิดในหน้าต่างใหม่)</span>
    </a>
  );
}
