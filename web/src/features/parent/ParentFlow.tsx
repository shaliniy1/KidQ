"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import styles from "./ParentFlow.module.css";
import { getMockRecommendations, type ParentRecommendation } from "./recommendationService";
import { devSignIn, hasSession, signInWithGoogle, usingDevLogin } from "@/lib/session";
import { fetchSessionRouting } from "@/services/auth";
import { createChild, getMe, submitOnboarding, type ChildProfile, type OnboardingChild } from "@/services/child-profile";
import { getRecommendations as fetchRecommendations, addToLibrary, type Recommendation } from "@/services/recommendations";
import { getLibrary, removeFromLibrary, submitVideo } from "@/services/my-videos";
import { getCurationSettings, saveCurationSettings, type CurationSettings } from "@/services/curation-settings";
import { getLocalPreferences, saveLocalPreferences, type LocalPreferences } from "@/services/local-preferences";
import { getParentAnalytics, type ParentAnalytics, type Period } from "@/services/parent-analytics";

type Screen = "login" | "home" | "profile" | "addChild" | "confirmation" | "preferences" | "interests" | "content" | "regulation" | "screentime" | "voice" | "guided" | "recommendation" | "playlist" | "addContent" | "planReady" | "preview" | "session" | "complete" | "details" | "insights" | "library" | "add" | "settings";
type Child = { id: string; name: string; age: string; color: string; duration: number };

const AGE_BAND_LABELS: Record<string, string> = { "0_2": "0–2", "2_3": "2–3", "3_4": "3–4", "4_5": "4–5", "5_6": "5–6" };
const AGE_BAND_KEYS: Record<string, OnboardingChild["age_band"]> = { "0–2": "0_2", "2–3": "2_3", "3–4": "3_4", "4–5": "4_5", "5–6": "5_6" };
const MASCOT_COLORS = ["#1F7A6D", "#D9534F", "#008080", "#FF8C00", "#7C6BC4", "#F0A72E"];
const CATEGORY_LABELS: Record<string, string> = {
  video: "Video",
  storybooks: "Storybooks",
  stories: "Storybooks",
  creativity: "Creativity",
  creative: "Creativity",
  songs: "Songs & music",
  music: "Songs & music",
  movement: "Movement",
};

function titleCase(value: string): string {
  return value.trim().replace(/\s+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function categoryLabel(value: string | null | undefined): string {
  if (!value) return "Video";
  return CATEGORY_LABELS[value.toLowerCase()] ?? value.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function toChild(profile: ChildProfile, index: number): Child {
  return {
    id: profile.id,
    name: titleCase(profile.nickname),
    age: AGE_BAND_LABELS[profile.age_band] ?? profile.age_band,
    color: MASCOT_COLORS[index % MASCOT_COLORS.length],
    duration: profile.session_minutes ?? 30,
  };
}

function previewUrlFor(card: Recommendation["card"]): string | undefined {
  if (card.player?.provider === "youtube") return card.player.embed_url;
  if (card.player?.provider === "html5") return card.player.media_url;
  return undefined;
}

function toParentRecommendationCard(card: Recommendation["card"], selectedAge: string, reason: string): ParentRecommendation {
  return {
    id: card.id,
    title: card.title,
    duration: card.duration_seconds ? Math.round(card.duration_seconds / 60) : 0,
    category: categoryLabel(card.category ?? card.content_type),
    ageRange: selectedAge,
    thumbnailUrl: card.thumbnail_url ?? card.thumbnails?.high ?? card.thumbnails?.medium ?? card.thumbnails?.default ?? undefined,
    previewUrl: previewUrlFor(card),
    reason,
    guardrails: card.kidq_check.dimensions.map((d) => d.label).length
      ? card.kidq_check.dimensions.map((d) => d.label)
      : ["KidQ reviewed"],
  };
}

function toParentRecommendation(rec: Recommendation, selectedAge: string): ParentRecommendation {
  return toParentRecommendationCard(rec.card, selectedAge, rec.why[0] ?? "Recommended for your child");
}

export default function ParentFlow() {
  // Mounted at "/", "/parent" and "/login" alike — the history bookkeeping below
  // must stay on whichever of those it was actually loaded at, not assume one.
  const pathname = usePathname();
  const [screen, setScreen] = useState<Screen>("login");
  const screenRef = useRef<Screen>("login");
  const historyRef = useRef<Screen[]>(["login"]);
  const historyIndexRef = useRef(0);
  const [children, setChildren] = useState<Child[]>([]);
  const [active, setActive] = useState(0);
  const [duration, setDuration] = useState(30);
  const [parentName, setParentName] = useState("");
  const [draftNickname, setDraftNickname] = useState("");
  const [draftAgeBand, setDraftAgeBand] = useState("3–4");
  const [busy, setBusy] = useState(false);
  const [newVideo, setNewVideo] = useState("");
  const [library, setLibrary] = useState<{ id: string; title: string }[]>([]);
  const [range, setRange] = useState("week");
  const [timeMode, setTimeMode] = useState("Auto");
  const [recommendations, setRecommendations] = useState<ParentRecommendation[]>([]);
  const [selectedRecommendations, setSelectedRecommendations] = useState<string[]>([]);
  const [playlist, setPlaylist] = useState<ParentRecommendation[]>([]);
  const [newChildNickname, setNewChildNickname] = useState("");
  const [newChildAgeBand, setNewChildAgeBand] = useState("3–4");
  const [childError, setChildError] = useState<string | null>(null);
  const child = children[active];

  function navigateScreen(next: Screen) {
    if (screenRef.current === next) return;
    const nextHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
    nextHistory.push(next);
    historyRef.current = nextHistory;
    historyIndexRef.current = nextHistory.length - 1;
    screenRef.current = next;
    window.history.pushState({ kidqParent: true, parentIndex: historyIndexRef.current }, "", pathname);
    setScreen(next);
  }

  useEffect(() => {
    window.history.replaceState({ kidqParent: true, parentIndex: 0 }, "", pathname);
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state as { kidqParent?: boolean; parentIndex?: number } | null;
      if (state?.kidqParent && typeof state.parentIndex === "number" && state.parentIndex < historyIndexRef.current) {
        const previous = historyRef.current[state.parentIndex] ?? "home";
        historyIndexRef.current = state.parentIndex;
        screenRef.current = previous;
        setScreen(previous);
        return;
      }

      // Keep browser Back inside the Parent journey. The Kid route is only
      // reachable through the explicit View kid mode action.
      window.history.pushState({ kidqParent: true, parentIndex: historyIndexRef.current }, "", pathname);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Real-session bootstrap: a returning, already-onboarded parent skips
  // straight past login/profile — a signed-in-but-not-yet-onboarded parent
  // (e.g. mid-setup, or right after a real Google OAuth redirect back to
  // this page) lands on Profile instead of the login screen.
  useEffect(() => {
    hasSession().then(async (signedIn) => {
      if (!signedIn) return;
      try {
        const routing = await fetchSessionRouting();
        if (routing.onboardingComplete) {
          const me = await getMe();
          setParentName(titleCase(me.parent.name));
          if (me.children.length > 0) {
            setChildren(me.children.map(toChild));
            setActive(0);
            setDuration(me.children[0].session_minutes ?? 30);
            navigateScreen("home");
            return;
          }
        }
        navigateScreen("profile");
      } catch {
        // Couldn't reach the API — stay on the login screen rather than guess.
      }
    });
  }, []);

  async function handleGoogleSignIn() {
    setBusy(true);
    try {
      if (usingDevLogin) {
        devSignIn();
        const routing = await fetchSessionRouting();
        if (routing.onboardingComplete) {
          const me = await getMe();
          setParentName(titleCase(me.parent.name));
          setChildren(me.children.map(toChild));
          setActive(0);
          navigateScreen("home");
        } else {
          navigateScreen("profile");
        }
        return;
      }
      await signInWithGoogle();
    } finally {
      setBusy(false);
    }
  }

  async function handleFirstTimeSignIn() {
    setBusy(true);
    try {
      if (usingDevLogin) {
        devSignIn();
        navigateScreen("profile");
        return;
      }
      await signInWithGoogle();
    } finally {
      setBusy(false);
    }
  }

  async function handleOnboardingSubmit() {
    if (!parentName.trim() || !draftNickname.trim() || busy) return;
    setBusy(true);
    try {
      const me = await submitOnboarding(titleCase(parentName), [
        { nickname: titleCase(draftNickname), age_band: AGE_BAND_KEYS[draftAgeBand] },
      ]);
      setChildren(me.children.map(toChild));
      setActive(0);
      navigateScreen("confirmation");
    } finally {
      setBusy(false);
    }
  }

  const chooseChild = (index: number) => { setActive(index); setDuration(children[index].duration); };
  const saveDuration = () => setChildren((current) => current.map((item, index) => index === active ? { ...item, duration } : item));

  async function loadRecommendations() {
    if (!child || busy) return;
    setBusy(true);
    try {
      const [real, libraryEntries] = await Promise.all([
        fetchRecommendations(child.id),
        getLibrary(child.id).catch(() => []),
      ]);
      const mapped = real.length > 0
        ? real.map((item) => toParentRecommendation(item, child.age))
        : getMockRecommendations(child, duration).map((item) => ({
            ...item,
            ageRange: child.age,
            category: categoryLabel(item.category),
          }));
      const saved = libraryEntries.map((entry) => toParentRecommendationCard(entry.card, child.age, "Added to your Q"));
      const localAdded = recommendations.filter((item) => /^(url|approved|saved|pdf)-/.test(item.id));
      const byId = new Map([...mapped, ...saved, ...localAdded].map((item) => [item.id, item]));
      const merged = [...byId.values()];
      setRecommendations(merged);
      setSelectedRecommendations(merged.map((item) => item.id));
      navigateScreen("recommendation");
    } catch {
      const fallback = [...getMockRecommendations(child, duration), ...recommendations.filter((item) => /^(url|approved|saved|pdf)-/.test(item.id))];
      setRecommendations(fallback);
      setSelectedRecommendations(fallback.map((item) => item.id));
      navigateScreen("recommendation");
    } finally {
      setBusy(false);
    }
  }

  async function handleAddChild() {
    if (!newChildNickname.trim() || busy) return;
    setBusy(true);
    setChildError(null);
    try {
      const created = await createChild({ nickname: titleCase(newChildNickname), age_band: AGE_BAND_KEYS[newChildAgeBand] });
      const nextChildren = [...children, toChild(created, children.length)];
      setChildren(nextChildren);
      setActive(nextChildren.length - 1);
      setDuration(created.session_minutes ?? 30);
      setNewChildNickname("");
      setNewChildAgeBand("3–4");
      navigateScreen("home");
    } catch (error) {
      setChildError(error instanceof Error ? error.message : "Could not add this child");
    } finally {
      setBusy(false);
    }
  }

  async function loadLibrary() {
    if (child) {
      try {
        const entries = await getLibrary(child.id);
        setLibrary(entries.map((entry) => ({ id: entry.card.id, title: entry.card.title })));
      } catch {
        // Keep whatever was already shown if the fetch fails.
      }
    }
    navigateScreen("library");
  }

  function removeFromLibraryList(id: string) {
    setLibrary((items) => items.filter((item) => item.id !== id));
    if (child) removeFromLibrary(child.id, id).catch(() => undefined);
  }

  async function confirmRecommendations() {
    if (!child || busy) return;
    const chosen = recommendations.filter((item) => selectedRecommendations.includes(item.id));
    setBusy(true);
    try {
      await Promise.all(chosen.map((item) => addToLibrary(child.id, item.id).catch(() => undefined)));
    } finally {
      setPlaylist(chosen);
      navigateScreen("planReady");
      setBusy(false);
    }
  }

  return <main className={styles.app}>
    {screen !== "login" && <header className={styles.topbar}>
      <Link className={styles.brand} href="/kid">KidQ<span>✦</span></Link>
      <nav aria-label="Parent navigation">
        <button className={screen === "home" || screen === "session" ? styles.activeNav : ""} onClick={() => navigateScreen("home")}>Today</button>
        <button className={screen === "recommendation" || screen === "playlist" ? styles.activeNav : ""} onClick={loadRecommendations}>Recommendations</button>
        <button className={screen === "details" ? styles.activeNav : ""} onClick={() => navigateScreen("details")}>Insight log</button>
        <button className={screen === "insights" ? styles.activeNav : ""} onClick={() => navigateScreen("insights")}>Insights</button>
        <button className={screen === "library" || screen === "add" ? styles.activeNav : ""} onClick={loadLibrary}>My videos</button>
        <button className={screen === "settings" ? styles.activeNav : ""} onClick={() => navigateScreen("settings")}>Settings</button>
      </nav>
      <Link className={styles.kidLink} href="/kid">View kid mode</Link>
      <button className={styles.profile} aria-label="Parent profile">{(parentName[0] || "P").toUpperCase()}</button>
    </header>}

    <div className={styles.shellFrame}>
    {screen !== "login" && <aside className={styles.desktopSidebar} aria-label="Parent workspace navigation"><div className={styles.sidebarTitle}>KidQ</div><div className={styles.sidebarLabel}>Workspace</div><button onClick={() => navigateScreen("home")}>▶ <span>Start a session</span></button><button onClick={() => navigateScreen("addChild")}>＋ <span>Add a child</span></button><button onClick={loadRecommendations}>✦ <span>Recommendations</span></button><button onClick={() => navigateScreen("insights")}>◔ <span>Insights</span></button><button onClick={loadLibrary}>▣ <span>My videos</span></button><button onClick={() => navigateScreen("settings")}>☼ <span>Settings</span></button></aside>}
    <div className={screen === "login" ? `${styles.shell} ${styles.shellLogin}` : styles.shell}>
      {screen === "login" && <Login google={handleGoogleSignIn} firstTime={handleFirstTimeSignIn} />}
      {screen === "home" && child && <Home child={child} active={active} children={children} duration={duration} timeMode={timeMode} setTimeMode={setTimeMode} chooseChild={chooseChild} setDuration={setDuration} getRecommendations={loadRecommendations} setScreen={navigateScreen} parentName={parentName} />}
      {screen === "profile" && <Profile name={parentName} setName={setParentName} nickname={draftNickname} setNickname={setDraftNickname} ageBand={draftAgeBand} setAgeBand={setDraftAgeBand} next={handleOnboardingSubmit} disabled={busy || !parentName.trim() || !draftNickname.trim()} back={() => navigateScreen("home")} />}
      {screen === "addChild" && <AddChild nickname={newChildNickname} setNickname={setNewChildNickname} ageBand={newChildAgeBand} setAgeBand={setNewChildAgeBand} next={handleAddChild} disabled={busy || !newChildNickname.trim()} error={childError} back={() => navigateScreen("home")} />}
      {screen === "confirmation" && child && <Confirmation child={child} start={() => navigateScreen("home")} customize={() => navigateScreen("preferences")} browse={loadRecommendations} back={() => navigateScreen("profile")} />}
      {screen === "preferences" && child && <Preferences child={child} next={loadRecommendations} back={() => navigateScreen("profile")} setScreen={navigateScreen} />}
      {screen === "interests" && <PreferenceStep title="Interests" sub={`What does ${child?.name ?? "your child"} enjoy?`} options={["Animals", "Vehicles", "Music & rhymes", "Art & craft", "Space & science", "Stories", "Nature"]} next={() => navigateScreen("preferences")} back={() => navigateScreen("preferences")} />}
      {screen === "content" && <PreferenceStep title="Content mix" sub="Choose how KidQ should balance the session." options={["Surprise me", "Video", "Storybooks", "Creativity", "Songs & music", "Movement"]} next={() => navigateScreen("preferences")} back={() => navigateScreen("preferences")} />}
      {screen === "regulation" && <PreferenceStep title="Regulation goal" sub="What would help most right now?" options={["Help them calm down", "Manage big feelings", "Build focus", "Burn off energy", "Wind down before bed"]} next={() => navigateScreen("preferences")} back={() => navigateScreen("preferences")} />}
      {screen === "screentime" && <PreferenceStep title="Screen time & breaks" sub="Set a gentle default for this child." options={["15 min · wind-down only", "30 min · 1 break", "45 min · 2 breaks", "60 min · 3 breaks", "90 min · 5 breaks"]} next={() => navigateScreen("preferences")} back={() => navigateScreen("preferences")} />}
      {screen === "voice" && <PreferenceStep title="Talk to KidQ" sub="Describe what you are looking for, by voice or text." options={["🎙 Tap to speak", "Type: calming animal stories before bed"]} next={() => navigateScreen("preferences")} back={() => navigateScreen("preferences")} />}
      {screen === "guided" && <PreferenceStep title="A couple of quick questions" sub="Tap an answer for each — takes about 10 seconds." options={["Stories & imagination", "Active, physical play", "Calming down", "Building focus", "Burning energy"]} next={() => navigateScreen("preferences")} back={() => navigateScreen("preferences")} />}
      {screen === "recommendation" && child && <Recommendation child={child} duration={duration} items={recommendations} selected={selectedRecommendations} toggle={(id) => setSelectedRecommendations((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} next={confirmRecommendations} addContent={() => navigateScreen("addContent")} edit={() => navigateScreen("playlist")} back={() => navigateScreen("home")} />}
      {screen === "playlist" && <Playlist duration={duration} items={recommendations.filter((item) => selectedRecommendations.includes(item.id))} remove={(id) => setSelectedRecommendations((current) => current.filter((item) => item !== id))} move={(id, direction) => setRecommendations((current) => { const index = current.findIndex((item) => item.id === id); const nextIndex = index + direction; if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current; const copy = [...current]; [copy[index], copy[nextIndex]] = [copy[nextIndex], copy[index]]; return copy; })} addContent={() => navigateScreen("addContent")} confirm={confirmRecommendations} back={() => navigateScreen("recommendation")} />}
      {screen === "addContent" && <AddContent add={(item) => { if (!recommendations.some((existing) => existing.id === item.id)) { setRecommendations((current) => [...current, item]); setSelectedRecommendations((current) => [...current, item.id]); } navigateScreen("playlist"); }} back={() => navigateScreen("recommendation")} />}
      {screen === "planReady" && child && <PlanReady child={child} duration={duration} items={playlist} viewKid={() => navigateScreen("preview")} done={() => navigateScreen("home")} />}
      {screen === "preview" && child && <Preview child={child} items={playlist} next={() => navigateScreen("home")} back={() => navigateScreen("planReady")} />}
      {screen === "session" && child && <Session child={child} duration={duration} done={() => navigateScreen("complete")} back={() => navigateScreen("home")} />}
      {screen === "complete" && child && <Complete child={child} done={() => navigateScreen("home")} details={() => navigateScreen("details")} />}
      {screen === "details" && child && <Details child={child} library={library} back={() => navigateScreen("complete")} />}
      {screen === "insights" && child && <Insights child={child} active={active} children={children} range={range} setRange={setRange} chooseChild={chooseChild} />}
      {screen === "library" && child && <Library child={child} children={children} library={library} remove={removeFromLibraryList} add={() => navigateScreen("add")} />}
      {screen === "add" && <AddVideo value={newVideo} setValue={setNewVideo} back={loadLibrary} save={async () => { if (child && newVideo.trim()) { try { await submitVideo(child.id, newVideo.trim(), "PRIVATE"); } catch { /* best-effort */ } } setNewVideo(""); await loadLibrary(); }} />}
      {screen === "settings" && child && <Settings child={child} openPreferences={() => navigateScreen("preferences")} addChild={() => navigateScreen("addChild")} />}
    </div>
    </div>
    <nav className={styles.mobileTabs} aria-label="Mobile parent navigation"><button onClick={() => navigateScreen("home")}>▶<small>Start</small></button><button onClick={loadRecommendations}>✦<small>Recs</small></button><button onClick={() => navigateScreen("insights")}>◔<small>Insights</small></button><button onClick={loadLibrary}>▣<small>Videos</small></button><button onClick={() => navigateScreen("settings")}>⚙<small>Settings</small></button></nav>
  </main>;
}

function Header({ title, sub, back }: { title: string; sub?: string; back?: () => void }) { return <div className={styles.flowHeader}>{back && <button onClick={back} className={styles.back}>←</button>}<div><h1>{title}</h1>{sub && <p>{sub}</p>}</div></div>; }
function Button({ children, onClick, secondary = false, disabled = false }: { children: React.ReactNode; onClick?: () => void; secondary?: boolean; disabled?: boolean }) { return <button className={secondary ? styles.secondary : styles.primary} onClick={onClick} disabled={disabled}>{children}</button>; }
function Login({ google, firstTime }: { google: () => void; firstTime: () => void }) {
  const [entry, setEntry] = useState<"google" | "signup" | "signupConsent" | null>(null);
  const [consent, setConsent] = useState(false);
  const continueFromConsent = () => { if (!consent) return; (entry === "google" ? google : firstTime)(); };
  return <div className={`${styles.login} ${entry ? styles.loginConsent : ""}`}>
    <div className={styles.loginMark}>Q</div>
    <Header title="Welcome to KidQ" sub="Sign in to continue." />
    <Button onClick={() => { setEntry("google"); setConsent(false); }}>Continue with Google</Button>
    <Button secondary onClick={() => { setEntry("signup"); setConsent(false); }}>First-time parent setup</Button>
    {entry === "signup" && <div className={styles.signupPanel}>
      <b>Create your family account</b>
      <p>First-time setup starts with a Google account. You can use the same account whenever you return to KidQ.</p>
      <Button onClick={() => setEntry("signupConsent")}>Sign up with Google</Button>
    </div>}
    {(entry === "google" || entry === "signupConsent") && <div className={styles.loginTerms}>
      <b>Privacy, terms &amp; consent</b>
      <p>KidQ only stores a nickname and age band for your child — never a full name, photo, or location. One Google account per family; every caregiver signs in with the same account. By continuing, you confirm that you are this child&apos;s parent or guardian and consent to KidQ using this minimal profile data to provide age-appropriate sessions.</p>
      <label className={styles.check}><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /> I agree, I am this child&apos;s parent or guardian.</label>
      <Button disabled={!consent} onClick={continueFromConsent}>{entry === "google" ? "Continue to KidQ" : "Continue to setup"}</Button>
    </div>}
    {entry && <button className={styles.textLink} onClick={() => { setEntry(null); setConsent(false); }}>Back to sign in</button>}
  </div>;
}

function Home({ child, active, children, duration, timeMode, setTimeMode, chooseChild, setDuration, getRecommendations, setScreen, parentName }: { child: Child; active: number; children: Child[]; duration: number; timeMode: string; setTimeMode: (v: string) => void; chooseChild: (i: number) => void; setDuration: (v: number) => void; getRecommendations: () => void; setScreen: (s: Screen) => void; parentName: string }) { const [showTiming, setShowTiming] = useState(false); return <>
  <div className={styles.eyebrow}>Good afternoon, {parentName || "there"}</div><div className={styles.titleRow}><div><h1>Ready for a good session?</h1><p>Everything is set for a calm, finite watch.</p></div><span className={styles.status}>● Library ready</span></div>
  <section className={styles.childCard}><div><small>Session for</small><h2>{child.name}</h2><p>{child.age} years · {child.duration} min saved</p></div><div className={styles.children}>{children.map((item, index) => <button key={item.id} className={index === active ? styles.selected : ""} onClick={() => chooseChild(index)}><i style={{ background: item.color }}>{item.name[0]}</i>{item.name}</button>)}<button className={styles.preferenceButton} onClick={() => setScreen("addChild")}>＋ Add another child</button></div></section>
  <section className={styles.sessionCard}><div className={styles.sessionArt}><span>☀</span></div><div className={styles.sessionBody}><div className={styles.eyebrow}>Start a session</div><h2>Pick a length for {child.name}</h2><p>KidQ will prepare a parent-reviewed queue that fits this duration. You can edit it before anything is shown to your child.</p><div className={styles.duration}>{[15, 20, 30, 45, 60].map((value) => <button key={value} className={duration === value ? styles.durationSelected : ""} aria-pressed={duration === value} onClick={() => setDuration(value)}>{value}<small>min</small></button>)}</div><div className={styles.modeRow}><span>Time of day</span>{["Auto", "Morning", "Daytime", "Bedtime"].map((mode) => <button key={mode} className={timeMode === mode ? styles.pillSelected : ""} onClick={() => setTimeMode(mode)}>{mode}</button>)}</div><p className={styles.breaks}>◷ {Math.max(0, Math.round(duration / 15) - 1)} mid-session break{Math.round(duration / 15) - 1 === 1 ? "" : "s"} + wind-down · {timeMode === "Auto" ? "KidQ chooses a gentle fit for now" : `${timeMode} content`}</p><div className={styles.preferenceWrap}><button className={styles.preferenceButton} onClick={() => setShowTiming(!showTiming)} aria-expanded={showTiming}><span aria-hidden="true">☷</span> Change content preferences <small>{timeMode}</small></button>{showTiming && <div className={styles.timingPopover}><b>Content timing</b><p>Choose when this queue should feel most at home.</p><div>{["Auto", "Morning", "Daytime", "Bedtime"].map((mode) => <button key={mode} className={timeMode === mode ? styles.pillSelected : ""} onClick={() => { setTimeMode(mode); setShowTiming(false); }}>{mode}</button>)}</div><button className={styles.textLink} onClick={() => setScreen("preferences")}>Edit all preferences →</button></div>}</div><Button onClick={getRecommendations}>Get recommendations →</Button></div></section>
</>; }

function Profile({ name, setName, nickname, setNickname, ageBand, setAgeBand, next, disabled, back }: { name: string; setName: (v: string) => void; nickname: string; setNickname: (v: string) => void; ageBand: string; setAgeBand: (v: string) => void; next: () => void; disabled: boolean; back: () => void }) { return <div className={styles.flow}><Header title="Let&apos;s set up your family" sub="Just two things per child — everything else is optional." back={back} /><label>Your name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Parent's name" /></label><label>Child nickname<input value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="Child's nickname" /></label><div><b>Age band</b><div className={styles.pills}>{["0–2", "2–3", "3–4", "4–5", "5–6"].map((age) => <button key={age} className={age === ageBand ? styles.pillSelected : ""} onClick={() => setAgeBand(age)}>{age}</button>)}</div></div><Button disabled={disabled} onClick={next}>Continue</Button><p className={styles.fine}>Your family&apos;s viewing data stays inside KidQ&apos;s own analytics system. It is not sold or shared outside KidQ.</p></div>; }
function AddChild({ nickname, setNickname, ageBand, setAgeBand, next, disabled, error, back }: { nickname: string; setNickname: (v: string) => void; ageBand: string; setAgeBand: (v: string) => void; next: () => void; disabled: boolean; error: string | null; back: () => void }) { return <div className={styles.flow}><Header title="Add another child" sub="Add a child profile to this family." back={back} /><label>Child nickname<input value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="Child's nickname" /></label><div><b>Age band</b><div className={styles.pills}>{["0–2", "2–3", "3–4", "4–5", "5–6"].map((age) => <button key={age} className={age === ageBand ? styles.pillSelected : ""} onClick={() => setAgeBand(age)}>{age}</button>)}</div></div>{error && <p className={styles.error}>{error}</p>}<Button disabled={disabled} onClick={next}>Add child</Button></div>; }
function Confirmation({ child, start, customize, browse, back }: { child: Child; start: () => void; customize: () => void; browse: () => void; back: () => void }) { return <div className={styles.flow}><Header title={`Made for ${child.name}`} sub="Your family is ready. Choose how you want to begin." back={back} /><div className={styles.choiceGrid}><button onClick={start}><b>Start using KidQ</b><span>Use sensible defaults and start a session.</span></button><button onClick={customize}><b>Customize first</b><span>Set interests, goals, duration, and breaks.</span></button><button onClick={browse}><b>Browse and pick myself</b><span>Choose from reviewed recommendations.</span></button></div></div>; }
function Preferences({ child, next, back, setScreen }: { child: Child; next: () => void; back: () => void; setScreen: (screen: Screen) => void }) { const items: [string, Screen][] = [["Interests", "interests"], ["Content mix", "content"], ["Regulation goal", "regulation"], ["Screen time & breaks", "screentime"], ["Talk or type", "voice"], ["Guided questions", "guided"]]; return <div className={styles.flow}><Header title={`Customize for ${child.name}`} sub="Choose what feels right for your family." back={back} /><div className={styles.preferenceGrid}>{items.map(([item, target]) => <button key={item} onClick={() => setScreen(target)}><b>{item}</b><span>Tap to choose preferences →</span></button>)}</div><Button onClick={next}>Save preferences</Button></div>; }
function PreferenceStep({ title, sub, options, next, back }: { title: string; sub: string; options: string[]; next: () => void; back: () => void }) { const [selected, setSelected] = useState(options[0]); return <div className={styles.flow}><Header title={title} sub={sub} back={back} /><div className={styles.optionList}>{options.map((option) => <button key={option} className={selected === option ? styles.optionSelected : ""} onClick={() => setSelected(option)}><span>{selected === option ? "✓" : "○"}</span>{option}</button>)}</div><Button onClick={next}>Save & back</Button></div>; }
function Recommendation({ child, duration, items, selected, toggle, next, addContent, edit, back }: { child: Child; duration: number; items: ParentRecommendation[]; selected: string[]; toggle: (id: string) => void; next: () => void; addContent: () => void; edit: () => void; back: () => void }) {
  const [preview, setPreview] = useState<ParentRecommendation | null>(null);
  const total = items.filter((item) => selected.includes(item.id)).reduce((sum, item) => sum + item.duration, 0);
  return <div className={styles.flowWide}><Header title={`Recommended for ${child.name}`} sub={`Based on their interests, age and the ${duration}-minute screen time you selected.`} back={back} /><div className={styles.reviewLayout}><div className={styles.recGrid}>{items.map((item) => <div className={`${styles.recCard} ${selected.includes(item.id) ? styles.recSelected : ""}`} key={item.id} onClick={() => toggle(item.id)} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") toggle(item.id); }}><div style={item.thumbnailUrl ? { aspectRatio: "16 / 9", height: "auto", backgroundImage: `url(${item.thumbnailUrl})`, backgroundSize: "contain", backgroundRepeat: "no-repeat", backgroundPosition: "center", backgroundColor: "#f6e6c9" } : { aspectRatio: "16 / 9", height: "auto" }} aria-label={item.thumbnailUrl ? `${item.title} thumbnail` : undefined} /><b>{selected.includes(item.id) ? "✓ " : "○ "}{item.title}</b><small>{item.duration} min · {item.category} · age {item.ageRange}</small><span>{item.reason}</span><em>{item.guardrails.join(" · ")}</em><button className={styles.textLink} onClick={(event) => { event.stopPropagation(); setPreview(item); }}>Preview content</button></div>)}</div><aside className={styles.summary}><div className={styles.eyebrow}>Your Q</div><strong>Screen time: {duration} min</strong><strong>Current Q: {total} min</strong><p>Current Q is every reviewed item selected below, not just this session — it can run longer than your chosen screen time. Trim it in Edit playlist.</p><p>{selected.length} items selected. The remaining time allows for transitions and breaks.</p><button onClick={addContent}>＋ Add content</button><button onClick={edit}>✎ Edit playlist</button><Button disabled={!selected.length} onClick={next}>Continue with these recommendations</Button></aside></div>{preview && <div role="dialog" aria-modal="true" aria-label={`${preview.title} preview`} style={{ position: "fixed", inset: 0, zIndex: 20, display: "grid", placeItems: "center", padding: 24, background: "rgba(46,36,24,.55)" }}><div className={styles.info} style={{ width: "min(720px, 100%)", maxHeight: "90vh", overflow: "auto" }}><Header title={preview.title} sub={`Parent preview · age ${preview.ageRange}`} /><div style={{ aspectRatio: "16 / 9", background: "#2e2a5c", borderRadius: 16, overflow: "hidden" }}>{preview.previewUrl ? <iframe title={`${preview.title} preview`} src={preview.previewUrl} style={{ width: "100%", height: "100%", border: 0 }} allow="autoplay; encrypted-media; picture-in-picture" /> : <div style={{ height: "100%", display: "grid", placeItems: "center", color: "white", padding: 24, textAlign: "center" }}>Preview is not available for this item yet.</div>}</div><Button secondary onClick={() => setPreview(null)}>Close preview</Button></div></div>}</div>;
}

function Playlist({ duration, items, remove, move, addContent, confirm, back }: { duration: number; items: ParentRecommendation[]; remove: (id: string) => void; move: (id: string, direction: number) => void; addContent: () => void; confirm: () => void; back: () => void }) { const total = items.reduce((sum, item) => sum + item.duration, 0); return <div className={styles.flow}><Header title="Your Q" sub="Reorder or remove content before you confirm." back={back} /><div className={styles.playlistTotal}>Screen time selected: {duration} min<br /><strong>Current Q: {total} min</strong>{total > duration && <span>Your current Q is {total - duration} minutes above the selected screen time.</span>}</div>{items.length ? items.map((item, index) => <div className={styles.playlistRow} key={item.id}><b>{index + 1}</b><div><strong>{item.title}</strong><small>{item.duration} min · {item.category}</small></div><div className={styles.rowActions}><button onClick={() => move(item.id, -1)} disabled={index === 0} aria-label={`Move ${item.title} up`}>↑</button><button onClick={() => move(item.id, 1)} disabled={index === items.length - 1} aria-label={`Move ${item.title} down`}>↓</button><button onClick={() => remove(item.id)} aria-label={`Remove ${item.title}`}>Remove</button></div></div>) : <div className={styles.emptyQueue}>Your Q is empty. Add approved content or return to recommendations.</div>}<button className={styles.textLink} onClick={addContent}>＋ Add content</button><Button onClick={confirm} disabled={!items.length}>Confirm Q</Button></div>; }

function AddContent({ add, back }: { add: (item: ParentRecommendation) => void; back: () => void }) { const [mode, setMode] = useState<"options" | "url" | "pdf">("options"); const [url, setUrl] = useState(""); const [status, setStatus] = useState<"idle" | "loading" | "result" | "error">("idle"); const [score, setScore] = useState(88); const [pdfReady, setPdfReady] = useState(false); const [selectedPdf, setSelectedPdf] = useState([true, false]); const urlItem: ParentRecommendation = { id: `url-${url.trim() || "new"}`, title: "Family URL: Garden Discoveries", duration: 6, category: "Nature", ageRange: "3–8", reason: "Added by this parent after KidQ scoring", guardrails: score >= 70 ? ["Good fit", "Low stimulation"] : ["PRIVATE CONTENT", "Needs parent review"] }; const pdfItems: ParentRecommendation[] = [{ id: "pdf-a", title: "Teacher story time", duration: 7, category: "School", ageRange: "3–8", reason: "Extracted from uploaded PDF", guardrails: ["Scored", "Parent review"] }, { id: "pdf-b", title: "Counting practice", duration: 5, category: "School", ageRange: "3–8", reason: "Extracted from uploaded PDF", guardrails: ["Scored", "Parent review"] }]; const validateUrl = () => { if (!/^https?:\/\//.test(url)) { setStatus("error"); return; } setStatus("loading"); setTimeout(() => { setScore(/unsafe|loud|fast/i.test(url) ? 42 : 88); setStatus("result"); }, 450); }; return <div className={styles.flow}><Header title="Add content" sub="Review content before it can enter your child&apos;s Q." back={back} /><div className={styles.importTabs}><button className={mode === "url" ? styles.pillSelected : ""} onClick={() => setMode("url")}>Add URL</button><button className={mode === "pdf" ? styles.pillSelected : ""} onClick={() => setMode("pdf")}>Upload PDF</button><button className={mode === "options" ? styles.pillSelected : ""} onClick={() => setMode("options")}>Approved content</button></div>{mode === "options" && <><div className={styles.info}>Parent-only discovery. Unrestricted browsing is never exposed to the child experience.</div><div className={styles.listRow}><span>🌿</span><div><b>Garden Discoveries</b><small>6 min · Nature · KidQ reviewed</small></div><button onClick={() => add({ ...urlItem, id: `approved-${Date.now()}`, title: "Garden Discoveries", reason: "Picked from KidQ-approved content" })}>Add</button></div><div className={styles.listRow}><span>📚</span><div><b>Saved family content</b><small>Choose from your previously approved videos</small></div><button onClick={() => add({ ...urlItem, id: `saved-${Date.now()}`, title: "Saved family story" })}>Add</button></div></>}{mode === "url" && <><label>Paste a supported video URL<input className={styles.search} value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://youtube.com/watch?v=..." /></label>{status === "error" && <div className={styles.error}>That URL is not supported. Check it and try again.</div>}{status === "loading" && <div className={styles.info}>Fetching metadata and running KidQ content scoring…</div>}{status === "result" && <div className={styles.scoreCard}><b>KidQ content score: {score}/100</b><p>{score >= 70 ? "Good fit. This can be added privately and marked public_candidate for moderation." : "This content does not meet KidQ&apos;s recommended content criteria. Do you still want to add it for your child?"}</p><small>{score >= 70 ? "Low stimulation · age-appropriate language · suitable pacing" : "Fast pacing or sound intensity needs parent review. Add Anyway keeps it private."}</small><div className={styles.actionRow}><button onClick={() => setStatus("idle")}>Cancel</button><button onClick={() => add(urlItem)}>{score >= 70 ? "Add to Q" : "Add Anyway (private)"}</button></div></div>}{(status === "idle" || status === "error") && <Button onClick={validateUrl}>Validate and score URL</Button>}</>}{mode === "pdf" && <><label className={styles.uploadBox}>Upload a school PDF<input type="file" accept="application/pdf" onChange={() => setPdfReady(true)} /></label>{pdfReady ? <><div className={styles.info}>2 supported URLs found. Each item was scored separately; choose what enters the Q.</div>{pdfItems.map((item, index) => <label className={styles.pdfRow} key={item.id}><input type="checkbox" checked={selectedPdf[index]} onChange={() => setSelectedPdf((items) => items.map((value, i) => i === index ? !value : value))} /><span><b>{item.title}</b><small>{item.duration} min · score ready · {item.guardrails.join(" · ")}</small></span></label>)}<Button onClick={() => pdfItems.forEach((item, index) => selectedPdf[index] && add(item))}>Add selected to Q</Button></> : <div className={styles.fine}>PDF parsing will extract supported links and continue if one URL fails.</div>}</>}</div>; }

function PlanReady({ child, duration, items, viewKid, done }: { child: Child; duration: number; items: ParentRecommendation[]; viewKid: () => void; done: () => void }) { const total = items.reduce((sum, item) => sum + item.duration, 0); return <div className={styles.flow}><div className={styles.successIcon}>✓</div><Header title="Your Screen Time Plan is Ready" sub={`${child.name}'s approved queue is ready for the next Kid session.`} /><div className={styles.info}><b>{duration} minutes selected</b><p>{items.length} content items · {total} minutes planned</p><small>Breaks and transitions are kept separate from the content total.</small></div><Button secondary onClick={viewKid}>View child queue</Button><Button onClick={done}>Done</Button></div>; }
function Preview({ child, items, next, back }: { child: Child; items: ParentRecommendation[]; next: () => void; back: () => void }) { return <div className={`${styles.flow} ${styles.preview}`}><Header title={`This is what ${child.name} sees`} sub="No settings icons, no text-heavy menus — just big, friendly taps." back={back} />{items.map((item) => <div className={styles.previewItem} key={item.id}><span style={item.thumbnailUrl ? { width: 120, height: 68, flex: "0 0 120px", backgroundImage: `url(${item.thumbnailUrl})`, backgroundSize: "contain", backgroundRepeat: "no-repeat", backgroundPosition: "center", backgroundColor: "#ffc64d" } : { width: 120, height: 68, flex: "0 0 120px" }} aria-label={item.thumbnailUrl ? `${item.title} thumbnail` : undefined}>☀</span><b>{item.title}</b></div>)}{items.length === 0 && <p className={styles.fine}>No content has been added to this Q yet.</p>}<Button onClick={next}>All set — go to Start a session</Button></div>; }
function Session({ child, duration, done, back }: { child: Child; duration: number; done: () => void; back: () => void }) { return <div className={styles.flow}><Header title={`Session ready for ${child.name}`} sub={`${duration} minutes · device handoff`} back={back} /><div className={styles.handoff}><span>☀</span><div><b>Hand the device to {child.name}</b><p>KidQ will play the finite, parent-picked queue and finish with a gentle wind-down.</p></div></div><Button onClick={done}>Simulate session complete</Button><p className={styles.fine}>In production this screen is reached when the parent hands over the device.</p></div>; }
function Complete({ child, done, details }: { child: Child; done: () => void; details: () => void }) { return <div className={styles.flow}><div className={styles.complete}>🔔<Header title="All done for now" sub={`${child.name}'s session is complete.`} /></div><div className={styles.info}><b>What {child.name} watched</b><p>The Bunny Wakes Up · Stories</p><p>Counting With Friends · Maths</p><small>Outcome: Completed — no early exits.</small></div><Button secondary onClick={details}>View details</Button><Button onClick={done}>Done</Button></div>; }
function Details({ child, library, back }: { child: Child; library: { id: string; title: string }[]; back: () => void }) { return <div className={styles.flow}><Header title={`${child.name}'s session log`} sub="Factual — what played, nothing about mood or attention." back={back} />{library.length === 0 && <p className={styles.fine}>No sessions in this log yet.</p>}{library.map((item) => <div className={styles.listRow} key={item.id}><span>🎬</span><div><b>{item.title}</b><small>Approved catalog · 7 min</small></div><span>👍</span></div>)}<p className={styles.fine}>Want to stop a video from being suggested again? Manage that from My videos.</p></div>; }
const RANGE_TO_PERIOD: Record<string, Period> = { day: "today", week: "7d", month: "30d" };

function Insights({ child, active, children, range, setRange, chooseChild }: { child: Child; active: number; children: Child[]; range: string; setRange: (v: string) => void; chooseChild: (i: number) => void }) {
  const [analytics, setAnalytics] = useState<ParentAnalytics | null>(null);

  useEffect(() => {
    let cancelled = false;
    getParentAnalytics(child.id, RANGE_TO_PERIOD[range] ?? "7d")
      .then((result) => { if (!cancelled) setAnalytics(result); })
      .catch(() => { if (!cancelled) setAnalytics(null); });
    return () => { cancelled = true; };
  }, [child.id, range]);

  const screenMinutes = analytics?.overview.screen_minutes ?? 0;
  const completedPercent = analytics && analytics.completion.started > 0
    ? Math.round((analytics.completion.completed / analytics.completion.started) * 100)
    : 0;
  const categories = analytics?.categories.slice(0, 4) ?? [];

  return <div className={styles.flow}><Header title="Insights" sub={`Viewing ${child.name}'s data — one child at a time.`} /><div className={styles.children}>{children.map((item, index) => <button key={item.name} className={index === active ? styles.selected : ""} onClick={() => chooseChild(index)}>{item.name}</button>)}</div><div className={styles.pills}>{["day", "week", "month"].map((item) => <button key={item} className={range === item ? styles.pillSelected : ""} onClick={() => setRange(item)}>{item}</button>)}</div><div className={styles.metrics}><div><small>Total screen time</small><b>{screenMinutes}m</b></div><div><small>Completed</small><b>{completedPercent}%</b></div></div>{analytics && !analytics.has_data && <p className={styles.fine}>No sessions in this range yet.</p>}{categories.map((category) => <div className={styles.bar} key={category.key}><span>{category.label}</span><i><b style={{ width: `${category.percent}%` }} /></i><small>{category.minutes}</small></div>)}<p className={styles.privacy}>Your family&apos;s viewing data stays inside KidQ&apos;s own analytics system. We do not sell it or share it outside KidQ.</p></div>;
}
function Library({ child, children, library, remove, add }: { child: Child; children: Child[]; library: { id: string; title: string }[]; remove: (id: string) => void; add: () => void }) { return <div className={styles.flow}><Header title="My Videos" sub="Everything your family can watch, from every source." />{library.length === 0 && <p className={styles.fine}>No videos yet — add one below.</p>}{library.map((item) => <div className={styles.listRow} key={item.id}><span>🎬</span><div><b>{item.title}</b><small>Picked by your family · show for {child.name} and {children.length > 1 ? children[1].name : "your family"}</small></div><button onClick={() => remove(item.id)}>Remove</button></div>)}<Button onClick={add}>＋ Add a video</Button></div>; }
function AddVideo({ value, setValue, back, save }: { value: string; setValue: (v: string) => void; back: () => void; save: () => void }) { return <div className={styles.flow}><Header title="Add a video" sub="Paste a YouTube link — it is usable by your family right away." back={back} /><label>Video URL<input value={value} onChange={(event) => setValue(event.target.value)} placeholder="https://youtube.com/watch?v=..." /></label><div className={styles.videoReview}><span>🎬</span><div><b>{value ? "Video metadata ready" : "Review details after pasting"}</b><small>Title · duration · channel · category</small></div><em>Private to your family</em></div><Button onClick={save}>Add content privately</Button></div>; }
const BREAK_TYPE_ORDER: NonNullable<CurationSettings["break_type"]>[] = ["MOVEMENT", "QUIET", "ALTERNATE"];
const BREAK_TYPE_LABELS: Record<string, string> = { MOVEMENT: "Movement", QUIET: "Quiet-calm", ALTERNATE: "Let KidQ alternate" };

function Settings({ child, openPreferences, addChild }: { child: Child; openPreferences: () => void; addChild: () => void }) {
  const [breakType, setBreakType] = useState<NonNullable<CurationSettings["break_type"]>>("ALTERNATE");
  const [local, setLocal] = useState<LocalPreferences>(() => getLocalPreferences(child.id));

  useEffect(() => {
    getCurationSettings(child.id).then((settings) => { if (settings.break_type) setBreakType(settings.break_type); }).catch(() => undefined);
    setLocal(getLocalPreferences(child.id));
  }, [child.id]);

  function cycleBreakType() {
    const next = BREAK_TYPE_ORDER[(BREAK_TYPE_ORDER.indexOf(breakType) + 1) % BREAK_TYPE_ORDER.length];
    setBreakType(next);
    saveCurationSettings(child.id, { break_type: next }).catch(() => undefined);
  }

  function toggleLocal(key: "autoplay" | "sensoryMode") {
    const next = { ...local, [key]: !local[key] };
    setLocal(next);
    saveLocalPreferences(child.id, next);
  }

  function toggleSchedule() {
    const next = { ...local, dailySchedule: { ...local.dailySchedule, enabled: !local.dailySchedule.enabled } };
    setLocal(next);
    saveLocalPreferences(child.id, next);
  }

  return <div className={styles.flow}>
    <Header title="Settings" sub={`Rarely-changed defaults for ${child.name}.`} />
    <button className={styles.settingRow} onClick={openPreferences}><b>Content & curation preferences</b><span>Interests, content mix, regulation goals →</span></button>
    <button className={styles.settingRow} onClick={addChild}><b>Add another child</b><span>Add a child profile to this family →</span></button>
    <button className={styles.settingRow} onClick={() => toggleLocal("autoplay")}><b>Autoplay next video</b><span>{local.autoplay ? "On" : "Off"} · Tap to change</span></button>
    <button className={styles.settingRow} onClick={cycleBreakType}><b>Break type</b><span>{BREAK_TYPE_LABELS[breakType]} · Tap to change</span></button>
    <button className={styles.settingRow} onClick={() => toggleLocal("sensoryMode")}><b>Sensory-friendly mode</b><span>{local.sensoryMode ? "On" : "Off"} · Tap to change</span></button>
    <button className={styles.settingRow} onClick={toggleSchedule}><b>Daily schedule</b><span>{local.dailySchedule.enabled ? "On" : "Off"} · Tap to change</span></button>
  </div>;
}
