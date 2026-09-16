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
import { hushSpeech, playCatchChime, safePlay, speak, speakClip } from "./speech";
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

/* =========================================================================
   MOVE: find three things of a colour
   Ported from kidq-desktop-app.js lines ~753-812. The only break that sends
   the child away from the screen: one honest "I found them!" tap brings
   them back. The colour rotates (not random) so consecutive breaks don't
   repeat, matching the prototype's module-level rotation counter.
   ========================================================================= */
const FIND_COLOURS = [
  { name: "red", hex: "#CC4C40" },
  { name: "blue", hex: "#217AD8" },
  { name: "green", hex: "#049640" },
] as const;

let findRotation = Math.floor(Math.random() * FIND_COLOURS.length);

export function FindColoursBreak({ onComplete }: { onComplete: () => void }) {
  const [colour] = useState(() => {
    const picked = FIND_COLOURS[findRotation % FIND_COLOURS.length];
    findRotation += 1;
    return picked;
  });
  const [celebrating, setCelebrating] = useState(false);
  const [tapped, setTapped] = useState(false);
  const chimeRef = useRef<HTMLAudioElement>(null);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  useEffect(() => {
    const reducedMotion = prefersReducedMotion();
    const id = window.setTimeout(
      () => speak(`Find 3 ${colour.name} things. Look around the room, and touch the sun when you find them.`),
      reducedMotion ? 200 : 600,
    );
    return () => {
      window.clearTimeout(id);
      hushSpeech();
    };
    // colour is fixed for the lifetime of this component (picked once above)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFound() {
    if (celebrating) return;
    setCelebrating(true);
    setTapped(true);
    window.setTimeout(() => setTapped(false), 950);
    speak("You found them!"); // kept short: the next screen arrives in 1.9s
    safePlay(chimeRef.current);
    const reducedMotion = prefersReducedMotion();
    window.setTimeout(() => onCompleteRef.current(), reducedMotion ? 200 : 1900);
  }

  return (
    <Shell label="Playtime">
      <section
        className={styles.findScreen}
        data-celebrate={celebrating ? "true" : "false"}
        style={{ "--find-colour": colour.hex } as CSSProperties}
      >
        <audio ref={chimeRef} src="/kid-prototype/proposal-src/sunset-chime.mp3" preload="auto" />
        <h1 className={styles.breakHead} aria-live="polite">
          {celebrating ? "You found them! ✨" : `Find 3 ${colour.name} things!`}
        </h1>
        <button
          type="button"
          className={styles.findSun}
          aria-label="I found them"
          disabled={celebrating}
          data-tapped={tapped ? "true" : "false"}
          onClick={handleFound}
        >
          <span className={styles.findHalo} aria-hidden="true" />
          <FaceSun style={{ transform: "none" }} />
        </button>
        <div className={styles.swatchRow} aria-hidden="true"><i /><i /><i /></div>
        <p className={styles.breakSub}>{celebrating ? "Great looking." : "Look around the room. Touch the sun when you find them."}</p>
      </section>
    </Shell>
  );
}

/* =========================================================================
   SETTLE: follow the sun with your eyes
   Ported from kidq-desktop-app.js lines ~814-1042. Real smooth-pursuit
   geometry in degrees of visual angle (clinical guidance, not decoration):
   the sun travels three legs (across / up-down / diagonal) sized from
   DEG_SUN/DEG_PER_SEC, with a near/far (phone-or-laptop vs TV) context
   switch. Kept fully imperative (direct DOM refs, not React state) for the
   animation itself, mirroring the prototype 1:1 and avoiding re-render
   timing races on the position/opacity/transition sequencing.
   ========================================================================= */
const FOLLOW_LEGS = ["across", "updown", "diagonal"] as const;
type FollowLeg = (typeof FOLLOW_LEGS)[number];
type Point = { x: number; y: number };

const DEG_SUN = 2;
const DEG_PER_SEC = 8;
const NEAR_PX_PER_DEG = 36;
const TV_ANGULAR_WIDTH = 26.8;
const MIN_PASS_MS = 1600;
const MIN_DIAGONAL_DEG = 30;
const CATCH_WAIT_MS = 4500;
const FAR_CATCH_MS = 2000;
const FADE_MS = 300;
const BEAT_MS = 400;

export function FollowSunBreak({ onComplete }: { onComplete: () => void }) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLButtonElement>(null);
  const introClipRef = useRef<HTMLAudioElement>(null);
  const doneClipRef = useRef<HTMLAudioElement>(null);
  const chimeRef = useRef<HTMLAudioElement>(null);
  const [dotsOn, setDotsOn] = useState(0);
  const [celebrate, setCelebrate] = useState(false);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  useEffect(() => {
    const field = fieldRef.current;
    const hero = heroRef.current;
    const introClip = introClipRef.current;
    const doneClip = doneClipRef.current;
    if (!field || !hero) return;

    let isCelebrating = false;
    const timers: number[] = [];
    const hold = (fn: () => void, ms: number) => {
      const id = window.setTimeout(fn, ms);
      timers.push(id);
      return id;
    };
    const clearAllTimers = () => {
      timers.forEach((id) => window.clearTimeout(id));
      timers.length = 0;
    };

    let onCatch: (() => void) | null = null;
    let catchTimer = 0;

    const farQuery = window.matchMedia("(hover: none) and (min-width: 1100px)");
    let context: "near" | "far" = farQuery.matches ? "far" : "near";
    const refreshContext = () => { context = farQuery.matches ? "far" : "near"; };

    function pxPerDeg() {
      return context === "far" ? field!.clientWidth / TV_ANGULAR_WIDTH : NEAR_PX_PER_DEG;
    }
    function applyContext() {
      const ppd = pxPerDeg();
      field!.style.setProperty("--px-per-deg", String(ppd));
      field!.style.setProperty("--ball", `${DEG_SUN * ppd}px`);
    }
    // Corner-to-corner isn't good enough for the diagonal: on a wide field its
    // angle flattens toward horizontal. Clamp so it stays at least 30 degrees.
    function diagonalLeg(maxX: number, maxY: number) {
      const dx = Math.min(maxX, maxY / Math.tan((MIN_DIAGONAL_DEG * Math.PI) / 180));
      const off = (maxX - dx) / 2;
      return { from: { x: off, y: maxY }, to: { x: off + dx, y: 0 } };
    }
    function legGeometry(dir: FollowLeg) {
      const r = field!.getBoundingClientRect();
      const d = hero!.getBoundingClientRect().width;
      const maxX = Math.max(0, r.width - d);
      const maxY = Math.max(0, r.height - d);
      const midX = maxX / 2;
      const midY = maxY / 2;
      const legs: Record<FollowLeg, { from: Point; to: Point }> = {
        across: { from: { x: 0, y: midY }, to: { x: maxX, y: midY } },
        updown: { from: { x: midX, y: 0 }, to: { x: midX, y: maxY } },
        diagonal: diagonalLeg(maxX, maxY),
      };
      const leg = legs[dir];
      const travel = Math.hypot(leg.to.x - leg.from.x, leg.to.y - leg.from.y);
      return { ...leg, travel };
    }
    // Duration derived so ANGULAR speed stays constant: a short leg takes
    // proportionally less time than a long one.
    function passMs(travel: number) {
      return Math.max(MIN_PASS_MS, (travel / (DEG_PER_SEC * pxPerDeg())) * 1000);
    }
    function placeHero(pt: Point) {
      hero!.style.translate = `${pt.x}px ${pt.y}px`;
    }
    function movePass(to: Point, ms: number) {
      hero!.style.setProperty("--sweep", `${ms}ms`);
      placeHero(to);
    }
    function pop(el: HTMLElement) {
      el.dataset.tapped = "false";
      void el.offsetWidth;
      el.dataset.tapped = "true";
      hold(() => { el.dataset.tapped = "false"; }, 950);
    }
    // A tap advances the game; where no tap comes (or can come, on a TV) the
    // sun pops on its own after a wait. Whichever fires first nulls onCatch
    // so the loser finds nothing to run.
    function land(i: number, done: () => void) {
      hero!.dataset.landed = "true";
      hero!.setAttribute("aria-disabled", "false");
      hero!.focus({ preventScroll: true });
      onCatch = () => {
        onCatch = null;
        window.clearTimeout(catchTimer);
        hero!.dataset.landed = "false";
        hero!.setAttribute("aria-disabled", "true");
        pop(hero!);
        playCatchChime();
        setDotsOn(i + 1);
        hold(done, 620); // let the pop land before the fade to the next leg
      };
      catchTimer = hold(() => { if (onCatch) onCatch(); }, context === "far" ? FAR_CATCH_MS : CATCH_WAIT_MS);
    }
    // The sun ends each leg where it began, so it must be repositioned for
    // the next one. A jump cut reads as a glitch; an untracked glide is a
    // fourth direction to chase. So: fade out, reposition while invisible,
    // fade back in, beat.
    function placeHidden(pt: Point, then: () => void) {
      hero!.dataset.gone = "true";
      hold(() => {
        hero!.dataset.jump = "true";
        placeHero(pt);
        void hero!.offsetWidth; // commit the jump before fading back in
        hero!.dataset.jump = "false";
        hero!.dataset.gone = "false";
        hold(then, FADE_MS + BEAT_MS);
      }, FADE_MS);
    }
    function runLeg(i: number, done: () => void) {
      const leg = legGeometry(FOLLOW_LEGS[i]);
      const ms = passMs(leg.travel);
      placeHidden(leg.from, () => {
        movePass(leg.to, ms);
        hold(() => {
          movePass(leg.from, ms);
          hold(() => land(i, done), ms);
        }, ms);
      });
    }
    function endFollow() {
      const r = field!.getBoundingClientRect();
      const d = hero!.getBoundingClientRect().width;
      placeHidden({ x: (r.width - d) / 2, y: (r.height - d) / 2 }, () => {
        hero!.dataset.tapped = "false";
        isCelebrating = true;
        setCelebrate(true);
        speakClip(doneClip, "You did it!");
        safePlay(chimeRef.current);
        hold(() => onCompleteRef.current(), 1900);
      });
    }
    function start() {
      applyContext();
      setDotsOn(0);
      isCelebrating = false;
      setCelebrate(false);
      hero!.dataset.gone = "false";
      hero!.dataset.tapped = "false";
      hero!.dataset.landed = "false";
      hero!.setAttribute("aria-disabled", "true");
      onCatch = null;
      hold(() => speakClip(introClip, "Follow the sun with your eyes. Catch it at the end!"), 600);
      let i = 0;
      const next = () => { i += 1; if (i < FOLLOW_LEGS.length) runLeg(i, next); else endFollow(); };
      runLeg(0, next);
    }

    const handleHeroClick = () => { if (onCatch) onCatch(); };
    hero.addEventListener("click", handleHeroClick);
    farQuery.addEventListener?.("change", refreshContext);

    // Debounced so a window drag doesn't restart the break once per resize
    // event; never restarts mid-celebration.
    let resizeTimer = 0;
    function handleResize() {
      refreshContext();
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (!isCelebrating) {
          clearAllTimers();
          start();
        }
      }, 150);
    }
    window.addEventListener("resize", handleResize);

    start();

    return () => {
      clearAllTimers();
      window.clearTimeout(resizeTimer);
      window.clearTimeout(catchTimer);
      window.removeEventListener("resize", handleResize);
      farQuery.removeEventListener?.("change", refreshContext);
      hero.removeEventListener("click", handleHeroClick);
      onCatch = null;
      hushSpeech();
      introClip?.pause();
      doneClip?.pause();
    };
  }, []);

  return (
    <Shell label="Playtime">
      <section className={styles.followScreen} data-celebrate={celebrate ? "true" : "false"}>
        <audio ref={introClipRef} src="/kid-prototype/proposal-src/voice-follow-intro.mp3" preload="auto" />
        <audio ref={doneClipRef} src="/kid-prototype/proposal-src/voice-follow-done.mp3" preload="auto" />
        <audio ref={chimeRef} src="/kid-prototype/proposal-src/sunset-chime.mp3" preload="auto" />
        <h1 className={styles.breakHead} aria-live="polite">
          {celebrate ? (
            "You did it! ✨"
          ) : (
            <>
              <span className={styles.mFull}>Follow the sun!</span>
              <span className={styles.mReduced}>Where&apos;s the sun?</span>
            </>
          )}
        </h1>
        <div className={styles.followField} ref={fieldRef}>
          <button type="button" className={styles.followHero} ref={heroRef} aria-label="Catch the sun" aria-disabled="true">
            <span className={styles.followRing} aria-hidden="true" />
            <svg className={styles.followRays} viewBox="0 0 60 60" aria-hidden="true">
              <g className={styles.rays}>
                <line x1="30" y1="1.5" x2="30" y2="9.5" /><line x1="50" y1="30" x2="58.5" y2="30" />
                <line x1="44" y1="16" x2="50" y2="10" /><line x1="44" y1="44" x2="50" y2="50" />
                <line x1="30" y1="50.5" x2="30" y2="58.5" /><line x1="10" y1="50" x2="16" y2="44" />
                <line x1="1.5" y1="30" x2="10" y2="30" /><line x1="10" y1="10" x2="16" y2="16" />
              </g>
            </svg>
            <i className={styles.followEye} /><i className={styles.followEye} />
          </button>
        </div>
        <p className={styles.breakSub} aria-live="polite">
          <span className={styles.mFull}>Keep your head still — just your eyes</span>
          <span className={styles.mReduced}>Find it each time it hops</span>
        </p>
        <div className={styles.followDots} aria-hidden="true">
          {[0, 1, 2].map((i) => <i key={i} data-on={i < dotsOn ? "true" : "false"} />)}
        </div>
      </section>
    </Shell>
  );
}
