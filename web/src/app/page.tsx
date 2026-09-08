"use client";

import { useEffect, useState } from "react";
import { getHealth } from "@/services/api";

export default function Home() {
  const [apiStatus, setApiStatus] = useState<"checking" | "connected" | "unreachable">(
    "checking"
  );

  useEffect(() => {
    getHealth()
      .then(() => setApiStatus("connected"))
      .catch(() => setApiStatus("unreachable"));
  }, []);

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        gap: "0.5rem",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ fontSize: "2.5rem" }}>KidQ</h1>
      <p style={{ color: "#666", fontSize: "0.9rem" }}>API: {apiStatus}</p>
    </main>
  );
}
