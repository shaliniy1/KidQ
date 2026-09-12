"use client";

// KidQ Player (docs/api/README.md "KidQ Player rules"). Children never touch YouTube's UI:
// restricted embed on youtube-nocookie.com, a click shield over the frame, a KidQ cover when
// paused or finished (hiding YouTube's suggestions), and KidQ's own controls that work with a
// mouse, touch, keyboard or TV remote (arrows, Enter, Back).
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";

export type PlayerSource =
  | { provider: "youtube"; video_id: string; embed_url?: string; params: Record<string, number> }
  | { provider: "html5"; media_url: string; mime_type: string | null }
  | { provider: "story"; page_count: number };

export interface KidQPlayerProps {
  player: PlayerSource | null;
  title: string;
  poster?: string | null;
  attribution?: { text: string | null; required: boolean | null } | null;
  /** YouTube error code (100/101/150/153 = unavailable) or 5 for an HTML5 media error. */
  onError?: (code: number) => void;
  onEnded?: () => void;
  /** Shown over the end screen instead of "Watch again" (later: the break activity). */
  endCard?: ReactNode;
  className?: string;
}

export interface KidQPlayerHandle {
  play(): void;
  pause(): void;
  seekTo(seconds: number): void;
}

/** "01:12" or "1:02:03" → seconds, for clickable AI evidence timestamps. */
export function parseTimestamp(value: string): number {
  return value.split(":").map(Number).reduce((total, part) => total * 60 + (Number.isFinite(part) ? part : 0), 0);
}

interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  mute(): void;
  unMute(): void;
  destroy(): void;
}

declare global {
  interface Window {
    YT?: { Player: new (element: HTMLElement, options: unknown) => YTPlayer; PlayerState: Record<string, number> };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youTubeApiReady: Promise<void> | null = null;
function loadYouTubeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  youTubeApiReady ??= new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    document.head.appendChild(script);
  });
  return youTubeApiReady;
}

// TV remotes: Samsung Tizen sends keyCode 10009 for Back, LG webOS sends 461.
const BACK_KEYS = new Set(["Escape", "Backspace", "BrowserBack", "GoBack"]);
const BACK_KEY_CODES = new Set([10009, 461]);

type Status = "idle" | "playing" | "paused" | "ended" | "error";

const formatTime = (seconds: number) => {
  const whole = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

export const KidQPlayer = forwardRef<KidQPlayerHandle, KidQPlayerProps>(function KidQPlayer(props, ref) {
  const { player, title, poster, attribution, endCard, className } = props;
  const mountRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const youtubeRef = useRef<YTPlayer | null>(null);
  const callbacks = useRef({ onError: props.onError, onEnded: props.onEnded });
  callbacks.current = { onError: props.onError, onEnded: props.onEnded };

  const [status, setStatus] = useState<Status>("idle");
  const [muted, setMuted] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const youtubeId = player?.provider === "youtube" ? player.video_id : null;
  const youtubeParams = player?.provider === "youtube" ? player.params : null;

  const fail = useCallback((code: number) => {
    setStatus("error");
    callbacks.current.onError?.(code);
  }, []);

  const finish = useCallback(() => {
    setStatus("ended");
    callbacks.current.onEnded?.();
  }, []);

  useEffect(() => {
    if (!youtubeId || !mountRef.current) return;
    let cancelled = false;
    const target = document.createElement("div");
    mountRef.current.replaceChildren(target);
    setStatus("idle");
    setTime(0);
    void loadYouTubeApi().then(() => {
      if (cancelled || !window.YT) return;
      const states = window.YT.PlayerState;
      youtubeRef.current = new window.YT.Player(target, {
        host: "https://www.youtube-nocookie.com",
        videoId: youtubeId,
        width: "100%",
        height: "100%",
        playerVars: { ...youtubeParams, origin: window.location.origin, enablejsapi: 1 },
        events: {
          onReady: (event: { target: YTPlayer }) => setDuration(event.target.getDuration()),
          onStateChange: (event: { data: number }) => {
            if (event.data === states.PLAYING) setStatus("playing");
            else if (event.data === states.PAUSED) setStatus("paused");
            else if (event.data === states.ENDED) finish();
          },
          onError: (event: { data: number }) => fail(event.data),
        },
      });
    });
    return () => {
      cancelled = true;
      youtubeRef.current?.destroy();
      youtubeRef.current = null;
    };
  }, [youtubeId, youtubeParams, fail, finish]);

  // The IFrame API has no time events, so poll while playing.
  useEffect(() => {
    if (status !== "playing" || !youtubeRef.current) return;
    const timer = setInterval(() => {
      const youtube = youtubeRef.current;
      if (!youtube) return;
      setTime(youtube.getCurrentTime());
      setDuration(youtube.getDuration());
    }, 500);
    return () => clearInterval(timer);
  }, [status]);

  const play = useCallback(() => {
    if (youtubeRef.current) youtubeRef.current.playVideo();
    else void videoRef.current?.play();
  }, []);
  const pause = useCallback(() => {
    if (youtubeRef.current) youtubeRef.current.pauseVideo();
    else videoRef.current?.pause();
  }, []);
  const seekTo = useCallback((seconds: number) => {
    if (youtubeRef.current) youtubeRef.current.seekTo(seconds, true);
    else if (videoRef.current) videoRef.current.currentTime = seconds;
    setTime(seconds);
  }, []);
  useImperativeHandle(ref, () => ({ play, pause, seekTo }), [play, pause, seekTo]);

  const toggle = () => (status === "playing" ? pause() : play());
  const toggleMute = () => {
    const next = !muted;
    if (youtubeRef.current) {
      if (next) youtubeRef.current.mute();
      else youtubeRef.current.unMute();
    }
    if (videoRef.current) videoRef.current.muted = next;
    setMuted(next);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (BACK_KEYS.has(event.key) || BACK_KEY_CODES.has(event.keyCode)) {
      pause();
      return;
    }
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const forward = event.key === "ArrowRight";
    const active = document.activeElement as HTMLElement | null;
    if (active?.dataset.seekbar !== undefined) {
      seekTo(Math.min(duration, Math.max(0, time + (forward ? 10 : -10))));
    } else {
      // Remote D-pad: move focus between the player's controls.
      const controls = Array.from(controlsRef.current?.parentElement?.querySelectorAll<HTMLElement>("[data-control]") ?? []);
      const index = controls.indexOf(active as HTMLElement);
      if (index < 0) return;
      controls[(index + (forward ? 1 : controls.length - 1)) % controls.length]?.focus();
    }
    event.preventDefault();
  };

  if (!player || player.provider === "story") {
    return (
      <div className={className} style={styles.frame}>
        <div style={styles.cover}>
          <p style={styles.coverTitle}>{title}</p>
          <p style={styles.coverText}>{player ? "This is a picture book: open it in the KidQ story reader." : "This video isn't available to play."}</p>
        </div>
      </div>
    );
  }

  const covered = status !== "playing";
  const coverBackground = poster ? `linear-gradient(rgba(20,28,24,.55), rgba(20,28,24,.8)), url("${poster}")` : undefined;

  return (
    <div className={`kidq-player ${className ?? ""}`} style={styles.root} onKeyDown={onKeyDown}>
      <style>{PLAYER_CSS}</style>
      <div style={styles.frame}>
        {player.provider === "youtube" ? (
          <div ref={mountRef} style={styles.media} />
        ) : (
          <video
            ref={videoRef}
            src={player.media_url}
            poster={poster ?? undefined}
            playsInline
            preload="metadata"
            disablePictureInPicture
            controlsList="nodownload noremoteplayback noplaybackrate"
            style={styles.media}
            onPlay={() => setStatus("playing")}
            onPause={() => setStatus((current) => (current === "ended" ? current : "paused"))}
            onEnded={finish}
            onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
            onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
            onError={() => fail(5)}
          />
        )}
        {/* Blocks clicks on YouTube's own title, channel link and logo. */}
        <button type="button" tabIndex={-1} aria-hidden="true" style={styles.shield} onClick={toggle} />
        {covered && (
          <div style={{ ...styles.cover, backgroundImage: coverBackground }}>
            {status === "error" ? (
              <p style={styles.coverTitle}>This video can&apos;t play right now.</p>
            ) : status === "ended" && endCard ? (
              endCard
            ) : (
              <>
                <p style={styles.coverTitle}>{title}</p>
                <button type="button" data-control style={styles.bigButton} onClick={play}>
                  {status === "ended" ? "↺ Watch again" : "▶ Play"}
                </button>
              </>
            )}
          </div>
        )}
      </div>
      <div ref={controlsRef} style={styles.controls}>
        <button type="button" data-control style={styles.button} onClick={toggle} aria-label={status === "playing" ? "Pause" : "Play"}>
          {status === "playing" ? "❚❚" : "▶"}
        </button>
        <div
          data-control
          data-seekbar
          tabIndex={0}
          role="slider"
          aria-label="Position"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(time)}
          aria-valuetext={`${formatTime(time)} of ${formatTime(duration)}`}
          style={styles.seekbar}
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            seekTo(((event.clientX - rect.left) / rect.width) * duration);
          }}
        >
          <div style={{ ...styles.seekFill, width: `${duration ? Math.min(100, (time / duration) * 100) : 0}%` }} />
        </div>
        <span style={styles.time}>
          {formatTime(time)} / {formatTime(duration)}
        </span>
        <button type="button" data-control style={styles.button} onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"}>
          {muted ? "🔇" : "🔊"}
        </button>
      </div>
      {attribution?.required && attribution.text ? <p style={styles.credit}>{attribution.text}</p> : null}
    </div>
  );
});

export { KidQStoryReader, type KidQStoryReaderProps, type StoryPage } from "./story-reader";

const PLAYER_CSS = `
.kidq-player iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.kidq-player [data-control]:focus-visible{outline:4px solid #f5a524;outline-offset:3px}
@media (prefers-reduced-motion: reduce){.kidq-player *{transition:none!important}}
`;

const styles: Record<string, CSSProperties> = {
  root: { display: "grid", gap: 10, width: "100%" },
  frame: { position: "relative", width: "100%", aspectRatio: "16 / 9", background: "#1b2420", borderRadius: 16, overflow: "hidden" },
  // contain, never cover: portrait and square videos show whole, letterboxed.
  media: { position: "absolute", inset: 0, width: "100%", height: "100%", border: 0, background: "#1b2420", objectFit: "contain" },
  shield: { position: "absolute", inset: 0, background: "transparent", border: 0, cursor: "pointer" },
  cover: {
    position: "absolute",
    inset: 0,
    display: "grid",
    placeItems: "center",
    alignContent: "center",
    gap: 16,
    padding: 24,
    textAlign: "center",
    color: "#fffdf8",
    background: "#24352f",
    // The poster shows whole (square book covers, portrait clips); the tint layer fills the frame.
    backgroundSize: "100% 100%, contain",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "center",
  },
  coverTitle: { margin: 0, fontSize: 20, fontWeight: 700, maxWidth: "36ch", lineHeight: 1.3 },
  coverText: { margin: 0, fontSize: 15, opacity: 0.85 },
  bigButton: { minHeight: 56, padding: "0 28px", borderRadius: 999, border: 0, background: "#dd5b3c", color: "#fffaf0", fontSize: 20, fontWeight: 800, cursor: "pointer" },
  controls: { display: "flex", alignItems: "center", gap: 12 },
  button: { minWidth: 48, minHeight: 48, borderRadius: 12, border: "1px solid rgba(36,53,47,.2)", background: "#fffdf8", color: "#24352f", fontSize: 18, cursor: "pointer" },
  seekbar: { flex: 1, height: 14, borderRadius: 999, background: "rgba(36,53,47,.15)", cursor: "pointer", overflow: "hidden" },
  seekFill: { height: "100%", background: "#4f8d6f" },
  time: { minWidth: 92, textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#5b6d64", fontSize: 14 },
  credit: { margin: 0, fontSize: 12, color: "#5b6d64" },
};
