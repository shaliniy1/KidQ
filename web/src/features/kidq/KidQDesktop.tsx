"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import styles from "./KidQDesktop.module.css";
import { getChildren, type ChildProfile } from "@/services/child-profile";
import {
  endSession,
  getCurrentSession,
  listSessions,
  recordItemOutcome,
  replaySession,
  startSession,
  type AssembledSession,
} from "@/services/session";
import { getLibrary, type LibraryEntry } from "@/services/my-videos";
import { getActivities, type ParentActivity } from "@/services/activity-breaks";
import { getStory, type Story } from "@/services/story";
import { KidQPlayer, KidQStoryReader } from "@kidq/player";
import { BreathingBreak, FindColoursBreak } from "./BreakGames";

type Stage = "profile" | "library" | "sunrise" | "watching" | "timedBreak" | "playtime" | "breathing" | "follow" | "find" | "choice" | "end" | "noSession" | "night" | "cast";
type SlotItem = AssembledSession["slots"][number]["items"][number];
type QueueEntry = { slotIndex: number; isLastInSlot: boolean; item: SlotItem };
type BreakActivity = AssembledSession["slots"][number]["break_activity"];

const CHILD_COLOURS = ["#1F7A6D", "#E2705E", "#2B2955", "#F0A72E", "#16594F"];
const QUEUE_COLOURS = ["#D8C89C", "#B9A574", "#C9B8E8", "#F0A72E", "#7FD8C8", "#E2705E"];

type LiveActivityStage = "breathing" | "follow" | "find";
type ActivityDefinition = {
  key: string;
  aliases: readonly string[];
  title: string;
  stage?: LiveActivityStage;
  live: boolean;
};

// Keep the activity catalogue in one place. Only entries with `live: true`
// are wired to an interactive Kid flow; the remaining concepts stay visible
// to the product team without accidentally presenting an unfinished activity.
const ACTIVITY_DEFINITIONS: readonly ActivityDefinition[] = [
  { key: "find", aliases: ["find"], title: "Find 3 colours", stage: "find", live: true },
  { key: "follow", aliases: ["follow", "sun"], title: "Follow the sun", stage: "follow", live: true },
  { key: "breathe", aliases: ["breathe", "breath"], title: "Breathe with Sun", stage: "breathing", live: true },
  { key: "tree", aliases: ["tree"], title: "Tree pose", live: false },
  { key: "butterfly_wings", aliases: ["butterfly"], title: "Butterfly wings", live: false },
  { key: "puddle_jump", aliases: ["puddle"], title: "Puddle jump", live: false },
  { key: "cloud_reach", aliases: ["cloud"], title: "Cloud reach", live: false },
  { key: "sleepy_stretch", aliases: ["sleepy", "stretch"], title: "Sleepy stretch", live: false },
  { key: "firefly_count", aliases: ["firefly"], title: "Firefly count", live: false },
];

function activityScreen(activity: BreakActivity): "breathing" | "follow" | "find" | "playtime" {
  const searchable = `${activity?.key ?? ""} ${activity?.title ?? ""}`.toLowerCase();
  const definition = ACTIVITY_DEFINITIONS.find((item) =>
    item.live && [item.key, ...item.aliases].some((alias) => searchable.includes(alias)),
  );
  return definition?.stage ?? "playtime";
}

function flattenQueue(session: AssembledSession | null): QueueEntry[] {
  if (!session) return [];
  return session.slots.flatMap((slot) =>
    slot.items.map((item, index) => ({ slotIndex: slot.slot, isLastInSlot: index === slot.items.length - 1, item })),
  );
}

export default function KidQDesktop() {
  const searchParams = useSearchParams();
  const [stage, setStage] = useState<Stage>("profile");
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [childName, setChildName] = useState("");
  const [activeChild, setActiveChild] = useState<ChildProfile | null>(null);
  const [libraryItems, setLibraryItems] = useState<LibraryEntry[]>([]);
  const [selectedLibraryIds, setSelectedLibraryIds] = useState<Set<string>>(new Set());
  const [session, setSession] = useState<AssembledSession | null>(null);
  const [current, setCurrent] = useState(0);
  const [completedSeconds, setCompletedSeconds] = useState(0);
  const [paused, setPaused] = useState(false);
  const [followCatches, setFollowCatches] = useState(0);
  const [breakSlotIndex, setBreakSlotIndex] = useState<number | null>(null);
  const [timedBreak, setTimedBreak] = useState<ParentActivity | null>(null);
  const [activities, setActivities] = useState<ParentActivity[]>([]);
  const playerRef = useRef<React.ElementRef<typeof KidQPlayer>>(null);
  const [handledBreakpoints, setHandledBreakpoints] = useState<Set<number>>(new Set());
  const [story, setStory] = useState<Story | null>(null);
  const [childrenLoaded, setChildrenLoaded] = useState(false);

  useEffect(() => {
    getChildren().then(setChildren).catch(() => setChildren([])).finally(() => setChildrenLoaded(true));
    getActivities().then((catalogue) => setActivities([...catalogue.moving, ...catalogue.calmer])).catch(() => setActivities([]));
  }, []);

  useEffect(() => {
    if (searchParams.get("choose") === "1") setStage("profile");
  }, [searchParams]);

  const queue = useMemo(() => flattenQueue(session), [session]);
  const currentEntry: QueueEntry | undefined = queue[current];
  const isStorybook = currentEntry?.item.card.content_type === "STORYBOOK";

  useEffect(() => {
    if (stage !== "watching" || !isStorybook || !currentEntry) {
      setStory(null);
      return;
    }
    let cancelled = false;
    getStory(currentEntry.item.card.id)
      .then((result) => { if (!cancelled) setStory(result); })
      .catch(() => { if (!cancelled) setStory(null); });
    return () => { cancelled = true; };
  }, [stage, isStorybook, currentEntry]);

  const video = currentEntry
    ? {
        title: currentEntry.item.card.title,
        minutes: currentEntry.item.card.duration_seconds ? Math.round(currentEntry.item.card.duration_seconds / 60) : 0,
        pickedBy: "Mumma & Papa",
        colour: QUEUE_COLOURS[current % QUEUE_COLOURS.length],
      }
    : null;
  const plannedMinutes = session ? Math.round(session.planned_seconds / 60) : 30;
  const progress = session && session.planned_seconds > 0 ? Math.min(100, Math.round((completedSeconds / session.planned_seconds) * 100)) : 0;
  const remaining = Math.max(1, Math.ceil((session ? session.planned_seconds - completedSeconds : plannedMinutes * 60) / 60));
  const nextVideos = useMemo(() => queue.filter((_, index) => index !== current), [queue, current]);

  async function chooseChild(child: ChildProfile, forceNoSession = false) {
    setChildName(child.nickname);
    setActiveChild(child);
    setCompletedSeconds(0);
    setBreakSlotIndex(null);
    if (forceNoSession) {
      setSession(null);
      setLibraryItems([]);
      setStage("noSession");
      return;
    }
    try {
      const [live, library] = await Promise.all([getCurrentSession(child.id), getLibrary(child.id).catch(() => [])]);
      setLibraryItems(library);
      setSelectedLibraryIds(new Set(library.map((item) => item.card.id)));
      if (live && live.slots.some((slot) => slot.items.length > 0)) {
        setSession(live);
        setCurrent(0);
        setStage("sunrise");
      } else {
        setSession(null);
        setStage(library.length > 0 ? "library" : "noSession");
      }
    } catch {
      setSession(null);
      setStage("noSession");
    }
  }

  async function startSelectedLibrarySession() {
    if (!activeChild || selectedLibraryIds.size === 0) return;
    try {
      const started = await startSession(activeChild.id, 30, "AUTO");
      setSession(started);
      setCurrent(0);
      setCompletedSeconds(0);
      setBreakSlotIndex(null);
      setStage("sunrise");
    } catch {
      // Keep the picker visible when the parent queue cannot be started yet.
    }
  }

  async function handleReplay() {
    if (!activeChild) return;
    try {
      const history = await listSessions(activeChild.id);
      const previous = history.find((item) => item.ended_at);
      if (!previous) return;
      const replayed = await replaySession(previous.id);
      setSession(replayed);
      setCurrent(0);
      setCompletedSeconds(0);
      setBreakSlotIndex(null);
      setStage("sunrise");
    } catch {
      // Nothing to replay — stay on the no-session screen.
    }
  }

  const startWatching = (index = current) => { setCurrent(index); setPaused(false); setTimedBreak(null); setHandledBreakpoints(new Set()); setFollowCatches(0); setStage("watching"); };

  function checkTimedBreakpoint(position: number) {
    const entry = queue[current];
    if (!entry || stage !== "watching") return;
    const point = entry.item.activity_breakpoints.find((candidate) => candidate.timestamp_seconds <= position && !handledBreakpoints.has(candidate.timestamp_seconds));
    if (!point) return;
    const activity = activities.find((candidate) => candidate.id === point.activity_id);
    if (!activity) return;
    setHandledBreakpoints((currentPoints) => new Set(currentPoints).add(point.timestamp_seconds));
    setTimedBreak(activity);
    playerRef.current?.pause();
    setStage("timedBreak");
  }

  async function finishVideo() {
    const entry = currentEntry;
    if (!session || !entry) return;
    const durationSeconds = entry.item.card.duration_seconds ?? 0;
    recordItemOutcome(session.id, entry.item.id, { outcome: "COMPLETED", watched_seconds: durationSeconds }).catch(() => undefined);
    setCompletedSeconds((value) => value + durationSeconds);

    const isLastOverall = current >= queue.length - 1;
    if (isLastOverall) {
      endSession(session.id, "COMPLETED").catch(() => undefined);
      setStage("end");
      return;
    }
    setCurrent((value) => value + 1);
    if (entry.isLastInSlot) {
      setBreakSlotIndex(entry.slotIndex);
      setStage("playtime");
    }
  }

  const breakSlot = session?.slots.find((item) => item.slot === breakSlotIndex);
  const breakActivity = breakSlot?.break_activity ?? null;

  const beginBreak = () => {
    setFollowCatches(0);
    setStage(activityScreen(breakActivity));
  };

  if (stage === "profile") return <Shell label="Who's watching today?"><section className={styles.profileScreen}><div className={styles.profileStars} /><h1>Who&apos;s watching<br />today?</h1>{children.length > 0 ? <div className={styles.profileChoices}>{children.map((item, index) => <button key={item.id} onClick={() => chooseChild(item)}><span style={{ background: CHILD_COLOURS[index % CHILD_COLOURS.length] }}>{item.nickname[0]}</span><b>{item.nickname}</b><small>Start my day</small></button>)}</div> : childrenLoaded && <div className={styles.noProfiles}><p>No child profiles yet.</p><Link href="/parent">Set up a child profile in Parent view</Link></div>}<p className={styles.noLogin}>No child login needed — a parent sets up the profile.</p>{children[0] && <button className={styles.demoLink} onClick={() => chooseChild(children[0], true)}>Show no-session state</button>}</section></Shell>;
  if (stage === "library") return <LibraryPicker childName={childName} items={libraryItems} selected={selectedLibraryIds} toggle={(id) => setSelectedLibraryIds((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; })} start={startSelectedLibrarySession} onBack={() => setStage("profile")} />;
  if (stage === "sunrise") return <Shell label={`${childName}'s session`}><section className={styles.sunriseScreen}><div className={styles.sunriseSky}><span className={styles.sunriseStars} /><div className={styles.sunriseCenter}><h1>Hi,<br />{childName}!</h1><button className={styles.sunButton} onClick={() => startWatching(0)} aria-label="Start today's watching session"><Sun /></button><p>Tap the sun to start your day</p><p className={styles.heartLine}>♥ <b>Mumma &amp; Papa picked {queue.length} video{queue.length === 1 ? "" : "s"}</b> · {plannedMinutes} min</p></div></div></section></Shell>;
  if (stage === "playtime") return <BreakScreen title={breakActivity?.title ?? "Time to play!"} body={breakActivity?.instruction ?? "The sun is coming down for a little break away from the screen."} action="Start the break" onClick={beginBreak} />;
  if (stage === "timedBreak") return <BreakScreen title={timedBreak?.title ?? "Time for an activity"} body={timedBreak?.instruction ?? "Take a little break away from the screen."} action="Resume video" onClick={() => { setTimedBreak(null); setStage("watching"); playerRef.current?.play(); }} />;
  if (stage === "breathing") return <BreathingBreak onComplete={() => setStage("choice")} />;
  if (stage === "follow") return <BreakScreen title={followCatches < 3 ? "Follow the sun!" : "You did it! ✨"} body={followCatches < 3 ? `Follow the sun with your eyes and catch it · ${followCatches} of 3` : "A gentle break is complete."} action={followCatches < 3 ? "Catch the sun" : "Continue"} onClick={() => followCatches < 3 ? setFollowCatches((value) => value + 1) : setStage("choice")} />;
  if (stage === "find") return <FindColoursBreak onComplete={() => setStage("choice")} />;
  if (stage === "choice") return <ChoiceScreen childName={childName} hasNext={current < queue.length} onNext={() => current >= queue.length ? setStage("end") : startWatching(current)} onPick={(index) => startWatching(index)} items={queue} />;
  if (stage === "end") return <EndScreen childName={childName} onNight={() => setStage("night")} />;
  if (stage === "noSession") return <NoSession onBack={() => setStage("profile")} onReplay={handleReplay} />;
  if (stage === "night") return <NightLight childName={childName} onBack={() => setStage("profile")} />;
  if (stage === "cast") return <CastScreen childName={childName} onBack={() => setStage("watching")} />;

  if (!video) return <NoSession onBack={() => setStage("profile")} onReplay={handleReplay} />;

  const sunPosition = progress <= 8 ? { left: "10%", top: "92%" } : progress >= 96 ? { left: "90%", top: "92%" } : { left: `${progress}%`, top: "30%" };
  return <Shell label={`${childName}'s session`}><section className={`${styles.world} ${progress >= 96 ? styles.end : ""}`}><div className={styles.cloudOne} /><div className={styles.cloudTwo} /><div className={styles.arc} aria-hidden="true"><svg viewBox="0 0 1280 220" preserveAspectRatio="none"><path d="M70 205 Q640 15 1210 205" fill="none" stroke="#E4D6B8" strokeWidth="3" strokeDasharray="1 11" strokeLinecap="round" /><line x1="70" y1="205" x2="1210" y2="205" stroke="#E4D6B8" strokeWidth="3" strokeLinecap="round" /></svg></div><div className={styles.sun} style={sunPosition} aria-label="Session progress"><span className={styles.halo} /><Sun /></div><span className={styles.timeLeft}>{remaining} min left</span><div className={styles.childHeader}><span className={styles.avatar}>{childName[0]}</span><div><h2>{childName}&apos;s watch time</h2><p>video {current + 1} of {queue.length}</p></div></div><div className={styles.content}><div className={isStorybook ? styles.storyFrame : styles.player}>{isStorybook ? (story ? <KidQStoryReader title={story.title} pages={story.pages} credits={story.credits} attribution={story.attribution} onFinished={() => void finishVideo()} /> : <div className={styles.playerArt}><span>{video.title}</span><small>Loading the book…</small></div>) : <KidQPlayer ref={playerRef} player={currentEntry.item.card.player} title={video.title} poster={currentEntry.item.card.thumbnail_url} attribution={currentEntry.item.card.attribution} onPlayback={(event) => { if (event.type === "time") checkTimedBreakpoint(event.position); }} onEnded={() => void finishVideo()} />}</div><div className={styles.dayBar} aria-label={`${progress}% of session elapsed`}><span style={{ width: `${100 - progress}%` }} /><b className={styles.progressSun} style={{ left: `${progress}%` }} aria-hidden="true"><Sun /></b></div><div className={styles.now}><h3>{paused ? "Paused for now" : video.title}</h3><p><Heart /><span><strong>Picked by {video.pickedBy}</strong> · {video.minutes} min</span></p></div><p className={styles.upNext}>Your session</p><div className={styles.queue}>{queue.map((entry, index) => <button key={entry.item.id} className={`${styles.queueCard} ${index === current ? styles.queueCurrent : ""}`} onClick={() => startWatching(index)}><span>{entry.item.card.title}</span></button>)}<button className={styles.endCard} onClick={finishVideo}>The End 🌙<small>Finish &amp; play</small></button></div><div className={styles.sessionActions}><button onClick={finishVideo}>{current === queue.length - 1 ? "Finish videos" : "Finish this video"}</button><button onClick={() => setStage("cast")}>Cast mode</button></div></div></section></Shell>;
}

export function Shell({ children, label }: { children: React.ReactNode; label: string }) { return <main className={styles.page}><header className={styles.productBar}><Link className={styles.brand} href="/kid">KidQ<span>✦</span></Link><span className={styles.modeLabel}>{label}</span><div className={styles.headerActions}><Link className={styles.navButton} href="/kid?choose=1">Choose another child</Link></div></header>{children}</main>; }
function LibraryPicker({ childName, items, selected, toggle, start, onBack }: { childName: string; items: LibraryEntry[]; selected: Set<string>; toggle: (id: string) => void; start: () => void; onBack: () => void }) { return <Shell label={`${childName}'s picks`}><section className={styles.choiceScreen}><div className={styles.breakSun}><Sun /></div><h1>Pick something for today, {childName}.</h1><p>These are the videos your parent picked. Choose what you would like to watch.</p><div className={styles.choiceList}>{items.map((item) => <button key={item.card.id} onClick={() => toggle(item.card.id)} aria-pressed={selected.has(item.card.id)} style={selected.has(item.card.id) ? { outline: "3px solid #1F7A6D" } : undefined}><span style={{ background: item.card.thumbnail_url ? `url(${item.card.thumbnail_url}) center / contain no-repeat #d8c89c` : "#d8c89c" }} />{item.card.title}</button>)}</div><button disabled={selected.size === 0} onClick={start}>Start selected videos</button><button className={styles.secondaryAction} onClick={onBack}>Choose another child</button></section></Shell>; }
function BreakScreen({ title, body, action, onClick }: { title: string; body: string; action: string; onClick: () => void }) { return <Shell label="Playtime"><section className={styles.breakScreen}><div className={styles.breakSun}><Sun /></div><h1>{title}</h1><p>{body}</p><button onClick={onClick}>{action}</button></section></Shell>; }
function ChoiceScreen({ childName, hasNext, onNext, onPick, items }: { childName: string; hasNext: boolean; onNext: () => void; onPick: (index: number) => void; items: QueueEntry[] }) { return <Shell label="Choose what is next"><section className={styles.choiceScreen}><div className={styles.breakSun}><Sun /></div><h1>What&apos;s next, {childName}?</h1><p>{hasNext ? "Tap the sun for the next video, or choose one of your remaining picks." : "The sun is ready to set. Choose the moon when you are done."}</p><button onClick={onNext}>{hasNext ? "☀ Next video" : "🌙 Finish the day"}</button><div className={styles.choiceList}>{items.map((entry, index) => <button key={entry.item.id} onClick={() => onPick(index)}><span style={{ background: QUEUE_COLOURS[index % QUEUE_COLOURS.length] }} />{entry.item.card.title}</button>)}</div></section></Shell>; }
function EndScreen({ childName, onNight }: { childName: string; onNight: () => void }) { return <Shell label="All done for today"><section className={styles.kidComplete}><div className={styles.endMoon}>🌙</div><h1>All done for now, {childName}.</h1><p>The sun has set. Time to go play, rest, or do something offline.</p><button onClick={onNight}>Turn on night light</button></section></Shell>; }
function NoSession({ onBack, onReplay }: { onBack: () => void; onReplay: () => void }) { return <Shell label="No session"><section className={styles.noSession}><div className={styles.sleepSun}>☀</div><h1>The sun is<br />still asleep!</h1><p>No videos have been picked for today.</p><button onClick={onReplay}>Replay yesterday&apos;s session</button><button className={styles.secondaryAction} onClick={onBack}>Choose another child</button></section></Shell>; }
function NightLight({ childName, onBack }: { childName: string; onBack: () => void }) { return <Shell label="Night light"><section className={styles.nightLight}><div className={styles.endMoon}>🌙</div><h1>Goodnight, {childName}.</h1><p>The night light is warm and quiet.</p><button onClick={onBack}>Done</button></section></Shell>; }
function CastScreen({ childName, onBack }: { childName: string; onBack: () => void }) { return <Shell label="Cast mode"><section className={styles.castScreen}><div className={styles.castSky}><div className={styles.sun} style={{ left: "50%", top: "32%" }}><Sun /></div><h1>{childName}&apos;s session on the big screen</h1><p>Cast mode is ready for the family TV.</p><button onClick={onBack}>Back to player</button></div></section></Shell>; }

function Sun() { return <svg viewBox="0 0 60 60" aria-hidden="true"><g className={styles.rays}><line x1="30" y1="1.5" x2="30" y2="9.5" /><line x1="50" y1="30" x2="58.5" y2="30" /><line x1="44" y1="16" x2="50" y2="10" /><line x1="44" y1="44" x2="50" y2="50" /><line x1="30" y1="50.5" x2="30" y2="58.5" /><line x1="10" y1="50" x2="16" y2="44" /><line x1="1.5" y1="30" x2="10" y2="30" /><line x1="10" y1="10" x2="16" y2="16" /></g><circle cx="30" cy="30" r="16.5" fill="#FFC64D" /><circle cx="24.5" cy="28" r="1.9" fill="#2E2A24" /><circle cx="35.5" cy="28" r="1.9" fill="#2E2A24" /><path d="M24.5 34.5 Q30 39 35.5 34.5" fill="none" stroke="#2E2A24" strokeWidth="2.2" strokeLinecap="round" /></svg>; }
function Heart() { return <svg className={styles.heart} viewBox="0 0 20 20" aria-hidden="true"><path d="M10 17 C4 12 2 8.5 4.2 6.2 A3.4 3.4 0 0 1 10 7.4 A3.4 3.4 0 0 1 15.8 6.2 C18 8.5 16 12 10 17 Z" fill="#E2705E" /></svg>; }
