/**
 * P2 Child Profile & Preferences (mandatory screen) — stub route so
 * ticket 03's post-consent routing can target a real page. Built out for
 * real by ticket 04 (.scratch/kidq-parent-experience/issues/04-child-profile-default-confirm.md).
 */
export default function ChildProfilePage() {
  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <p style={{ color: "var(--kq-text-secondary)" }}>
        P2 Child Profile — routed here correctly. Built out in ticket 04.
      </p>
    </main>
  );
}
