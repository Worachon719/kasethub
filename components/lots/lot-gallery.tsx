"use client";

import { useState } from "react";

export type GalleryImage = { id: string; url: string; altTh: string | null };

/**
 * Lot photo gallery: the cover at 4:3 with a thumbnail strip beneath.
 *
 * A plain client component rather than a server-rendered grid because switching
 * the large image is the entire interaction, and shipping every photo as a full
 * 4:3 tile would mean the buyer downloads all five before seeing any of them.
 *
 * A no-JS fallback is deliberately absent: `useState` renders the cover on the
 * server, so the first paint already has the hero image. The strip is the only
 * thing that needs JavaScript, and it is only shown when there is more than one
 * photo to switch between.
 */
export function LotGallery({
  images,
  titleTh,
}: {
  images: GalleryImage[];
  titleTh: string;
}) {
  const [activeId, setActiveId] = useState(images[0]?.id ?? "");
  const active = images.find((i) => i.id === activeId) ?? images[0];

  if (!active) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center bg-surface-2 text-sm text-ink-muted">
        ไม่มีรูปภาพ
      </div>
    );
  }

  return (
    <div>
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={active.url}
          alt={active.altTh ?? titleTh}
          className="aspect-[4/3] w-full object-cover"
        />
        {images.length > 1 ? (
          <span className="glass absolute bottom-3 right-3 rounded-full px-2.5 py-1 text-[11px] font-semibold text-ink-secondary tabular">
            {images.indexOf(active) + 1} / {images.length}
          </span>
        ) : null}
      </div>

      {images.length > 1 ? (
        <ul className="mt-2 flex gap-2">
          {images.map((image, i) => {
            const selected = image.id === active.id;
            return (
              <li key={image.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(image.id)}
                  aria-label={`ดูรูปที่ ${i + 1}`}
                  aria-current={selected}
                  className={[
                    "block h-16 w-20 overflow-hidden rounded-lg border-2 object-cover transition-colors",
                    selected
                      ? "border-emerald"
                      : "border-transparent hover:border-hairline",
                  ].join(" ")}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.url}
                    alt={image.altTh ?? `${titleTh} รูปที่ ${i + 1}`}
                    className="h-full w-full object-cover"
                  />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
