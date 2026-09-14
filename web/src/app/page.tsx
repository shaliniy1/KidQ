"use client";

import { useEffect, useState } from "react";
import { getHealth } from "@/services/api";
import { getCategories } from "@/services/parent-config";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Pill } from "@/components/Pill";
import { Avatar } from "@/components/Avatar";
import { MASCOT_COLORS, mascotColorForIndex } from "@/lib/mascot-colors";

export default function Home() {
  const [apiStatus, setApiStatus] = useState<"checking" | "connected" | "unreachable">(
    "checking"
  );
  const [categories, setCategories] = useState<string[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    getHealth()
      .then(() => setApiStatus("connected"))
      .catch(() => setApiStatus("unreachable"));

    getCategories()
      .then((res) => setCategories(res.categories))
      .catch(() => setCategories([]));
  }, []);

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "32px 20px", display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h1 className="kq-heading" style={{ fontSize: "var(--kq-text-hero)", color: "var(--kq-charcoal)" }}>
          KidQ
        </h1>
        <p style={{ color: "var(--kq-text-secondary)", fontSize: "var(--kq-text-caption)" }}>
          API: {apiStatus}
        </p>
      </div>

      <Card style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {MASCOT_COLORS.map((mascot, index) => (
            <Avatar key={mascot.id} color={mascotColorForIndex(index)} label={mascot.id[0].toUpperCase()} size={48} />
          ))}
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <Button variant="primary">Start using KidQ</Button>
          <Button variant="secondary">Customize</Button>
        </div>

        <div>
          <p className="kq-heading" style={{ fontSize: "var(--kq-text-interactive)", marginBottom: 8 }}>
            Categories (from backend config, not hardcoded)
          </p>
          {categories === null && <p style={{ color: "var(--kq-text-secondary)" }}>Loading…</p>}
          {categories !== null && categories.length === 0 && (
            <p style={{ color: "var(--kq-terracotta)" }}>Couldn&apos;t load categories from the API.</p>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {categories?.map((category) => (
              <Pill key={category} selected={selected === category} onClick={() => setSelected(category)}>
                {category}
              </Pill>
            ))}
          </div>
        </div>
      </Card>
    </main>
  );
}
