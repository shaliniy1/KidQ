/**
 * P2 Customize Hub — stub route so ticket 04's "Customize for {child}" action
 * has a real target. Built out for real by ticket 05
 * (.scratch/kidq-parent-experience/issues/05-customize-hub.md).
 */
export default async function HubPage(props: PageProps<"/hub/[childId]">) {
  const { childId } = await props.params;
  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <p style={{ color: "var(--kq-text-secondary)" }}>
        Customize Hub for child {childId} — routed here correctly. Built out in ticket 05.
      </p>
    </main>
  );
}
