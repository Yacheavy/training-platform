"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import type { CSSProperties, ReactNode } from "react";

function Spin() {
  const { pending } = useLinkStatus();
  return <span aria-hidden className={`spinner link-spin ${pending ? "on" : ""}`} />;
}

/** Link que muestra un indicador mientras la navegación está en curso. */
export function PendingLink({ href, children, style, className }: { href: string; children: ReactNode; style?: CSSProperties; className?: string }) {
  return (
    <Link href={href} className={`pending-link${className ? ` ${className}` : ""}`} style={style}>
      {children}
      <Spin />
    </Link>
  );
}
