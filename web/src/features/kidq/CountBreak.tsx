"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./CountBreak.module.css";

/* Count to 10 — SETTLE break, eyes closed, zero taps.
   Source of truth: design/prototype/kidq-desktop-app.js (search "#screen-count",
   "startCount", "TEN_") and kidq-desktop-app.css (search "#screen-count",
   ".kq-breakcount"). This is a from-scratch port, not a shared component —
   see that file's own comment on why it is TEN_* rather than tree's COUNT_*. */

const AUDIO_BASE = "/kid-prototype/proposal-src/";

const TEN_WORDS = ["One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"] as const;
const TEN_BIG = TEN_WORDS.map((_, i) => String(i + 1));
// Walked-through numbers trail BEHIND the current big digit — the opposite
// direction from the tree game's own countdown trail, which previews what's
// still coming (kidq-desktop-app.js:1209-1219).
const TEN_TRAIL = TEN_BIG.map((_, i) => TEN_BIG.slice(0, i).join(" · "));
const BALLOON_HUES = [styles.countBreakHueTeal, styles.countBreakHueRose, styles.countBreakHueCoral, styles.countBreakHueDusk];

// Timing mirrors the prototype's own measured clip lengths exactly
// (kidq-desktop-app.js:1222-1233) — the hold chain follows the real audio,
// not an estimate. voice-count-1..10.mp3 each measure 1.872s; intro measures
// 3.696s; voice-count-open.mp3 measures 2.280s (TEN_OPEN_MS adds a ~220ms
// buffer so it always finishes before the celebration line could collide).
const TEN_INTRO_MS = 3696;
const TEN_TICK_MS = 1872;
const TEN_OPEN_MS = 2500;
// Matches every other break's own celebration-exit hold (startChoice, 1900ms).
const CELEBRATE_EXIT_MS = 1900;

export function CountBreak({ onDone }: { onDone: () => void }) {
  const [digitIndex, setDigitIndex] = useState(0);
  const [dim, setDim] = useState(true);
  const [celebrating, setCelebrating] = useState(false);
  const [pulseKey, setPulseKey] = useState(0);

  // onDone is read from a ref inside the timer chain so the effect below
  // never has to re-run (and restart the whole count) if the parent passes
  // a fresh closure on every render. Synced in its own effect (not during
  // render) so it always reflects the latest closure without ever
  // restarting the timer chain.
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    const introClip = new Audio(`${AUDIO_BASE}voice-count-intro.mp3`);
    const openClip = new Audio(`${AUDIO_BASE}voice-count-open.mp3`);
    const doneClip = new Audio(`${AUDIO_BASE}voice-follow-done.mp3`); // shared ending clip, same as every other break
    const chimeClip = new Audio(`${AUDIO_BASE}sunset-chime.mp3`);
    const numberClips = TEN_WORDS.map((_, i) => new Audio(`${AUDIO_BASE}voice-count-${i + 1}.mp3`));

    let cancelled = false;
    const timers: number[] = [];
    let speakingClip: HTMLAudioElement | null = null;

    // Phase timing IS the activity here (a settle break has zero input to
    // pace against) — so, like the prototype's own hold(), this never clamps
    // under reduced motion. Only the decorative CSS animations do that (see
    // CountBreak.module.css's own reduced-motion query).
    const hold = (fn: () => void, ms: number) => {
      const id = window.setTimeout(() => {
        if (!cancelled) fn();
      }, ms);
      timers.push(id);
    };

    // Retires whatever line is currently playing — every tick's own line
    // hushes the previous one first, so two clips can never overlap.
    const hush = () => {
      if (speakingClip) {
        try {
          speakingClip.pause();
          speakingClip.currentTime = 0;
        } catch {
          /* a clip that never started has nothing to hush */
        }
        speakingClip = null;
      }
    };

    const sayLine = (clip: HTMLAudioElement) => {
      try {
        clip.currentTime = 0;
        speakingClip = clip;
        // Autoplay can be blocked; the break still runs on its own timer
        // either way, so a rejected play() is a silent no-op here, not a
        // fallback path (no bundled device-TTS fallback in this port).
        clip.play().catch(() => undefined);
      } catch {
        /* never let a missing clip break the break */
      }
    };

    function countTick(i: number) {
      setDigitIndex(i);
      setPulseKey((key) => key + 1);
      hush();
      sayLine(numberClips[i]);
    }

    function celebrateCount() {
      setCelebrating(true);
      hush();
      sayLine(doneClip);
      try {
        chimeClip.currentTime = 0;
        chimeClip.play().catch(() => undefined);
      } catch {
        /* ignore */
      }
      hold(() => onDoneRef.current(), CELEBRATE_EXIT_MS);
    }

    function openTenEyes() {
      setDim(false);
      hush();
      sayLine(openClip);
      hold(celebrateCount, TEN_OPEN_MS);
    }

    function runTenCount() {
      countTick(0);
      for (let i = 1; i < TEN_BIG.length; i++) hold(() => countTick(i), i * TEN_TICK_MS);
      hold(openTenEyes, TEN_BIG.length * TEN_TICK_MS);
    }

    hold(() => sayLine(introClip), 600);
    hold(runTenCount, 600 + TEN_INTRO_MS);

    return () => {
      cancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
      hush();
      [introClip, openClip, doneClip, chimeClip, ...numberClips].forEach((clip) => {
        try {
          clip.pause();
        } catch {
          /* ignore */
        }
      });
    };
  }, []);

  const hue = BALLOON_HUES[digitIndex % BALLOON_HUES.length];
  const rootClass = [styles.countBreak, dim ? styles.countBreakDim : "", celebrating ? styles.countBreakCelebrate : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={rootClass} aria-label="Count to ten break">
      <div className={styles.countBreakDuskveil} aria-hidden="true" />
      <div className={styles.countBreakCenter}>
        <h1 className={styles.countBreakHeadline} aria-live="polite">
          {celebrating ? "You did it! ✨" : "Close your eyes — count with me!"}
        </h1>
        <div className={styles.countBreakSunWrap} aria-hidden="true">
          <span className={styles.countBreakHalo} />
          <svg className={styles.countBreakSun} viewBox="0 0 60 60">
            <g className={styles.countBreakRays}>
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
            <g className={styles.countBreakEyesOpen} fill="#2E2A24">
              <circle cx="24.5" cy="28" r="1.9" />
              <circle cx="35.5" cy="28" r="1.9" />
            </g>
            <g className={styles.countBreakEyesClosed} stroke="#2E2A24" strokeWidth="2" fill="none" strokeLinecap="round">
              <path d="M21.5 28.5 q3 2.6 6 0" />
              <path d="M32.5 28.5 q3 2.6 6 0" />
            </g>
            <path d="M24.5 34.5 Q30 39 35.5 34.5" fill="none" stroke="#2E2A24" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </div>
        {!celebrating && (
          <div className={styles.countBreakCount} aria-hidden="true">
            {/* pulseKey stays 0 until the first real tick (~4.3s in, after the
                intro line) — matching the prototype, whose balloon appears
                statically at rest and only starts floating in once counting
                actually begins. */}
            <span key={pulseKey} className={`${styles.countBreakBalloon} ${pulseKey > 0 ? styles.countBreakPulse : ""} ${hue}`}>
              <span className={styles.countBreakBalloonBody} />
              <span className={styles.countBreakBalloonKnot} />
              <span className={styles.countBreakBalloonString} />
              <span className={styles.countBreakBig}>{TEN_BIG[digitIndex]}</span>
            </span>
            <span className={styles.countBreakTrail}>{TEN_TRAIL[digitIndex]}</span>
          </div>
        )}
      </div>
    </section>
  );
}
