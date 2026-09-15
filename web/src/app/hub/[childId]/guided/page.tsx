"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/hooks/useSession";
import { writeHubDraftPatch, type HubDraftPatch } from "@/lib/hub-draft-bridge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Pill } from "@/components/Pill";

type EnjoysAnswer = "stories" | "active_play";
type PriorityAnswer = "calming_down" | "focus" | "energy";

// Static client-side lookup (spec Section 11 #16.2 / Table A: "no backend
// call for this screen at all") — converges on the same Hub fields voice
// input does.
function toPatch(enjoys: EnjoysAnswer, priority: PriorityAnswer): HubDraftPatch {
  const interests = enjoys === "stories" ? ["Stories"] : ["Activities"];
  const regulationGoals =
    priority === "calming_down" ? ["Calm"] : priority === "focus" ? ["Focus"] : ["Movement"];
  return { interests, contentMixMode: "choose_categories", contentMixCategories: interests, regulationGoals };
}

/** "Answer a few guided questions" — the tap-based alternative to voice (spec Section 11 #16.2). */
export default function GuidedQuestionsPage() {
  const router = useRouter();
  const status = useSession();
  const params = useParams<{ childId: string }>();
  const childId = params.childId;

  const [enjoys, setEnjoys] = useState<EnjoysAnswer | null>(null);
  const [priority, setPriority] = useState<PriorityAnswer | null>(null);

  useEffect(() => {
    if (status === "anon") router.replace("/login");
  }, [status, router]);

  function handleContinue() {
    if (!enjoys || !priority) return;
    writeHubDraftPatch(childId, toPatch(enjoys, priority));
    router.push(`/hub/${childId}`);
  }

  return (
    <main style={{ minHeight: "100vh", display: "flex", justifyContent: "center", padding: "24px" }}>
      <Card style={{ maxWidth: 440, width: "100%", display: "flex", flexDirection: "column", gap: 20, height: "fit-content" }}>
        <button
          onClick={() => router.push(`/hub/${childId}`)}
          aria-label="Back"
          style={{ alignSelf: "flex-start", background: "none", border: "none", color: "var(--kq-text-secondary)", cursor: "pointer", padding: 4 }}
        >
          ← Back
        </button>

        <h1 className="kq-heading" style={{ fontSize: "var(--kq-text-interactive)", color: "var(--kq-charcoal)" }}>
          A couple of quick questions
        </h1>

        <div>
          <p style={{ fontWeight: 700, color: "var(--kq-charcoal)", marginBottom: 8 }}>
            What does your child enjoy more — stories or active play?
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <Pill selected={enjoys === "stories"} onClick={() => setEnjoys("stories")}>Stories</Pill>
            <Pill selected={enjoys === "active_play"} onClick={() => setEnjoys("active_play")}>Active play</Pill>
          </div>
        </div>

        <div>
          <p style={{ fontWeight: 700, color: "var(--kq-charcoal)", marginBottom: 8 }}>
            What matters most right now — calming down, focus, or energy?
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <Pill selected={priority === "calming_down"} onClick={() => setPriority("calming_down")}>Calming down</Pill>
            <Pill selected={priority === "focus"} onClick={() => setPriority("focus")}>Focus</Pill>
            <Pill selected={priority === "energy"} onClick={() => setPriority("energy")}>Energy</Pill>
          </div>
        </div>

        <Button variant="primary" disabled={!enjoys || !priority} onClick={handleContinue}>
          Continue
        </Button>
      </Card>
    </main>
  );
}
