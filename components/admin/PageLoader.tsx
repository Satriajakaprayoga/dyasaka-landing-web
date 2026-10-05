// Centered brand loader shown while a route renders (loading.tsx).
function BalloonLogo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#ec4899" />
      <ellipse cx="32" cy="27" rx="12" ry="14.5" fill="#ffffff" />
      <ellipse cx="27" cy="21" rx="3" ry="4" fill="#f9a8d4" />
      <path d="M32 41.5l-3.2 3.8h6.4z" fill="#ffffff" />
      <path
        d="M32 45.5c0 4.5 3.2 5.5 3.2 9.5"
        stroke="#ffffff"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function PageLoader({ label = "Memuat…" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[60vh] flex-col items-center justify-center gap-3"
    >
      <BalloonLogo className="h-16 w-16 animate-balloon-float drop-shadow-sm" />
      <div className="h-1.5 w-10 animate-pulse rounded-full bg-gray-300" />
      <p className="text-sm text-gray-400">{label}</p>
    </div>
  );
}
