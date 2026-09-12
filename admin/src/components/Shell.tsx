"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { getAccessToken, signOut } from "@/lib/session";

const LINKS = [
  ["/", "Dashboard"],
  ["/review", "Review queue"],
  ["/content", "Content library"],
  ["/add", "Add content"],
  ["/config", "Configuration"],
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/login";
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    if (isLogin) return;
    void getAccessToken().then((token) => {
      if (token) setSignedIn(true);
      else router.replace("/login");
    });
  }, [isLogin, router]);

  if (isLogin) return <>{children}</>;
  if (!signedIn) return <main className="main muted">Loading…</main>;

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  return (
    <div className="shell">
      <nav className="nav" aria-label="Admin">
        <div className="brand">
          <span className="brand-mark">Q</span>KidQ Admin
        </div>
        {LINKS.map(([href, label]) => (
          <Link key={href} href={href} className={isActive(href) ? "active" : undefined}>
            {label}
          </Link>
        ))}
        <button
          type="button"
          className="btn small"
          style={{ marginTop: "auto" }}
          onClick={async () => {
            await signOut();
            router.replace("/login");
          }}
        >
          Sign out
        </button>
      </nav>
      <main className="main">{children}</main>
    </div>
  );
}
