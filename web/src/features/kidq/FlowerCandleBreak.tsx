"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./FlowerCandleBreak.module.css";

/* SETTLE: smell the flower, blow out the candle.
   Ported from design/prototype/kidq-desktop-app.js (#screen-flower-candle /
   startFlowerCandle) and kidq-desktop-app.css, per spec 2026-09-16
   kidq-flower-candle-break-design.md. Three rounds, zero taps - same
   no-input discipline as the other break games. Every phase is voiced
   (spec §4: "0-6 can't read"), so every phase change hushes whatever line
   was playing and starts its own. */

const VOICE_BASE = "/kid-prototype/proposal-src";

// Timings copied 1:1 from the prototype (measured with mutagen: intro
// 4.224s, smell 2.352s, blow 2.568s). FC_PHASE_MS is the shared smell/blow
// phase length - the 3500ms floor wins outright here (2568 + 300 < 3500).
const FC_INTRO_MS = 4224;
const FC_BLOW_MS = 2568;
const FC_PHASE_MS = 3500;
const ROUND_COUNT = 3;
const CELEBRATE_HOLD_MS = 1900; // matches every other break's celebration exit

type Phase = "idle" | "smell" | "blow" | "celebrate";

export default function FlowerCandleBreak({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [roundsDone, setRoundsDone] = useState(0);
  const [headline, setHeadline] = useState("Smell the flower…");

  const introClip = useRef<HTMLAudioElement | null>(null);
  const smellClip = useRef<HTMLAudioElement | null>(null);
  const blowClip = useRef<HTMLAudioElement | null>(null);
  const doneClip = useRef<HTMLAudioElement | null>(null);
  const chimeClip = useRef<HTMLAudioElement | null>(null);
  const speakingClip = useRef<HTMLAudioElement | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  // Re-entry safety (spec §6): this effect runs once when the screen mounts
  // and drives the whole round sequence off plain setTimeouts, mirroring the
  // prototype's hold()/showScreen() discipline - a fresh mount can never
  // resume mid-round because state always starts from "idle"/round 0 above.
  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const hold = (fn: () => void, ms: number) => {
      const id = setTimeout(() => {
        if (!cancelled) fn();
      }, ms);
      timers.push(id);
    };
    const hush = () => {
      const clip = speakingClip.current;
      if (clip) {
        try {
          clip.pause();
          clip.currentTime = 0;
        } catch {
          // never let a missing/blocked clip break the break
        }
        speakingClip.current = null;
      }
    };
    const sayLine = (clip: HTMLAudioElement | null) => {
      if (!clip) return;
      try {
        clip.currentTime = 0;
        speakingClip.current = clip;
        clip.play().catch(() => {});
      } catch {
        // no-op - speech is an enhancement, never a blocker
      }
    };
    const safePlay = (clip: HTMLAudioElement | null) => {
      if (!clip) return;
      try {
        clip.currentTime = 0;
        clip.play().catch(() => {});
      } catch {
        // no-op
      }
    };

    let round = 0;

    function smell() {
      setPhase("smell");
      setHeadline("Smell the flower…");
      hush(); // every phase's own line retires whatever came before
      sayLine(smellClip.current);
      hold(blow, FC_PHASE_MS);
    }

    function blow() {
      setPhase("blow");
      setHeadline("Blow out the candle!");
      hush();
      sayLine(blowClip.current);
      // Round dot fills at BLOW-PHASE END, same as the other counted breaks.
      // isFinal is captured before round increments since the final round's
      // own hold duration is derived algebraically (a real cushion past its
      // own clip), not just assumed to fit inside FC_PHASE_MS.
      const isFinal = round === ROUND_COUNT - 1;
      hold(() => {
        round += 1;
        setRoundsDone(round);
        if (isFinal) celebrate();
        else smell();
      }, isFinal ? Math.max(FC_PHASE_MS, FC_BLOW_MS + 220) : FC_PHASE_MS);
    }

    function celebrate() {
      setPhase("celebrate");
      setHeadline("You did it! ✨");
      hush(); // hush before the celebration line too, not just the phase lines
      sayLine(doneClip.current); // shared ending clip, same as follow/tree/count
      safePlay(chimeClip.current);
      hold(() => onDoneRef.current(), CELEBRATE_HOLD_MS);
    }

    setPhase("idle");
    setRoundsDone(0);
    setHeadline("Smell the flower…");
    hold(() => sayLine(introClip.current), 600);
    hold(smell, 600 + FC_INTRO_MS);

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      hush();
    };
  }, []);

  return (
    <section className={styles.flowerCandleBreak} data-phase={phase} aria-label="Flower and candle breathing break">
      <span className={styles.pill}>Playtime!</span>
      <div className={styles.centerCol}>
        <h1 className={styles.headline} aria-live="polite">{headline}</h1>
        <div className={styles.row}>
          <svg className={styles.prop} viewBox="0 0 86 104" aria-hidden="true">
            <path d="M43 84 L43 48" stroke="#1F7A6D" strokeWidth="3" strokeLinecap="round" fill="none" />
            <ellipse cx="52" cy="68" rx="8" ry="4.5" fill="#1F7A6D" transform="rotate(-28 52 68)" />
            <g className={styles.petals}>
              <ellipse cx="43" cy="24" rx="7" ry="10.5" fill="#A8506E" />
              <ellipse cx="56" cy="33" rx="7" ry="10.5" fill="#A8506E" transform="rotate(72 56 33)" />
              <ellipse cx="51" cy="49" rx="7" ry="10.5" fill="#A8506E" transform="rotate(144 51 49)" />
              <ellipse cx="35" cy="49" rx="7" ry="10.5" fill="#A8506E" transform="rotate(-144 35 49)" />
              <ellipse cx="30" cy="33" rx="7" ry="10.5" fill="#A8506E" transform="rotate(-72 30 33)" />
            </g>
            {/* Centre disc + face live OUTSIDE .petals (Opus diff review) so they stay full-scale through the bloom. */}
            <circle cx="43" cy="38" r="8" fill="#FFC64D" />
            <g className={styles.flowerFace} stroke="#2E2A24" strokeWidth="1.4" fill="none" strokeLinecap="round">
              <path d="M39.5 36.5 q1.25 1.1 2.5 0" />
              <path d="M44 36.5 q1.25 1.1 2.5 0" />
              <path d="M40 40.3 Q43 42.6 46 40.3" strokeWidth="1.5" />
            </g>
            <ellipse cx="34" cy="93" rx="24" ry="8" fill="#FFFFFF" opacity=".9" />
            <ellipse cx="55" cy="89" rx="16" ry="7" fill="#FFFFFF" opacity=".9" />
          </svg>

          <div className={styles.sunWrap}>
            <span className={styles.halo} />
            <span className={styles.ring1} />
            <svg className={styles.sun} viewBox="0 0 60 60" aria-hidden="true">
              <g className={styles.rays}>
                <line x1="30" y1="1.5" x2="30" y2="9.5" />
                <line x1="50" y1="30" x2="58.5" y2="30" />
                <line x1="44" y1="16" x2="50" y2="10" />
                <line x1="44" y1="44" x2="50" y2="50" />
                <line x1="30" y1="50.5" x2="30" y2="58.5" />
                <line x1="10" y1="50" x2="16" y2="44" />
                <line x1="1.5" y1="30" x2="10" y2="30" />
                <line x1="10" y1="10" x2="16" y2="16" />
              </g>
              <circle cx="30" cy="30" r="16.5" fill="#FFC64D" />
              <g className={styles.eyesOpen} fill="#2E2A24">
                <circle className={styles.eye} cx="24.5" cy="28" r="1.9" />
                <circle className={styles.eye} cx="35.5" cy="28" r="1.9" />
              </g>
              <g className={styles.eyesClosed} stroke="#2E2A24" strokeWidth="2" fill="none" strokeLinecap="round">
                <path d="M21.5 28.5 q3 2.6 6 0" />
                <path d="M32.5 28.5 q3 2.6 6 0" />
              </g>
              <path className={styles.mouthSmile} d="M24.5 34.5 Q30 39 35.5 34.5" fill="none" stroke="#2E2A24" strokeWidth="2.2" strokeLinecap="round" />
              <circle className={styles.mouthO} cx="30" cy="36" r="3" fill="none" stroke="#2E2A24" strokeWidth="2.2" />
            </svg>
          </div>

          <svg className={styles.prop} viewBox="0 0 86 104" aria-hidden="true">
            <path className={styles.smoke} d="M43 40 q4 -7 0 -13 q-3 -5 1 -10" stroke="#6B6459" strokeWidth="2" fill="none" strokeLinecap="round" strokeDasharray="3 4" />
            <g className={styles.flame}>
              <ellipse cx="43" cy="40" rx="6.5" ry="10" fill="#F0A72E" stroke="#9C6A18" strokeWidth="2" />
              <ellipse cx="43" cy="43" rx="3.2" ry="5.5" fill="#FAF4E8" />
            </g>
            <line x1="43" y1="48" x2="43" y2="53" stroke="#2E2A24" strokeWidth="2" strokeLinecap="round" />
            <rect x="33" y="53" width="20" height="32" rx="5" fill="#FAF4E8" stroke="#6B6459" strokeWidth="2" />
            <ellipse cx="34" cy="93" rx="24" ry="8" fill="#FFFFFF" opacity=".9" />
            <ellipse cx="55" cy="89" rx="16" ry="7" fill="#FFFFFF" opacity=".9" />
          </svg>
        </div>

        <div className={styles.dots} aria-hidden="true">
          {Array.from({ length: ROUND_COUNT }, (_, index) => (
            <i key={index} className={index < roundsDone ? styles.on : undefined} />
          ))}
        </div>
      </div>

      <audio ref={introClip} src={`${VOICE_BASE}/voice-flower-intro.mp3`} preload="auto" />
      <audio ref={smellClip} src={`${VOICE_BASE}/voice-flower-smell.mp3`} preload="auto" />
      <audio ref={blowClip} src={`${VOICE_BASE}/voice-flower-blow.mp3`} preload="auto" />
      <audio ref={doneClip} src={`${VOICE_BASE}/voice-follow-done.mp3`} preload="auto" />
      <audio ref={chimeClip} src={`${VOICE_BASE}/sunset-chime.mp3`} preload="auto" />
    </section>
  );
}
