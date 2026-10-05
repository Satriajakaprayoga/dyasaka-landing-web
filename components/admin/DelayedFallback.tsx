"use client";

import { useEffect, useState } from "react";
import PageLoader from "./PageLoader";

// Instant brand feedback (PageLoader), upgrading to `fallback` (skeleton)
// only if the route is still loading after `delay` ms.
export default function DelayedFallback({
  fallback,
  delay = 600,
}: {
  fallback: React.ReactNode;
  delay?: number;
}) {
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowFallback(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <>
      {showFallback ? (
        <div className="animate-page-in">{fallback}</div>
      ) : (
        <PageLoader />
      )}
    </>
  );
}
