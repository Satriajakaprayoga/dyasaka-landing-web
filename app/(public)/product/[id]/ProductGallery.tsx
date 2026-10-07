"use client";

import Image from "next/image";
import { useCallback, useRef, useState } from "react";
import { BalloonIcon } from "@/components/BalloonIcon";
import Lightbox from "./Lightbox";

type GalleryImage = { id: string; image_url: string };

/**
 * Product photo slider: a scroll-snap track (native swipe on touch)
 * with arrow buttons, a synced thumbnail strip, a photo counter, and
 * keyboard support. Controls are hidden when there is only one photo.
 * The first photo renders eagerly (priority, LCP); the rest lazy-load.
 */
export default function ProductGallery({
  name,
  images,
}: {
  name: string;
  images: GalleryImage[];
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const tapStart = useRef<{ x: number; y: number; t: number } | null>(null);
  const [active, setActive] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const total = images.length;

  // Open the lightbox on a tap. Pointer-based (not onClick) because click
  // events are unreliable on scroll-snap containers — browsers suppress
  // them after snap adjustments, especially on touch.
  const handleTrackPointerDown = useCallback((e: React.PointerEvent) => {
    tapStart.current = { x: e.clientX, y: e.clientY, t: Date.now() };
  }, []);

  const handleTrackPointerUp = useCallback((e: React.PointerEvent) => {
    const start = tapStart.current;
    tapStart.current = null;
    if (!start) return;
    const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y);
    if (moved < 8 && Date.now() - start.t < 400) setLightboxOpen(true);
  }, []);

  // Keep the slider in sync when photos are navigated inside the lightbox.
  const handleLightboxNavigate = useCallback((index: number) => {
    setActive(index);
    const track = trackRef.current;
    if (track) track.scrollTo({ left: index * track.clientWidth, behavior: "auto" });
  }, []);

  const scrollTo = useCallback(
    (index: number) => {
      const track = trackRef.current;
      if (!track) return;
      const clamped = Math.max(0, Math.min(total - 1, index));
      track.scrollTo({ left: clamped * track.clientWidth, behavior: "smooth" });
      setActive(clamped);
    },
    [total]
  );

  // Sync the active index while the user swipes/scrolls the track.
  const handleScroll = useCallback(() => {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    const index = Math.round(track.scrollLeft / track.clientWidth);
    setActive(Math.max(0, Math.min(total - 1, index)));
  }, [total]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (lightboxOpen) return; // the lightbox handles keys while open
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        scrollTo(active - 1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        scrollTo(active + 1);
      }
    },
    [active, lightboxOpen, scrollTo]
  );

  if (total === 0) {
    return (
      <div className="flex aspect-square flex-col items-center justify-center gap-3 rounded-2xl border border-gray-100 bg-pink-50 text-pink-300">
        <BalloonIcon className="h-14 w-14" />
        <span className="text-sm">Belum ada foto</span>
      </div>
    );
  }

  const multiple = total > 1;

  return (
    <div>
      <div
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="region"
        aria-roledescription="carousel"
        aria-label={`Foto ${name}`}
        className="relative aspect-square overflow-hidden rounded-2xl border border-gray-100 bg-pink-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-500"
      >
        <div
          ref={trackRef}
          onScroll={handleScroll}
          onPointerDown={handleTrackPointerDown}
          onPointerUp={handleTrackPointerUp}
          onPointerCancel={() => {
            tapStart.current = null;
          }}
          className="flex h-full w-full cursor-zoom-in snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {images.map((img, i) => (
            <div
              key={img.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`Foto ${i + 1} dari ${total}`}
              className="relative h-full w-full shrink-0 snap-center"
            >
              <Image
                src={img.image_url}
                alt={`Foto ${i + 1} — ${name}`}
                fill
                priority={i === 0}
                sizes="(max-width: 1024px) 100vw, 50vw"
                draggable={false}
                className="object-cover"
              />
            </div>
          ))}
        </div>

        {multiple && (
          <>
            <button
              type="button"
              aria-label="Foto sebelumnya"
              onClick={() => scrollTo(active - 1)}
              disabled={active === 0}
              className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-gray-700 shadow-md backdrop-blur transition hover:bg-white active:scale-95 disabled:pointer-events-none disabled:opacity-0"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
            <button
              type="button"
              aria-label="Foto berikutnya"
              onClick={() => scrollTo(active + 1)}
              disabled={active === total - 1}
              className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-gray-700 shadow-md backdrop-blur transition hover:bg-white active:scale-95 disabled:pointer-events-none disabled:opacity-0"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>

            <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-black/50 px-2.5 py-1 text-xs font-medium text-white">
              {active + 1} / {total}
            </span>
          </>
        )}

        <button
          type="button"
          aria-label="Lihat foto layar penuh"
          title="Lihat foto layar penuh"
          onClick={() => setLightboxOpen(true)}
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-gray-700 shadow-md backdrop-blur transition hover:bg-white active:scale-95"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d="M15 3h6v6" />
            <path d="M9 21H3v-6" />
            <path d="M21 3l-7 7" />
            <path d="M3 21l7-7" />
          </svg>
        </button>
      </div>

      {lightboxOpen && (
        <Lightbox
          name={name}
          images={images}
          index={active}
          onClose={() => setLightboxOpen(false)}
          onNavigate={handleLightboxNavigate}
        />
      )}

      {multiple && (
        <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-6">
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              aria-label={`Lihat foto ${i + 1}`}
              aria-current={i === active}
              onClick={() => scrollTo(i)}
              className={`relative aspect-square overflow-hidden rounded-xl border-2 transition ${
                i === active
                  ? "border-pink-600 opacity-100"
                  : "border-transparent opacity-60 hover:opacity-100"
              }`}
            >
              <Image src={img.image_url} alt="" fill sizes="120px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
