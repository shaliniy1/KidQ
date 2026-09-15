import { Suspense } from "react";
import KidQDesktop from "@/features/kidq/KidQDesktop";

export default function KidPage() {
  return <Suspense fallback={<main style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>Loading KidQ…</main>}><KidQDesktop /></Suspense>;
}
