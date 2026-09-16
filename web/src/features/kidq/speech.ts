// Shared audio/speech helpers for KidQ's in-session "break" activities.
// Ported from design/prototype/kidq-desktop-app.js (say/sayLine/safePlay/plip).
// This is the first place web/src plays sound, so it establishes the pattern:
// plain <audio> elements plus the Web Speech API, every one of them treated
// as an enhancement — a break must still work with silence, a blocked
// autoplay, or a throwing browser.

let voicePick: SpeechSynthesisVoice | null = null;

function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices() ?? [];
  return (
    voices.find((voice) => voice.lang === "en-IN") ??
    voices.find((voice) => voice.lang?.startsWith("en")) ??
    voices[0] ??
    null
  );
}

if (typeof window !== "undefined" && window.speechSynthesis && "onvoiceschanged" in window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {
    voicePick = pickVoice();
  };
}

/** Speaks `text` with the device's own voice. A missing/blocked voice never throws. */
export function speak(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    voicePick = voicePick ?? pickVoice();
    if (voicePick) utterance.voice = voicePick;
    utterance.rate = 0.9; // unhurried, matching the app's own pace
    utterance.pitch = 1.05; // a touch warm, well short of chirpy
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
  } catch {
    // never let a missing voice break a break
  }
}

/**
 * Plays a bundled recorded line first (the same warm voice on every device,
 * including TVs whose web engines generally ship no speechSynthesis voice at
 * all); falls back to device speechSynthesis once, on any failure — a
 * missing file, blocked autoplay, or a throw.
 */
export function speakClip(clip: HTMLAudioElement | null, text: string) {
  if (!clip) {
    speak(text);
    return;
  }
  let fellBack = false;
  const fallBack = () => {
    if (!fellBack) {
      fellBack = true;
      speak(text);
    }
  };
  try {
    clip.currentTime = 0;
    clip.volume = 1;
    const played = clip.play();
    if (played && typeof played.catch === "function") played.catch(fallBack);
  } catch {
    fallBack();
  }
}

/** Stops any in-flight speech or recorded line — a line must never carry into the next screen. */
export function hushSpeech(clip?: HTMLAudioElement | null) {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    // ignore
  }
  if (clip) {
    try {
      clip.pause();
      clip.currentTime = 0;
    } catch {
      // ignore
    }
  }
}

/** Plays a celebration sound effect from the start, ignoring autoplay rejection. */
export function safePlay(el: HTMLAudioElement | null) {
  if (!el) return;
  el.currentTime = 0;
  el.volume = 1;
  el.play().catch(() => {});
}

function resolveAudioContextCtor(): typeof AudioContext | undefined {
  if (typeof window === "undefined") return undefined;
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  );
}

let plipContext: AudioContext | null = null;

/**
 * The follow-break "catch" sound: two quick soft sine notes, synthesized
 * with Web Audio — no asset to ship. An enhancement only: a missing or
 * blocked AudioContext costs nothing.
 */
export function playCatchChime() {
  try {
    const AudioContextCtor = resolveAudioContextCtor();
    if (!AudioContextCtor) return;
    plipContext = plipContext ?? new AudioContextCtor();
    if (plipContext.state === "suspended") void plipContext.resume().catch(() => {});
    const context = plipContext;
    const startedAt = context.currentTime;
    [659, 880].forEach((frequency, i) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      const noteStart = startedAt + i * 0.09;
      gain.gain.setValueAtTime(0.0001, noteStart);
      gain.gain.exponentialRampToValueAtTime(0.16, noteStart + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.24);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(noteStart);
      oscillator.stop(noteStart + 0.26);
    });
  } catch {
    // silence is fine
  }
}
