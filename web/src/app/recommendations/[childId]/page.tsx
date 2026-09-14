/**
 * P5 Recommendation Screen — stub route so ticket 04's "Browse and pick
 * myself" action has a real target. Built out for real by ticket 08
 * (.scratch/kidq-parent-experience/issues/08-recommendation-shelf.md).
 */
export default async function RecommendationsPage(props: PageProps<"/recommendations/[childId]">) {
  const { childId } = await props.params;
  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <p style={{ color: "var(--kq-text-secondary)" }}>
        Recommendations for child {childId} — routed here correctly. Built out in ticket 08.
      </p>
    </main>
  );
}
