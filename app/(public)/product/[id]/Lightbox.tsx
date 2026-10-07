"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

type LightboxImage = { id: string; image_url: string };

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
const SWIPE_THRESHOLD = 60;
const TAP_TIMEOUT = 300;
const TAP_SLOP = 30;
const MOVE_SLOP = 8;

type GestureMode = "none" | "pan" | "swipe" | "pinch";

type Gesture = {
  mode: GestureMode;
  startX: number;
  startY: number;
  moved: boolean;
  startTime: number;
  baseOffset: { x: number; y: number };
  baseScale: number;
  baseDist: number;
  baseMid: { x: number; y: number };
};

const IDLE_GESTURE: Gesture = {
  mode: "none",
  startX: 0,
  startY: 0,
  moved: false,
  startTime: 0,
  baseOffset: { x: 0, y: 0 },
  baseScale: 1,
  baseDist: 0,
  baseMid: { x: 0, y: 0 },
};

/**
 * Fullscreen photo viewer: wheel / double-tap / pinch zoom, pan while
 * zoomed, swipe & arrows to change photos, keyboard support (←/→/+/−/0/
 * Escape), body scroll lock. Prev/next photos are preloaded off-screen.
 */
export default function Lightbox({
  name,
  images,
  index,
  onClose,
  onNavigate,
}: {
  name: string;
  images: LightboxImage[];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}) {
  const [current, setCurrent] = useState(index);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [swipeX, setSwipeX] = useState(0);
  const [gesturing, setGesturing] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  const currentRef = useRef(index);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture>({ ...IDLE_GESTURE });
  const lastTap = useRef({ t: 0, x: 0, y: 0 });
  const closingRef = useRef(false);

  const total = images.length;
  const multiple = total > 1;
  const zoomed = scale > 1.01;

  const applyZoom = useCallback((s: number, o: { x: number; y: number }) => {
    scaleRef.current = s;
    offsetRef.current = o;
    setScale(s);
    setOffset(o);
  }, []);

  const clampOffset = useCallback((o: { x: number; y: number }, s: number) => {
    const el = stageRef.current;
    if (!el) return o;
    const maxX = ((s - 1) / 2) * el.clientWidth;
    const maxY = ((s - 1) / 2) * el.clientHeight;
    return {
      x: Math.max(-maxX, Math.min(maxX, o.x)),
      y: Math.max(-maxY, Math.min(maxY, o.y)),
    };
  }, []);

  const zoomAt = useCallback(
    (px: number, py: number, factor: number) => {
      const el = stageRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = px - rect.left - rect.width / 2;
      const cy = py - rect.top - rect.height / 2;
      const s0 = scaleRef.current;
      const o0 = offsetRef.current;
      const s1 = Math.max(MIN_SCALE, Math.min(MAX_SCALE, s0 * factor));
      const ratio = s1 / s0;
      applyZoom(
        s1,
        clampOffset({ x: cx - (cx - o0.x) * ratio, y: cy - (cy - o0.y) * ratio }, s1)
      );
    },
    [applyZoom, clampOffset]
  );

  const zoomAtCenter = useCallback(
    (factor: number) => {
      const el = stageRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      zoomAt(r.left + r.width / 2, r.top + r.height / 2, factor);
    },
    [zoomAt]
  );

  const resetZoom = useCallback(() => applyZoom(1, { x: 0, y: 0 }), [applyZoom]);

  // Close via X/Escape: pop the history entry we pushed on open (the
  // popstate listener then calls onClose). Guards double-fire.
  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    const state = history.state as { __lightbox?: boolean } | null;
    if (state?.__lightbox) history.back();
    else onClose();
  }, [onClose]);

  const goTo = useCallback(
    (i: number) => {
      const c = Math.max(0, Math.min(total - 1, i));
      setSwipeX(0);
      resetZoom();
      currentRef.current = c;
      setCurrent(c);
      onNavigate(c);
    },
    [total, onNavigate, resetZoom]
  );

  const handleTap = useCallback(
    (x: number, y: number) => {
      const now = Date.now();
      const lt = lastTap.current;
      if (now - lt.t <= TAP_TIMEOUT && Math.hypot(x - lt.x, y - lt.y) <= TAP_SLOP) {
        lastTap.current = { t: 0, x: 0, y: 0 };
        if (scaleRef.current > 1.01) resetZoom();
        else zoomAt(x, y, DOUBLE_TAP_SCALE / scaleRef.current);
      } else {
        lastTap.current = { t: now, x, y };
      }
    },
    [resetZoom, zoomAt]
  );

  // Lock page scroll, move focus into the dialog, and integrate with
  // browser history so the back button closes the lightbox instead of
  // leaving the page.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    history.pushState({ __lightbox: true }, "");

    const onPopState = () => onClose();
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wheel zoom (native non-passive listener so the page can't scroll).
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.2 : 1 / 1.2);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  // Keyboard: ←/→ navigate, +/− zoom, 0 reset, Escape close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
      else if (e.key === "ArrowLeft") goTo(currentRef.current - 1);
      else if (e.key === "ArrowRight") goTo(currentRef.current + 1);
      else if (e.key === "+" || e.key === "=") zoomAtCenter(1.25);
      else if (e.key === "-") zoomAtCenter(1 / 1.25);
      else if (e.key === "0") resetZoom();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo, requestClose, resetZoom, zoomAtCenter]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const el = stageRef.current;
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setGesturing(true);

    if (pointers.current.size === 2) {
      const [p1, p2] = [...pointers.current.values()];
      gesture.current = {
        ...IDLE_GESTURE,
        mode: "pinch",
        baseScale: scaleRef.current,
        baseOffset: { ...offsetRef.current },
        baseDist: Math.hypot(p1.x - p2.x, p1.y - p2.y) || 1,
        baseMid: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 },
      };
      setSwipeX(0);
    } else if (pointers.current.size === 1) {
      gesture.current = {
        ...IDLE_GESTURE,
        mode: scaleRef.current > 1 ? "pan" : "swipe",
        startX: e.clientX,
        startY: e.clientY,
        startTime: Date.now(),
        baseOffset: { ...offsetRef.current },
        baseScale: scaleRef.current,
      };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (g.mode === "none") return;

    if (Math.hypot(e.clientX - g.startX, e.clientY - g.startY) > MOVE_SLOP) {
      g.moved = true;
    }

    if (g.mode === "pan") {
      const o = {
        x: g.baseOffset.x + (e.clientX - g.startX),
        y: g.baseOffset.y + (e.clientY - g.startY),
      };
      offsetRef.current = clampOffset(o, scaleRef.current);
      setOffset(offsetRef.current);
    } else if (g.mode === "swipe") {
      let dx = e.clientX - g.startX;
      const atStart = currentRef.current === 0;
      const atEnd = currentRef.current === total - 1;
      if ((atStart && dx > 0) || (atEnd && dx < 0)) dx /= 3; // rubber band at the edges
      setSwipeX(dx);
    } else if (g.mode === "pinch" && pointers.current.size >= 2) {
      const el = stageRef.current;
      if (!el) return;
      const [p1, p2] = [...pointers.current.values()];
      const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y) || 1;
      const rect = el.getBoundingClientRect();
      const s1 = Math.max(
        MIN_SCALE,
        Math.min(MAX_SCALE, g.baseScale * (dist / g.baseDist))
      );
      const ratio = s1 / g.baseScale;
      const bRelX = g.baseMid.x - rect.left - rect.width / 2;
      const bRelY = g.baseMid.y - rect.top - rect.height / 2;
      const mRelX = (p1.x + p2.x) / 2 - rect.left - rect.width / 2;
      const mRelY = (p1.y + p2.y) / 2 - rect.top - rect.height / 2;
      const o = {
        x: mRelX - (bRelX - g.baseOffset.x) * ratio,
        y: mRelY - (bRelY - g.baseOffset.y) * ratio,
      };
      applyZoom(s1, clampOffset(o, s1));
    }
  };

  const finishGesture = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    const g = gesture.current;

    if (g.mode === "pinch") {
      if (pointers.current.size === 1) {
        // Rebase the remaining finger into a pan gesture.
        const [p] = [...pointers.current.values()];
        gesture.current = {
          ...IDLE_GESTURE,
          mode: "pan",
          startX: p.x,
          startY: p.y,
          startTime: Date.now(),
          moved: true,
          baseOffset: { ...offsetRef.current },
          baseScale: scaleRef.current,
        };
      } else if (pointers.current.size === 0) {
        gesture.current = { ...IDLE_GESTURE };
        setGesturing(false);
        if (scaleRef.current <= MIN_SCALE + 0.01) applyZoom(MIN_SCALE, { x: 0, y: 0 });
      }
      return;
    }

    if (g.mode === "swipe") {
      const dx = e.clientX - g.startX;
      const isTap = !g.moved && Date.now() - g.startTime < 350;
      gesture.current = { ...IDLE_GESTURE };
      setGesturing(false);

      if (isTap) {
        setSwipeX(0);
        handleTap(e.clientX, e.clientY);
      } else if (dx <= -SWIPE_THRESHOLD && currentRef.current < total - 1) {
        goTo(currentRef.current + 1);
      } else if (dx >= SWIPE_THRESHOLD && currentRef.current > 0) {
        goTo(currentRef.current - 1);
      } else {
        setSwipeX(0); // spring back
      }
      return;
    }

    gesture.current = { ...IDLE_GESTURE }; // pan ended
    setGesturing(false);
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Foto ${name} — layar penuh`}
      tabIndex={-1}
      className="fixed inset-0 z-[70] flex flex-col bg-black/95 focus:outline-none"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-white">
        <span className="text-sm font-medium tabular-nums">
          {current + 1} / {total}
        </span>
        {zoomed && (
          <span className="text-xs tabular-nums text-white/60">
            {Math.round(scale * 100)}%
          </span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <IconButton
            label="Perkecil"
            onClick={() => zoomAtCenter(1 / 1.25)}
            disabled={scale <= MIN_SCALE + 0.01}
          >
            <path d="M5 12h14" />
          </IconButton>
          <IconButton
            label="Perbesar"
            onClick={() => zoomAtCenter(1.25)}
            disabled={scale >= MAX_SCALE - 0.01}
          >
            <path d="M12 5v14M5 12h14" />
          </IconButton>
          <IconButton label="Tutup" onClick={requestClose}>
            <path d="M18 6 6 18M6 6l12 12" />
          </IconButton>
        </div>
      </div>

      {/* Stage */}
      <div
        ref={stageRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishGesture}
        onPointerCancel={finishGesture}
        className={`relative flex-1 touch-none select-none overflow-hidden ${
          zoomed ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"
        }`}
      >
        <div
          className="relative h-full w-full"
          style={{
            transform: `translate(${offset.x + swipeX}px, ${offset.y}px) scale(${scale})`,
            transition: gesturing ? "none" : "transform 200ms ease-out",
          }}
        >
          {[current - 1, current, current + 1]
            .filter((i) => i >= 0 && i < total)
            .map((i) => (
              <div
                key={images[i].id}
                className={`absolute inset-0 transition-opacity duration-200 ${
                  i === current ? "opacity-100" : "pointer-events-none opacity-0"
                }`}
              >
                <Image
                  src={images[i].image_url}
                  alt={`Foto ${i + 1} — ${name}`}
                  fill
                  priority={i === current}
                  quality={90}
                  sizes="100vw"
                  draggable={false}
                  className="object-contain"
                />
              </div>
            ))}
        </div>

        {multiple && (
          <>
            <button
              type="button"
              aria-label="Foto sebelumnya"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => goTo(currentRef.current - 1)}
              disabled={current === 0}
              className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20 active:scale-95 disabled:pointer-events-none disabled:opacity-0"
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
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => goTo(currentRef.current + 1)}
              disabled={current === total - 1}
              className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20 active:scale-95 disabled:pointer-events-none disabled:opacity-0"
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
          </>
        )}
      </div>

      <p className="px-4 py-3 text-center text-xs text-white/50">
        Scroll atau klik dua kali untuk zoom &middot; Geser untuk ganti foto
      </p>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20 active:scale-95 disabled:pointer-events-none disabled:opacity-40"
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
        {children}
      </svg>
    </button>
  );
}
