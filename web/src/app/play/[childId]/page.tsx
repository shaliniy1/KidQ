import { Suspense } from "react";
import KidQDesktop from "@/features/kidq/KidQDesktop";

/** Keep the legacy child URL on the one shared KidQ playback experience. */
export default function PlayPage() {
  return <Suspense fallback={<main style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>Loading KidQ…</main>}><KidQDesktop /></Suspense>;
}
