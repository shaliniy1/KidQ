"use client";

// Parent Analytics: "understand your child's viewing", never "monitor your child". Every number and
// sentence comes from GET /children/:id/analytics (or the marked sample data); nothing is judged here.
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { loadAnalytics, loadChildren, usingSampleData } from "@/services/analytics";
import type { ChildSummary, ParentAnalytics, Period } from "@/types/analytics";
import styles from "./analytics.module.css";

const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "30 Days" },
];
const PERIOD_NAME: Record<Period, string> = { today: "Today", "7d": "Last 7 days", "30d": "Last 30 days" };
const PERIOD_PHRASE: Record<Period, string> = { today: "today", "7d": "this week", "30d": "over the last 30 days" };
const COLORS = ["#e96f51", "#f2be58", "#78b79d", "#83aacf", "#b9a3d6", "#c8a999"];
const WEEKDAY = new Intl.DateTimeFormat("en", { weekday: "short", timeZone: "UTC" });
const DAY_MONTH = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", timeZone: "UTC" });
const asDate = (day: string) => new Date(`${day}T00:00:00Z`);

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return minutes % 60 ? `${hours} h ${minutes % 60} min` : `${hours} h`;
}
function timesWatched(n: number) {
  return n === 1 ? "Watched once" : n === 2 ? "Watched twice" : `Watched ${n} times`;
}
function comparison(vs: ParentAnalytics["overview"]["vs_previous"]) {
  if (!vs) return null;
  if (vs.minutes_diff === 0) return `About the same as ${vs.compared_with}`;
  return `${count(Math.abs(vs.minutes_diff), "minute", "minutes")} ${vs.minutes_diff < 0 ? "less" : "more"} than ${vs.compared_with}`;
}

export default function AnalyticsPage() {
  const [children, setChildren] = useState<ChildSummary[] | null>(null);
  const [childId, setChildId] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("7d");
  const [data, setData] = useState<ParentAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadChildren()
      .then((list) => {
        setChildren(list);
        setChildId(list[0]?.id ?? null);
      })
      .catch(() => setError("We couldn't load your family right now. Please try again in a moment."));
  }, []);

  useEffect(() => {
    if (!childId) return;
    let cancelled = false;
    const run = (showLoading: boolean) => {
      if (showLoading) setData(null);
      loadAnalytics(childId, period)
        .then((result) => !cancelled && setData(result))
        .catch(() => !cancelled && setError("We couldn't load this view right now. Please try again in a moment."));
    };
    run(true);
    const interval = setInterval(() => run(false), 20_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [childId, period]);

  const name = children?.find((child) => child.id === childId)?.nickname ?? "your child";

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="KidQ home">
          <span className={styles.brandMark}>Q</span>
          <span>KidQ</span>
        </Link>
        {usingSampleData && (
          <span className={styles.sample} title="Connect the API and sign in to see your child's real viewing">
            Sample data
          </span>
        )}
      </header>

      <section className={styles.intro}>
        <p className={styles.eyebrow}>For grown-ups</p>
        <h1>Understanding {name}&rsquo;s viewing</h1>
        <p className={styles.lede}>A gentle look at what {name} watched and did on KidQ.</p>
        <div className={styles.controls}>
          {children && children.length > 1 && (
            <div className={styles.segmented} role="radiogroup" aria-label="Child">
              {children.map((child) => (
                <button key={child.id} type="button" role="radio" aria-checked={child.id === childId} className={styles.childChip} onClick={() => setChildId(child.id)}>
                  <span className={styles.avatar} aria-hidden="true">
                    {child.nickname.slice(0, 1)}
                  </span>
                  {child.nickname}
                </button>
              ))}
            </div>
          )}
          <div className={styles.segmented} role="radiogroup" aria-label="Time period">
            {PERIODS.map((option) => (
              <button key={option.key} type="button" role="radio" aria-checked={option.key === period} className={styles.periodButton} onClick={() => setPeriod(option.key)}>
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <p className={styles.privacyNote}>Your family&apos;s viewing data stays inside KidQ&apos;s own analytics system. We do not sell it or share it outside KidQ.</p>
      </section>

      {error ? (
        <p className={styles.notice}>{error}</p>
      ) : !data ? (
        <p className={styles.notice} aria-live="polite">
          Gathering {name}&rsquo;s viewing…
        </p>
      ) : (
        <Sections data={data} name={name} period={period} />
      )}
    </main>
  );
}

function Sections({ data, name, period }: { data: ParentAnalytics; name: string; period: Period }) {
  const colors = new Map(data.categories.map((category, index) => [category.key, COLORS[index % COLORS.length]]));
  const colorOf = (key: string | null) => colors.get(key ?? "") ?? COLORS[COLORS.length - 1];
  const labelOf = (key: string | null) =>
    data.categories.find((category) => category.key === key)?.label ??
    data.engaged.find((category) => category.key === key)?.label ??
    (key ? key.replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase()) : "Other");
  const bars =
    period === "today"
      ? data.pattern.map((part) => ({ key: part.part, label: part.label, title: `${part.label}, ${part.hours}`, minutes: part.minutes }))
      : data.daily.map((day, index) => ({
          key: day.date,
          label: period === "7d" ? WEEKDAY.format(asDate(day.date)) : index % 5 === 0 || index === data.daily.length - 1 ? DAY_MONTH.format(asDate(day.date)) : "",
          title: `${WEEKDAY.format(asDate(day.date))} ${DAY_MONTH.format(asDate(day.date))}`,
          minutes: day.minutes,
        }));
  const compare = comparison(data.overview.vs_previous);

  return (
    <>
      <section className={styles.overview} aria-label="Overview">
        <Stat label="Screen time" value={formatMinutes(data.overview.screen_minutes)} note={compare ?? PERIOD_NAME[period]} />
        <Stat label="Videos watched" value={String(data.overview.videos_watched)} note={PERIOD_NAME[period]} />
        <Stat label="Activities" value={String(data.overview.activities_completed)} note={data.overview.activities_completed ? PERIOD_NAME[period] : "Coming soon to KidQ"} />
      </section>

      {!data.has_data ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Nothing watched yet {PERIOD_PHRASE[period]}</p>
          <p>When {name} watches something on KidQ, you&rsquo;ll see it here.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          <Card title={period === "today" ? "Today, by part of the day" : "Screen time by day"} wide>
            <div className={styles.bars} data-dense={period === "30d" || undefined} role="img" aria-label={bars.map((bar) => `${bar.title}: ${bar.minutes} minutes`).join(", ")}>
              {bars.map((bar) => {
                const max = Math.max(1, ...bars.map((entry) => entry.minutes));
                return (
                  <div key={bar.key} className={styles.barColumn} title={`${bar.title}: ${formatMinutes(bar.minutes)}`}>
                    <span className={styles.barValue}>{bar.minutes > 0 && period !== "30d" ? bar.minutes : ""}</span>
                    <span className={styles.barTrack}>
                      <span className={styles.bar} style={{ height: bar.minutes > 0 ? `max(4px, ${(bar.minutes / max) * 100}%)` : 0 }} />
                    </span>
                    <span className={styles.barLabel}>{bar.label}</span>
                  </div>
                );
              })}
            </div>
            <p className={styles.caption}>Minutes of video actually playing — paused or idle time isn&rsquo;t counted.</p>
          </Card>

          <Card title="What they’re watching">
            <ul className={styles.rows}>
              {data.categories.map((category) => (
                <li key={category.key}>
                  <div className={styles.rowHead}>
                    <span>{category.label}</span>
                    <strong>{category.percent}%</strong>
                  </div>
                  <Meter percent={category.percent} color={colorOf(category.key)} />
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Most engaged categories">
            {data.engaged.length === 0 ? (
              <p className={styles.muted}>This fills in once {name} has come back to a category a couple of times.</p>
            ) : (
              <>
                <p className={styles.lead}>
                  Seems to be engaging most with <strong>{data.engaged[0].label}</strong> {PERIOD_PHRASE[period]}.
                </p>
                <ul className={styles.engaged}>
                  {data.engaged.map((category) => (
                    <li key={category.key}>
                      <span className={styles.dot} style={{ background: colorOf(category.key) }} aria-hidden="true" />
                      <div>
                        <p className={styles.itemTitle}>{category.label}</p>
                        <p className={styles.muted}>
                          {[
                            `${formatMinutes(category.minutes)} watched`,
                            category.videos ? count(category.videos, "video", "videos") : null,
                            category.activities ? count(category.activities, "activity", "activities") : null,
                            `${category.average_completion}% finished on average`,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>

          <Card title="Most watched" wide>
            <ul className={styles.content}>
              {data.top_content.map((entry) => (
                <li key={entry.card.id} className={styles.contentCard}>
                  {entry.card.thumbnail_url ? (
                    // Source thumbnails (YouTube, NASA, StoryWeaver) are remote; next/image would need each host configured.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className={styles.thumb} src={entry.card.thumbnail_url} alt="" loading="lazy" />
                  ) : (
                    <span className={styles.thumb} style={{ background: colorOf(entry.card.category) }} aria-hidden="true">
                      {entry.card.title.slice(0, 1)}
                    </span>
                  )}
                  <div>
                    <p className={styles.itemTitle}>{entry.card.title}</p>
                    <p className={styles.tag}>{labelOf(entry.card.category)}</p>
                    <p className={styles.muted}>
                      {timesWatched(entry.times_watched)} · {entry.completion}% finished · {formatMinutes(entry.minutes)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Finishing what they start">
            <p className={styles.lead}>
              <strong>{count(data.completion.started, "video", "videos")}</strong> started
            </p>
            <div className={styles.stack} aria-hidden="true">
              {[
                [data.completion.completed, COLORS[2]],
                [data.completion.partly_watched, COLORS[1]],
                [data.completion.stopped_early, COLORS[5]],
              ].map(([value, color], index) => (
                <span key={index} style={{ flexGrow: Number(value), background: String(color) }} />
              ))}
            </div>
            <ul className={styles.legend}>
              <Legend color={COLORS[2]} label="Finished" value={data.completion.completed} />
              <Legend color={COLORS[1]} label="Partly watched" value={data.completion.partly_watched} />
              <Legend color={COLORS[5]} label="Stopped early" value={data.completion.stopped_early} />
            </ul>
          </Card>

          <Card title="When they watch">
            <ul className={styles.rows}>
              {data.pattern.map((part) => {
                const max = Math.max(1, ...data.pattern.map((entry) => entry.minutes));
                return (
                  <li key={part.part}>
                    <div className={styles.rowHead}>
                      <span>
                        {part.label} <span className={styles.hours}>{part.hours}</span>
                      </span>
                      <strong>{formatMinutes(part.minutes)}</strong>
                    </div>
                    <Meter percent={(part.minutes / max) * 100} color={COLORS[3]} />
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card title="Videos and activities">
            <div className={styles.stack} aria-hidden="true">
              <span style={{ flexGrow: data.split.video_percent || 1, background: COLORS[0] }} />
              {data.split.activity_percent > 0 && <span style={{ flexGrow: data.split.activity_percent, background: COLORS[2] }} />}
            </div>
            <ul className={styles.legend}>
              <Legend color={COLORS[0]} label="Watching videos" value={`${data.split.video_percent}%`} />
              <Legend color={COLORS[2]} label="Activities" value={`${data.split.activity_percent}%`} />
            </ul>
            {data.split.activity_minutes === 0 && <p className={styles.muted}>Activities like crafts, drawing and yoga are coming to KidQ soon.</p>}
          </Card>

          <Card title={`${PERIOD_NAME[period] === "Today" ? "Today" : PERIOD_NAME[period]} at a glance`}>
            {data.insights.length === 0 ? (
              <p className={styles.muted}>A short summary appears once there&rsquo;s a little more viewing to go on.</p>
            ) : (
              <ul className={styles.insights}>
                {data.insights.map((insight) => (
                  <li key={insight}>{insight}</li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className={styles.stat}>
      <p className={styles.statLabel}>{label}</p>
      <p className={styles.statValue}>{value}</p>
      <p className={styles.muted}>{note}</p>
    </div>
  );
}

function Card({ title, wide, children }: { title: string; wide?: boolean; children: ReactNode }) {
  return (
    <section className={styles.card} data-wide={wide || undefined}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Meter({ percent, color }: { percent: number; color: string }) {
  return (
    <span className={styles.meter} aria-hidden="true">
      <span style={{ width: `${Math.min(100, Math.max(0, percent))}%`, background: color }} />
    </span>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: number | string }) {
  return (
    <li>
      <span className={styles.dot} style={{ background: color }} aria-hidden="true" />
      {label}
      <strong>{value}</strong>
    </li>
  );
}
