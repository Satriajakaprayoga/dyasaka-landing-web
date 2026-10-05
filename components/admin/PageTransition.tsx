"use client";

import { usePathname } from "next/navigation";

// Remounts on every route change so the page-in animation replays,
// softening the skeleton -> content swap.
export default function PageTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="animate-page-in">
      {children}
    </div>
  );
}
