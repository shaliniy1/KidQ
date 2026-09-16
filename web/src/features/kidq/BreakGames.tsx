"use client";

// Real, prototype-faithful implementations of three in-session "break"
// activities, ported from design/prototype/kidq-desktop-app.js and
// kidq-desktop-app.css (screens #screen-breathing, #screen-find and
// #screen-follow). These replace the earlier "tap 3 times" placeholders.
//
// Scope note: only find / breathe / follow live here. Tree pose, count-to-10
// and flower & candle are a separate follow-up batch on this same branch.

import { useEffect, useRef, useState, type CSSProperties } from "react";
import styles from "./KidQDesktop.module.css";
import { Shell } from "./KidQDesktop";
import breatheAnimData from "./assets/breathe-anim.json";
import { hushSpeech, speak } from "./speech";
import type { AnimationItem, AnimationSegment } from "lottie-web";

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Shared sun-face SVG (rays + face). `phase` drives which eyes/mouth show via CSS. */
function FaceSun({ className, style, animatePulse }: { className?: string; style?: CSSProperties; animatePulse?: boolean }) {
  return (
    <svg className={`${styles.bsun} ${className ?? ""}`} style={style} viewBox="0 0 60 60" aria-hidden="true">
      <g className={styles.rays}>
        <line x1="30" y1="1.5" x2="30" y2="9.5" /><line x1="50" y1="30" x2="58.5" y2="30" />
        <line x1="44" y1="16" x2="50" y2="10" /><line x1="44" y1="44" x2="50" y2="50" />
        <line x1="30" y1="50.5" x2="30" y2="58.5" /><line x1="10" y1="50" x2="16" y2="44" />
        <line x1="1.5" y1="30" x2="10" y2="30" /><line x1="10" y1="10" x2="16" y2="16" />
      </g>
      <circle cx="30" cy="30" r="16.5" fill="#FFC64D" />
      {animatePulse ? (
        <>
          <g className={styles.eyesOpen} fill="#2E2A24">
            <circle className={styles.eye} cx="24.5" cy="28" r="1.9" />
            <circle className={styles.eye} cx="35.5" cy="28" r="1.9" />
          </g>
          <g className={styles.eyesClosed} stroke="#2E2A24" strokeWidth="2" fill="none" strokeLinecap="round">
            <path d="M21.5 28.5 q3 2.6 6 0" /><path d="M32.5 28.5 q3 2.6 6 0" />
          </g>
          <path className={styles.mouthSmile} d="M24.5 34.5 Q30 39 35.5 34.5" fill="none" stroke="#2E2A24" strokeWidth="2.2" strokeLinecap="round" />
          <circle className={styles.mouthO} cx="30" cy="36" r="3" fill="none" stroke="#2E2A24" strokeWidth="2.2" />
        </>
      ) : (
        <>
          <circle className={styles.eye} cx="24.5" cy="28" r="1.9" fill="#2E2A24" />
          <circle className={styles.eye} cx="35.5" cy="28" r="1.9" fill="#2E2A24" />
          <path d="M24.5 34.5 Q30 39 35.5 34.5" fill="none" stroke="#2E2A24" strokeWidth="2.2" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

function FlowerProp() {
  return (
    <svg className={styles.prop} viewBox="0 0 86 104" aria-hidden="true">
      <path d="M43 84 L43 48" stroke="#1F7A6D" strokeWidth="3" strokeLinecap="round" fill="none" />
      <ellipse cx="52" cy="68" rx="8" ry="4.5" fill="#1F7A6D" transform="rotate(-28 52 68)" />
      <g className={styles.petalsB}>
        <ellipse cx="43" cy="24" rx="7" ry="10.5" fill="#E2705E" />
        <ellipse cx="56" cy="33" rx="7" ry="10.5" fill="#E2705E" transform="rotate(72 56 33)" />
        <ellipse cx="51" cy="49" rx="7" ry="10.5" fill="#E2705E" transform="rotate(144 51 49)" />
        <ellipse cx="35" cy="49" rx="7" ry="10.5" fill="#E2705E" transform="rotate(-144 35 49)" />
        <ellipse cx="30" cy="33" rx="7" ry="10.5" fill="#E2705E" transform="rotate(-72 30 33)" />
        <circle cx="43" cy="38" r="8" fill="#F0A72E" />
      </g>
      <ellipse cx="34" cy="93" rx="24" ry="8" fill="#FFFFFF" opacity=".9" />
      <ellipse cx="55" cy="89" rx="16" ry="7" fill="#FFFFFF" opacity=".9" />
    </svg>
  );
}

function CandleProp() {
  return (
    <svg className={styles.prop} viewBox="0 0 86 104" aria-hidden="true">
      <path className={styles.smokeB} d="M43 40 q4 -7 0 -13 q-3 -5 1 -10" stroke="#6B6459" strokeWidth="2" fill="none" strokeLinecap="round" strokeDasharray="3 4" />
      <g className={styles.flameB}>
        <ellipse cx="43" cy="40" rx="6.5" ry="10" fill="#F0A72E" />
        <ellipse cx="43" cy="43" rx="3.2" ry="5.5" fill="#FAF4E8" />
      </g>
      <line x1="43" y1="48" x2="43" y2="53" stroke="#2E2A24" strokeWidth="2" strokeLinecap="round" />
      <rect x="33" y="53" width="20" height="32" rx="5" fill="#FAF4E8" stroke="#E4D6B8" strokeWidth="2" />
      <ellipse cx="34" cy="93" rx="24" ry="8" fill="#FFFFFF" opacity=".9" />
      <ellipse cx="55" cy="89" rx="16" ry="7" fill="#FFFFFF" opacity=".9" />
    </svg>
  );
}

/* =========================================================================
   SETTLE: breathe with the sun
   Ported from kidq-desktop-app.js lines ~700-751. Three half-breath cycles
   (in/out), each 3.2s, driven by the same timer chain that flips the visible
   phase class — so the sourced Lottie sun (when it loads) and the offline
   SVG fallback (flower/sun/candle row) can never drift apart.
   ========================================================================= */
export function BreathingBreak({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<"in" | "out" | "celebrate">("in");
  const [headline, setHeadline] = useState("Breathe in…");
  const [dotsOn, setDotsOn] = useState(0);
  const [lottieReady, setLottieReady] = useState(false);
  const lottieHostRef = useRef<HTMLDivElement>(null);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  useEffect(() => {
    let cancelled = false;
    let anim: AnimationItem | null = null;
    const reducedMotion = prefersReducedMotion();
    const timers: number[] = [];
    const later = (fn: () => void, ms: number) => {
      const id = window.setTimeout(fn, reducedMotion ? Math.min(ms, 200) : ms);
      timers.push(id);
      return id;
    };
    const BR_MID = 60;
    const BR_END = 119;
    const PHASE_MS = 3200;
    let round = 0;
    let currentPhase: "in" | "out" = "in";

    function applyLottiePhase() {
      if (!anim) return;
      if (currentPhase === "in") {
        if (!reducedMotion) anim.playSegments([[BR_MID, BR_END] as AnimationSegment], true);
        else anim.goToAndStop(BR_END, true);
      } else {
        if (!reducedMotion) anim.playSegments([[0, BR_MID] as AnimationSegment], true);
        else anim.goToAndStop(BR_MID, true);
      }
    }

    function inhale() {
      if (cancelled) return;
      currentPhase = "in";
      setPhase("in");
      setHeadline("Breathe in…");
      applyLottiePhase();
      later(exhale, PHASE_MS);
    }
    function exhale() {
      if (cancelled) return;
      currentPhase = "out";
      setPhase("out");
      setHeadline("Breathe out…");
      applyLottiePhase();
      later(() => {
        if (cancelled) return;
        round += 1;
        setDotsOn(round);
        if (round < 3) inhale();
        else celebrate();
      }, PHASE_MS);
    }
    function celebrate() {
      if (cancelled) return;
      setPhase("celebrate");
      setHeadline("You did it! ✨");
      // Only the opening line is spoken; narrating every half-breath would
      // talk over the quiet this break exists to create (source comment).
      speak("You did it!");
      anim?.goToAndStop(BR_END, true);
      later(() => onCompleteRef.current(), 1900);
    }

    import("lottie-web")
      .then(({ default: lottie }) => {
        if (cancelled || !lottieHostRef.current) return;
        anim = lottie.loadAnimation({
          container: lottieHostRef.current,
          renderer: "svg",
          loop: false,
          autoplay: false,
          animationData: breatheAnimData,
        });
        setLottieReady(true);
        applyLottiePhase();
      })
      .catch(() => {
        // Offline fallback: the SVG flower/sun/candle row stays visible and
        // fully drives itself off the same `phase` state via CSS.
      });

    later(() => speak("Three big slow breaths with the sun."), 600);
    inhale();

    return () => {
      cancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
      hushSpeech();
      anim?.destroy();
    };
  }, []);

  return (
    <Shell label="Playtime">
      <section className={styles.breatheScreen} data-phase={phase}>
        <h1 className={styles.breakHead} aria-live="polite">{headline}</h1>
        <div className={styles.breatheLottie} data-visible={lottieReady ? "true" : "false"} ref={lottieHostRef} aria-hidden="true" />
        {!lottieReady && (
          <div className={styles.breatheRow}>
            <FlowerProp />
            <div className={styles.bsunWrap}>
              <span className={styles.halo} />
              <span className={styles.ring1} />
              <FaceSun animatePulse />
            </div>
            <CandleProp />
          </div>
        )}
        <p className={styles.breakSub}>Three big slow breaths with the sun</p>
        <div className={styles.breatheDots} aria-hidden="true">
          {[0, 1, 2].map((i) => <i key={i} data-on={i < dotsOn ? "true" : "false"} />)}
        </div>
      </section>
    </Shell>
  );
}
