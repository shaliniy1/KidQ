"use client";

import { useState } from "react";
import styles from "./KidQApp.module.css";

type Screen =
  | "launch" | "login" | "consent" | "profile" | "confirm" | "hub"
  | "interests" | "mix" | "regulation" | "time" | "voice" | "guided"
  | "recommendations" | "preview" | "session" | "complete" | "log"
  | "insights" | "videos" | "add-video" | "submitted" | "settings" | "child";

type Child = { name: string; age: string; color: string; duration: number };

const colors = { teal: "#008080", saffron: "#FF8C00", terracotta: "#D9534F", mango: "#FFC107", lavender: "#7C6BC4" };
const categories = ["Animation", "Stories", "Storybooks", "Crafts", "Painting", "Science", "Maths", "Yoga", "Activities", "Educational", "Music/Rhymes", "Knowledge/General Learning"];
const interests = ["Animals", "Vehicles", "Music & rhymes", "Art & craft", "Space & science", "Numbers", "Stories", "Festivals & culture", "Sports", "Nature"];
const goals = ["Help them calm down", "Manage big feelings", "Build focus", "Burn off energy", "Wind down before bed", "Play nicely with others"];
const demoLibrary = [
  ["Counting With Friends", "Maths", "#FFF3D6"],
  ["Bedtime Lullabies", "Music/Rhymes", "#F1EAFB"],
  ["Why Do Birds Fly?", "Science", "#DCEEF7"],
  ["The Kind Little Fox", "Stories", "#E9F5F5"],
] as const;

function Back({ onClick }: { onClick: () => void }) {
  return <button className={styles.back} onClick={onClick} aria-label="Back">‹</button>;
}

function Button({ children, secondary = false, disabled = false, onClick }: { children: React.ReactNode; secondary?: boolean; disabled?: boolean; onClick: () => void }) {
  return <button className={secondary ? styles.secondary : styles.primary} disabled={disabled} onClick={onClick}>{children}</button>;
}

function ChildSwitcher({ children, active, setActive }: { children: Child[]; active: number; setActive: (index: number) => void }) {
  return <div className={styles.childSwitcher}>{children.map((child, index) => <button key={child.name} className={index === active ? styles.activeChild : styles.dimChild} onClick={() => setActive(index)}><span style={{ background: colors[child.color as keyof typeof colors] }}>{child.name[0]}</span><small>{child.name}</small></button>)}</div>;
}

export default function KidQApp() {
  const [screen, setScreen] = useState<Screen>("launch");
  const [path, setPath] = useState<"first" | "returning">("first");
  const [parentName, setParentName] = useState("Priya");
  const [childName, setChildName] = useState("Aarav");
  const [age, setAge] = useState("3-4");
  const [duration, setDuration] = useState(30);
  const [activeChild, setActiveChild] = useState(0);
  const [consent, setConsent] = useState(false);
  const [interestSet, setInterestSet] = useState<string[]>([]);
  const [categorySet, setCategorySet] = useState<string[]>([]);
  const [goalSet, setGoalSet] = useState<string[]>(goals);
  const [contentMode, setContentMode] = useState<"surprise" | "choose">("surprise");
  const [newUrl, setNewUrl] = useState("");
  const [children, setChildren] = useState<Child[]>([
    { name: "Aarav", age: "3-4", color: "teal", duration: 30 },
    { name: "Isha", age: "2-3", color: "terracotta", duration: 45 },
  ]);

  const current = children[activeChild];
  const breaks = Math.max(1, Math.round(duration / 15));
  const setChildDuration = (value: number) => {
    setDuration(value);
    setChildren((items) => items.map((child, index) => index === activeChild ? { ...child, duration: value } : child));
  };
  const toggle = (value: string, values: string[], setValues: (next: string[]) => void) => setValues(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  const nav = (next: Screen) => setScreen(next);

  const title = ({ launch: "Choose a journey", login: "Welcome to KidQ", consent: "A quick word on privacy", profile: "Let's get to know your family", confirm: `Made for ${childName}`, hub: `Customize for ${childName}`, recommendations: `Made for ${childName}`, preview: `This is what ${childName} sees`, session: "Start a session", complete: "All done for now", log: `${current.name}'s session log`, insights: "Insights", videos: "My Videos", settings: "Settings", child: "Child view" } as Partial<Record<Screen, string>>)[screen] ?? "KidQ";

  if (screen === "child") return <ChildView child={current} onExit={() => nav("session")} />;

  return <main className={styles.studio}>
    <div className={styles.appShell}>
      <header className={styles.masthead}><span>KidQ · Parent Flow</span><h1>{title}</h1><p>Screen time that ends well — thoughtfully chosen stories, activities, and gentle learning.</p></header>
      <div className={styles.layout}>
        <aside className={styles.rail} aria-label="Prototype navigation">
          <p>Explore the flow</p>
          {([["launch", "Choose a journey"], ["login", "Login"], ["consent", "Privacy consent"], ["profile", "Child profile"], ["confirm", "Default confirmation"], ["hub", "Customize hub"], ["recommendations", "Recommendations"], ["preview", "Kid preview"], ["child", "Child view"], ["session", "Start a session"], ["complete", "Session complete"], ["log", "Session log"], ["insights", "Insights"], ["videos", "My Videos"], ["settings", "Settings"]] as [Screen, string][]).map(([id, label]) => <button key={id} className={screen === id ? styles.railActive : ""} onClick={() => nav(id)}>{label}</button>)}
          <a href="/analytics">Open production analytics ↗</a>
        </aside>
        <section className={styles.stage}><div className={styles.phone}><div className={styles.notch} />
          {screen === "launch" && <ScreenWrap center><div className={styles.logo}>Q</div><h2>Choose a journey</h2><p>This launcher is review chrome; the product starts at Login.</p><Button onClick={() => { setPath("first"); nav("login"); }}>First-time parent</Button><Button secondary onClick={() => { setPath("returning"); nav("login"); }}>Returning parent</Button></ScreenWrap>}
          {screen === "login" && <ScreenWrap center><div className={styles.logo}>Q</div><h2>Welcome to KidQ</h2><p>Sign in to continue.</p><Button secondary onClick={() => nav(path === "first" ? "consent" : "session")}>◉ &nbsp; Continue with Google</Button><small>One Google account per family — every caregiver signs in with this same account.</small></ScreenWrap>}
          {screen === "consent" && <ScreenWrap><Top back={() => nav("login")} label="Before you begin" /><h2>A quick word on privacy</h2><p>KidQ only ever collects a nickname and an age band for your child — never a full name, photo, or location.</p><div className={styles.card}>By continuing you confirm you are this child&apos;s parent or guardian and consent to KidQ storing the minimal profile data needed to run age-appropriate sessions.</div><label className={styles.check}><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> I&apos;m a parent or guardian and I agree.</label><Spacer /><Button disabled={!consent} onClick={() => nav("profile")}>Continue</Button></ScreenWrap>}
          {screen === "profile" && <ScreenWrap><Top back={() => nav("consent")} label="Your family" /><h2>Let&apos;s get to know your family</h2><p>Only two things are needed to get started. You can personalize the rest later.</p><label>Parent name<input value={parentName} onChange={(e) => setParentName(e.target.value)} /></label><label>Child&apos;s nickname<input value={childName} onChange={(e) => setChildName(e.target.value)} /></label><label>Age band<select value={age} onChange={(e) => setAge(e.target.value)}>{["0-2", "2-3", "3-4", "4-5", "5-6"].map((value) => <option key={value}>{value}</option>)}</select></label><Spacer /><Button onClick={() => { setChildren((items) => [{ name: childName || "Aarav", age, color: "teal", duration: 30 }, ...items.slice(1)]); nav("confirm"); }}>Set up KidQ</Button></ScreenWrap>}
          {screen === "confirm" && <ScreenWrap><Top back={() => nav("profile")} label={`Made for ${childName}`} /><h2>We&apos;ve set up {childName}&apos;s KidQ using just their age.</h2><p>Start right away, or fine-tune it below.</p><div className={styles.card}><b>Age-appropriate mix</b><small>Regulation goals · Screen time & breaks · Safety-reviewed library</small></div><Spacer /><Button onClick={() => nav("session")}>Start using KidQ</Button><Button secondary onClick={() => nav("hub")}>Customize for {childName}</Button><button className={styles.link} onClick={() => nav("recommendations")}>Browse and pick myself</button></ScreenWrap>}
          {screen === "hub" && <ScreenWrap><Top back={() => nav("confirm")} label={`Customize for ${childName}`} /><p>Everything already has a sensible default. Tap anything you&apos;d like to change.</p><div className={styles.rows}><Row icon="♥" title="Interests" value={interestSet.length ? `${interestSet.length} selected` : "None selected"} onClick={() => nav("interests")} /><Row icon="▦" title="Content mix" value={contentMode === "surprise" ? "Surprise us" : `${categorySet.length} categories`} onClick={() => nav("mix")} /><Row icon="☼" title="Regulation goal" value={`${goalSet.length} selected`} onClick={() => nav("regulation")} /><Row icon="◷" title="Screen time & breaks" value={`${duration} min · ${breaks - 1} break${breaks - 1 === 1 ? "" : "s"} + wind-down`} onClick={() => nav("time")} /></div><div className={styles.shortcutRow}><button onClick={() => nav("voice")}>🎙 Talk or type</button><button onClick={() => nav("guided")}>☷ Guided questions</button></div><Spacer /><Button onClick={() => nav("session")}>Done — start using KidQ</Button></ScreenWrap>}
          {screen === "interests" && <ChoiceScreen title="What does your child love?" sub="Optional — pick as many as you like." values={interests} selected={interestSet} toggle={(value) => toggle(value, interestSet, setInterestSet)} back={() => nav("hub")} done={() => nav("hub")} />}
          {screen === "mix" && <ScreenWrap><Top back={() => nav("hub")} label="Content mix" /><p>Keep it simple, or choose your own categories.</p><button className={contentMode === "surprise" ? styles.selectedCard : styles.card} onClick={() => setContentMode("surprise")}><b>Surprise us</b><small>A good age-appropriate mix, chosen for you.</small></button><button className={contentMode === "choose" ? styles.selectedCard : styles.card} onClick={() => setContentMode("choose")}><b>Let me choose categories</b><small>Pick from KidQ&apos;s approved categories.</small></button>{contentMode === "choose" && <div className={styles.chips}>{categories.map((value) => <Chip key={value} label={value} selected={categorySet.includes(value)} onClick={() => toggle(value, categorySet, setCategorySet)} />)}</div>}<Spacer /><Button onClick={() => nav("hub")}>Save & back</Button></ScreenWrap>}
          {screen === "regulation" && <ChoiceScreen title="What would help right now?" sub="Optional — leave everything selected if you are not sure." values={goals} selected={goalSet} toggle={(value) => toggle(value, goalSet, setGoalSet)} back={() => nav("hub")} done={() => nav("hub")} />}
          {screen === "time" && <ScreenWrap><Top back={() => nav("hub")} label="Screen time & breaks" /><p>Pick a session length. Breaks are worked out for you.</p><div className={styles.chips}>{[15, 30, 45, 60, 90].map((value) => <Chip key={value} label={`${value} min`} selected={duration === value} onClick={() => setChildDuration(value)} />)}</div><div className={styles.card}><small>In this session</small><b>{duration} min · {Math.max(0, breaks - 1)} mid-session break{breaks - 1 === 1 ? "" : "s"} + wind-down</b><small>The final break is always the wind-down.</small></div><Spacer /><Button onClick={() => nav("hub")}>Save & back</Button></ScreenWrap>}
          {screen === "voice" && <ScreenWrap><Top back={() => nav("hub")} label="Talk or type to KidQ" /><p>Tell us what kind of videos you&apos;re looking for — by voice or by typing.</p><div className={styles.mic}>🎙</div><textarea placeholder="e.g. calming animal stories before bed" /><Spacer /><Button onClick={() => nav("hub")}>Fill the Hub</Button><small>Voice-to-tag NLU fills the existing Hub fields; there is no separate review screen.</small></ScreenWrap>}
          {screen === "guided" && <ScreenWrap><Top back={() => nav("hub")} label="A couple of quick questions" /><p>Tap an answer for each — takes about 10 seconds.</p><b>What does {childName} enjoy more?</b><div className={styles.chips}><Chip label="Stories & imagination" selected={categorySet.includes("Stories")} onClick={() => toggle("Stories", categorySet, setCategorySet)} /><Chip label="Active, physical play" selected={categorySet.includes("Activities")} onClick={() => toggle("Activities", categorySet, setCategorySet)} /></div><b>What matters most right now?</b><div className={styles.chips}>{["Calming down", "Building focus", "Burning energy"].map((value) => <Chip key={value} label={value} selected={false} onClick={() => undefined} />)}</div><Spacer /><Button onClick={() => nav("hub")}>Fill the Hub</Button></ScreenWrap>}
          {screen === "recommendations" && <ScreenWrap><Top back={() => nav("confirm")} label={`Made for ${childName}`} /><p>Ranked by relevance, KidQ Score, and expert review.</p><div className={styles.shelf}>{demoLibrary.map(([name, category, color]) => <article className={styles.miniCard} key={name}><span style={{ background: color }} /><b>{name}</b><small>{category} · Reviewed</small></article>)}</div><Spacer /><Button onClick={() => nav("preview")}>Looks good — continue</Button></ScreenWrap>}
          {screen === "preview" && <ScreenWrap dark><Top back={() => nav("recommendations")} label={`This is what ${childName} sees`} light /><h2>Big, friendly taps.</h2><p>No settings icons, no text-heavy menus — just a finite session that ends well.</p><div className={styles.previewList}>{demoLibrary.slice(0, 3).map(([name, , color]) => <div key={name}><span style={{ background: color }} />{name}</div>)}</div><Spacer /><Button secondary onClick={() => nav("child")}>Open child view</Button><Button onClick={() => nav("session")}>All set — go to Start a Session</Button></ScreenWrap>}
          {screen === "session" && <ScreenWrap><div className={styles.eyebrow}>Welcome back, {parentName}</div><h2>Who&apos;s this session for?</h2><ChildSwitcher children={children} active={activeChild} setActive={(index) => { setActiveChild(index); setDuration(children[index].duration); }} /><h2>Start a session for {current.name}</h2><p>Pick a length — everything else is already set from last time.</p><div className={styles.chips}>{[15, 30, 45, 60, 90].map((value) => <Chip key={value} label={`${value} min`} selected={duration === value} onClick={() => setChildDuration(value)} />)}</div><div className={styles.card}><small>This session</small><b>{Math.max(0, breaks - 1)} mid-session break{breaks - 1 === 1 ? "" : "s"} + wind-down</b><small>Duration can be changed any time. It is remembered for {current.name} only.</small></div><button className={styles.link} onClick={() => nav("hub")}>Change {current.name}&apos;s content preferences</button><Spacer /><Button onClick={() => nav("complete")}>Start — hand over the device</Button><small>Session starts live the moment you tap.</small></ScreenWrap>}
          {screen === "complete" && <ScreenWrap><div className={styles.notification}>🔔 <span><b>Session complete</b><small>{duration} min · completed</small></span></div><h2>All done for now</h2><div className={styles.card}><small>What {current.name} watched</small>{demoLibrary.slice(0, 2).map(([name, category]) => <div className={styles.listLine} key={name}><span>{name}</span><small>{category}</small></div>)}<small>Outcome: Completed — no early exits.</small></div><div className={styles.notice}>🌤 If the approved pool was thin, the session log will say so factually.</div><Button secondary onClick={() => nav("log")}>View details</Button><Button onClick={() => nav("session")}>Done</Button></ScreenWrap>}
          {screen === "log" && <ScreenWrap><Top back={() => nav("complete")} label={`${current.name}'s session log`} /><p>Factual — what played, nothing about mood or attention.</p>{demoLibrary.map(([name, category, color]) => <div className={styles.logRow} key={name}><span style={{ background: color }} /><div><b>{name}</b><small>{category} · 7 min</small></div><span>👍 👎</span></div>)}<Spacer /><Button onClick={() => nav("session")}>Back to home</Button></ScreenWrap>}
          {screen === "insights" && <ScreenWrap><h2>Insights</h2><ChildSwitcher children={children} active={activeChild} setActive={setActiveChild} /><p>Viewing {current.name}&apos;s data — analytics are always one child at a time.</p><div className={styles.chips}>{["Day", "Week", "Month"].map((value) => <Chip key={value} label={value} selected={value === "Week"} onClick={() => undefined} />)}</div><div className={styles.stats}><div className={styles.card}><small>Total screen time</small><b>231m</b></div><div className={styles.card}><small>Completed</small><b className={styles.tealText}>91%</b></div></div><div className={styles.card}><small>Time by category (min)</small>{[["Stories", 72], ["Maths", 48], ["Science", 31], ["Music/Rhymes", 20]].map(([label, value]) => <div className={styles.meter} key={label as string}><span>{label}</span><i><em style={{ width: `${Number(value)}%` }} /></i><b>{value}</b></div>)}</div><small>Factual only — no inference about mood or preference.</small></ScreenWrap>}
          {screen === "videos" && <ScreenWrap><h2>My Videos</h2><p>Everything your family can watch, from every source.</p>{demoLibrary.map(([name, category, color]) => <div className={styles.videoRow} key={name}><span style={{ background: color }} /><div><b>{name}</b><small>{category} · KidQ reviewed</small></div><button onClick={() => undefined}>✕</button></div>)}<Spacer /><Button onClick={() => nav("add-video")}>＋ Add a video</Button></ScreenWrap>}
          {screen === "add-video" && <ScreenWrap><Top back={() => nav("videos")} label="Add a video" /><p>Paste a YouTube link — it&apos;s usable by your family right away.</p><input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." /><div className={styles.card}><b>Also suggest this to other families</b><small>Sends it to Admin for review — your own access never changes.</small></div><Spacer /><Button onClick={() => nav("submitted")}>Add video</Button></ScreenWrap>}
          {screen === "submitted" && <ScreenWrap center><div className={styles.bigEmoji}>🎉</div><h2>Thank you for the recommendation</h2><p>Your video is in the review path and remains available to your family.</p><Spacer /><Button onClick={() => nav("videos")}>Done</Button></ScreenWrap>}
          {screen === "settings" && <ScreenWrap><h2>Settings</h2><p>Rarely-changed defaults for {current.name}.</p><div className={styles.rows}><Row icon="🎛" title="Content & curation preferences" value="Interests, mix, goals, screen time" onClick={() => nav("hub")} /><Row icon="▶" title="Autoplay next video" value="Default: on" /><Row icon="☼" title="Break type" value="Let KidQ alternate" /><Row icon="◌" title="Sensory-friendly mode" value="Default: off" /><Row icon="◷" title="Daily schedule" value="Default: off" /></div><Spacer /><Button onClick={() => nav("session")}>Save</Button></ScreenWrap>}
        </div><nav className={styles.tabs}><button onClick={() => nav("session")}>▶<small>Session</small></button><button onClick={() => nav("insights")}>▥<small>Insights</small></button><button onClick={() => nav("videos")}>▣<small>My Videos</small></button><button onClick={() => nav("settings")}>⚙<small>Settings</small></button></nav></section>
      </div>
    </div>
  </main>;
}

function ScreenWrap({ children, center = false, dark = false }: { children: React.ReactNode; center?: boolean; dark?: boolean }) { return <div className={`${styles.screen} ${center ? styles.center : ""} ${dark ? styles.dark : ""}`}>{children}</div>; }
function Top({ back, label, light = false }: { back: () => void; label: string; light?: boolean }) { return <div className={`${styles.top} ${light ? styles.light : ""}`}><Back onClick={back} /><b>{label}</b></div>; }
function Spacer() { return <div className={styles.spacer} />; }
function Chip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) { return <button className={selected ? styles.chipSelected : styles.chip} onClick={onClick}>{label}</button>; }
function Row({ icon, title, value, onClick = () => undefined }: { icon: string; title: string; value: string; onClick?: () => void }) { return <button className={styles.row} onClick={onClick}><span className={styles.rowIcon}>{icon}</span><span><b>{title}</b><small>{value}</small></span><strong>›</strong></button>; }
function ChoiceScreen({ title, sub, values, selected, toggle, back, done }: { title: string; sub: string; values: string[]; selected: string[]; toggle: (value: string) => void; back: () => void; done: () => void }) { return <ScreenWrap><Top back={back} label={title} /><p>{sub}</p><div className={styles.chips}>{values.map((value) => <Chip key={value} label={value} selected={selected.includes(value)} onClick={() => toggle(value)} />)}</div><Spacer /><Button onClick={done}>Save & back</Button></ScreenWrap>; }

function ChildView({ child, onExit }: { child: Child; onExit: () => void }) { const [watching, setWatching] = useState(false); const [paused, setPaused] = useState(false); return <main className={styles.childWorld}><div className={styles.childTop}><button onClick={onExit}>Parent view</button><span>{child.name}&apos;s watch time</span></div>{!watching ? <div className={styles.sunrise}><div className={styles.sun}>☀</div><h1>Good morning,<br />{child.name}!</h1><p>Tap the sun to start your day</p><button className={styles.sunButton} onClick={() => setWatching(true)}>☀</button><small>♥ Mumma &amp; Papa picked 4 videos · {child.duration} min</small></div> : <div className={styles.watching}><div className={styles.arc}>☼</div><span className={styles.timePill}>{paused ? "Paused" : `${child.duration} min left`}</span><div className={styles.player}><div className={styles.playerArt}>The Bunny Wakes Up</div><button onClick={() => setPaused(!paused)}>{paused ? "▶" : "Ⅱ"}</button></div><h2>The Bunny Wakes Up</h2><p>Picked by Mumma &amp; Papa · 8 min</p><div className={styles.queue}><span>Now playing</span><span>Butterfly in the Meadow</span><span>The End 🌙</span></div></div>}</main>; }
