export function BalloonIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <ellipse cx="12" cy="9" rx="6" ry="7" />
      <path d="M12 16c-.6.9-.6 1.6 0 2.5" />
      <path d="M12 18.5c-1.6 1.4 1.8 1.6.4 3.5" />
    </svg>
  );
}
