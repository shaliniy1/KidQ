"use client";

/* Tree pose break — MOVE: stand like a tree with the demonstrator.
   Ported from design/prototype/kidq-desktop-app.js (search startTree,
   treeCount, treeSwitchLeg, ~lines 1049-1182) and the matching CSS
   (#screen-tree, .kq-tree*, .kq-digitballoon). No screen input at all, by
   physical design: the demonstrator's arms are overhead and she is
   balancing on one leg, so a tap mid-game would contradict the activity.
   Everything here is timed (a hold-chain of setTimeouts), never
   interaction-driven.

   The Lottie figure ("Young woman meditating in yoga tree pose" by
   Farfique/LottieFiles, recoloured to KidQ brand tokens — see
   design/prototype/kidq-tree-anim.js header comment) is bundled as a JSON
   asset (assets/tree-anim.json) rather than loaded as a global script, so
   it plays through the same npm `lottie-web` player already used for the
   count-in balloon on this screen. If the JSON asset ever fails to import,
   the break still runs — sun, trees, headline, count and voice all still
   play with no demonstrator, mirroring the prototype's own offline
   fallback (spec: "no authored human substitute"). */

import { useEffect, useRef, useState } from "react";
import lottie, { type AnimationItem } from "lottie-web";
import styles from "./TreePoseBreak.module.css";
import { Shell } from "./KidQDesktop";
import treeAnimData from "./assets/tree-anim.json";

// The visible count is driven by the SAME hold chain as the spoken count
// (see COUNT_STEP_MS below), so they cannot drift apart. COUNT_STEP_MS are
// word-start offsets (ms) measured against voice-tree-count.mp3; COUNT_MS
// is that clip's own measured length. BIG is the current number; TRAIL is
// what's still coming.
const COUNT_BIG = ["5", "4", "3", "2", "1"];
const COUNT_TRAIL = ["4 · 3 · 2 · 1", "3 · 2 · 1", "2 · 1", "1", ""];
const COUNT_STEP_MS = [0, 1758, 3327, 4827, 6244];
const COUNT_MS = 7800;
// voice-tree-switch.mp3 measures 1.872s; hold a little past that so the
// second hold's own count-clip never fires while this clip might still be
// playing.
const SWITCH_MS = 2100;
const SWITCH_FLIP_MS = 450; // "flip at the apex" of the ~900ms up/down bounce
// measured voice-tree-intro.mp3 length
const TREE_INTRO_MS = 6360;
// Break-count digit balloon hues (shared pattern, brand.md §5): cycles
// teal -> rose -> coral -> dusk, one step per digit change.
const HUE_CLASSES = [styles.hueTeal, styles.hueRose, styles.hueCoral, styles.hueDusk];

function speakFallback(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1.05;
    window.speechSynthesis.speak(utterance);
  } catch {
    // never let a missing voice break a break
  }
}

function sayLine(clip: HTMLAudioElement | null, text: string) {
  if (!clip) {
    speakFallback(text);
    return;
  }
  try {
    clip.currentTime = 0;
    clip.volume = 1;
    const played = clip.play();
    if (played && typeof played.catch === "function") played.catch(() => speakFallback(text));
  } catch {
    speakFallback(text);
  }
}

function safePlay(clip: HTMLAudioElement | null) {
  if (!clip) return;
  clip.currentTime = 0;
  clip.volume = 1;
  clip.play().catch(() => {});
}

function TreeSun() {
  return (
    <svg className={styles.bsun} viewBox="0 0 60 60" aria-hidden="true">
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
      <circle className={styles.eye} cx="24.5" cy="28" r="1.9" fill="#2E2A24" />
      <circle className={styles.eye} cx="35.5" cy="28" r="1.9" fill="#2E2A24" />
      <path d="M24.5 34.5 Q30 39 35.5 34.5" fill="none" stroke="#2E2A24" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function SideTree({ side, delay }: { side: "l" | "r"; delay: string }) {
  const className = `${styles.sideTree} ${side === "l" ? styles.sideTreeLeft : styles.sideTreeRight}`;
  return side === "l" ? (
    <svg className={className} style={{ animationDelay: delay }} aria-hidden="true" viewBox="0 0 70 130">
      <rect x="30" y="78" width="9" height="48" rx="4" fill="#6B6459" />
      <circle cx="34" cy="60" r="24" fill="#1F7A6D" />
      <circle cx="18" cy="74" r="16" fill="#1F7A6D" />
      <circle cx="50" cy="72" r="17" fill="#1F7A6D" />
    </svg>
  ) : (
    <svg className={className} style={{ animationDelay: delay }} aria-hidden="true" viewBox="0 0 70 130">
      <rect x="31" y="86" width="8" height="40" rx="4" fill="#6B6459" />
      <circle cx="35" cy="70" r="20" fill="#1F7A6D" />
      <circle cx="21" cy="82" r="13" fill="#1F7A6D" />
      <circle cx="49" cy="80" r="14" fill="#1F7A6D" />
    </svg>
  );
}

export function TreePoseBreak({ onDone }: { onDone: () => void }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const lottieMountRef = useRef<HTMLDivElement>(null);
  const balloonRef = useRef<HTMLSpanElement>(null);
  const introAudioRef = useRef<HTMLAudioElement>(null);
  const countAudioRef = useRef<HTMLAudioElement>(null);
  const switchAudioRef = useRef<HTMLAudioElement>(null);
  const doneAudioRef = useRef<HTMLAudioElement>(null);
  const chimeAudioRef = useRef<HTMLAudioElement>(null);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  const [headline, setHeadline] = useState("Stand like a tree with me!");
  const [big, setBig] = useState(COUNT_BIG[0]);
  const [trail, setTrail] = useState(COUNT_TRAIL[0]);
  const [hueIndex, setHueIndex] = useState(0);
  const [dotsOn, setDotsOn] = useState(0);
  const [celebrate, setCelebrate] = useState(false);

  // The whole break is one timed hold-chain, run once per mount — this
  // effect is the direct equivalent of the prototype's startTree().
  useEffect(() => {
    const stage = stageRef.current;
    const lottieMount = lottieMountRef.current;
    if (!stage || !lottieMount) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timers: number[] = [];
    const hold = (fn: () => void, ms: number) => {
      const id = window.setTimeout(fn, ms);
      timers.push(id);
      return id;
    };

    let anim: AnimationItem | null = null;
    try {
      anim = lottie.loadAnimation({
        container: lottieMount,
        renderer: "svg",
        loop: true,
        autoplay: false,
        animationData: treeAnimData,
      });
      if (reducedMotion) anim.goToAndStop(0, true);
      else anim.play();
    } catch {
      // Offline fallback (spec): without the sourced asset, the scene runs
      // with no demonstrator at all — sun, trees, headline, counts and
      // voice still play.
      anim = null;
    }

    function popBalloon() {
      const balloon = balloonRef.current;
      if (!balloon) return;
      balloon.classList.remove(styles.tapped);
      // reflow, so re-adding the class retriggers the animation even when
      // it was already present
      void balloon.offsetWidth;
      balloon.classList.add(styles.tapped);
    }

    function setTreeCount(i: number) {
      setBig(COUNT_BIG[i]);
      setTrail(COUNT_TRAIL[i]);
      setHueIndex(i % HUE_CLASSES.length);
      popBalloon();
    }

    function treeCount(onCountDone: () => void) {
      for (let i = 1; i < COUNT_BIG.length; i++) {
        hold(() => setTreeCount(i), COUNT_STEP_MS[i]);
      }
      hold(onCountDone, COUNT_MS);
    }

    function treeSwitchLeg() {
      sayLine(switchAudioRef.current, "Other leg!");
      if (reducedMotion) {
        // Crossfade, no bounce: fade out, flip the mirror + still frame
        // while invisible, fade back in.
        stage!.classList.add(styles.crossfade);
        hold(() => {
          lottieMount!.classList.add(styles.mirrored);
          anim?.goToAndStop(0, true);
        }, 300);
        hold(() => stage!.classList.remove(styles.crossfade), 600);
      } else {
        stage!.classList.add(styles.flipping);
        hold(() => lottieMount!.classList.add(styles.mirrored), SWITCH_FLIP_MS);
        hold(() => stage!.classList.remove(styles.flipping), 900);
      }
      hold(runHold2, SWITCH_MS);
    }

    function runHold1() {
      setTreeCount(0);
      sayLine(countAudioRef.current, "5… 4… 3… 2… 1!");
      treeCount(() => {
        setDotsOn(1);
        stage!.classList.add(styles.settle);
        treeSwitchLeg();
      });
    }

    function runHold2() {
      stage!.classList.remove(styles.settle);
      setTreeCount(0);
      sayLine(countAudioRef.current, "5… 4… 3… 2… 1!");
      treeCount(() => {
        setDotsOn(2);
        stage!.classList.add(styles.settle);
        celebrateTree();
      });
    }

    function celebrateTree() {
      setCelebrate(true);
      setHeadline("You did it! ✨");
      setBig("");
      setTrail("");
      // Reuses the follow-break's own "done" clip, same as the prototype.
      sayLine(doneAudioRef.current, "You did it!");
      safePlay(chimeAudioRef.current);
      hold(() => onDoneRef.current(), 1900);
    }

    // ---- startTree() ----
    setCelebrate(false);
    stage.classList.remove(styles.flipping, styles.crossfade, styles.settle);
    lottieMount.classList.remove(styles.mirrored);
    setDotsOn(0);
    setHeadline("Stand like a tree with me!");
    balloonRef.current?.classList.remove(styles.tapped);
    setHueIndex(0);
    setBig(COUNT_BIG[0]);
    setTrail(COUNT_TRAIL[0]);

    hold(() => sayLine(introAudioRef.current, "Stand like a tree with me! Arms up, one foot on your leg."), 600);
    hold(runHold1, 600 + TREE_INTRO_MS);

    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      anim?.destroy();
    };
  }, []);

  return (
    <Shell label="Playtime">
      <section className={`${styles.screen} ${celebrate ? styles.celebrate : ""}`} aria-label="Stand like a tree break">
        <div className={styles.sky}>
          <span className={styles.pill}>Playtime!</span>
          <SideTree side="l" delay="-1.4s" />
          <SideTree side="r" delay="-3.1s" />
          <div className={styles.centerCol}>
            <h1 className={styles.headline} aria-live="polite">
              {headline}
            </h1>
            <div className={styles.scene}>
              <div className={styles.stage} ref={stageRef}>
                <div className={styles.lottieMount} ref={lottieMountRef} aria-hidden="true" />
                <div className={styles.sunWrap} aria-hidden="true">
                  <span className={styles.halo} />
                  <TreeSun />
                </div>
              </div>
            </div>
            <div className={`${styles.breakCount} ${celebrate ? styles.hidden : ""}`} aria-hidden="true">
              <span ref={balloonRef} className={`${styles.digitBalloon} ${HUE_CLASSES[hueIndex]}`}>
                <span className={styles.balloonBody} />
                <span className={styles.balloonKnot} />
                <span className={styles.balloonString} />
                <span className={styles.breakCountBig}>{big}</span>
              </span>
              <span className={styles.breakCountTrail}>{trail}</span>
            </div>
            <div className={styles.dots} aria-hidden="true">
              <i className={dotsOn >= 1 ? styles.on : undefined} />
              <i className={dotsOn >= 2 ? styles.on : undefined} />
            </div>
          </div>
        </div>
        <audio ref={introAudioRef} src="/kid-prototype/proposal-src/voice-tree-intro.mp3" preload="auto" />
        <audio ref={countAudioRef} src="/kid-prototype/proposal-src/voice-tree-count.mp3" preload="auto" />
        <audio ref={switchAudioRef} src="/kid-prototype/proposal-src/voice-tree-switch.mp3" preload="auto" />
        <audio ref={doneAudioRef} src="/kid-prototype/proposal-src/voice-follow-done.mp3" preload="auto" />
        <audio ref={chimeAudioRef} src="/kid-prototype/proposal-src/sunset-chime.mp3" preload="auto" />
      </section>
    </Shell>
  );
}
