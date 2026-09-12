"use client";

// KidQ story reader: a picture book one page at a time, with KidQ's own big page buttons that
// work with touch, a keyboard or a TV remote (arrows turn pages, Back goes back). There are no
// links out; the book's full credits follow the last page, as its license requires.
import { useCallback, useState, type CSSProperties, type KeyboardEvent } from "react";

export interface StoryPage {
  page: number;
  text: string;
  image_url: string | null;
  image_small_url?: string | null;
}

export interface KidQStoryReaderProps {
  title: string;
  pages: StoryPage[];
  /** The book's full attribution (story, illustrations, license), shown after the last page. */
  credits?: string | null;
  attribution?: { text: string | null } | null;
  onFinished?: () => void;
  className?: string;
}

const BACK_KEYS = new Set(["Escape", "Backspace", "BrowserBack", "GoBack"]);
const BACK_KEY_CODES = new Set([10009, 461]);

export function KidQStoryReader({ title, pages, credits, attribution, onFinished, className }: KidQStoryReaderProps) {
  // 0 … pages.length - 1 are the story pages; pages.length is "The end" with the credits.
  const [index, setIndex] = useState(0);
  const atEnd = index >= pages.length;
  const page = pages[index];

  const go = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(pages.length, next));
      setIndex(clamped);
      if (clamped === pages.length) onFinished?.();
    },
    [pages.length, onFinished],
  );

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight") go(index + 1);
    else if (event.key === "ArrowLeft" || BACK_KEYS.has(event.key) || BACK_KEY_CODES.has(event.keyCode)) go(index - 1);
    else return;
    event.preventDefault();
  };

  return (
    <div className={`kidq-story ${className ?? ""}`} style={styles.root} onKeyDown={onKeyDown}>
      <style>{READER_CSS}</style>
      <div style={styles.frame} aria-live="polite">
        {atEnd || !page ? (
          <div style={styles.end}>
            <p style={styles.endTitle}>The end</p>
            <button type="button" data-control style={styles.bigButton} onClick={() => go(0)}>
              ↺ Read again
            </button>
            {credits || attribution?.text ? <p style={styles.credits}>{credits ?? attribution?.text}</p> : null}
          </div>
        ) : (
          <>
            {page.image_url ? (
              <img
                src={page.image_url}
                srcSet={page.image_small_url ? `${page.image_small_url} 428w, ${page.image_url} 708w` : undefined}
                sizes="(max-width: 600px) 100vw, 708px"
                alt={`Illustration, page ${page.page} of ${title}`}
                style={styles.image}
              />
            ) : null}
            <p style={styles.text}>{page.text}</p>
          </>
        )}
      </div>
      <div style={styles.controls}>
        <button type="button" data-control style={styles.button} onClick={() => go(index - 1)} disabled={index === 0} aria-label="Previous page">
          ◀
        </button>
        <span style={styles.counter}>{atEnd ? "Credits" : `Page ${index + 1} of ${pages.length}`}</span>
        <button type="button" data-control style={styles.button} onClick={() => go(index + 1)} disabled={atEnd} aria-label="Next page">
          ▶
        </button>
      </div>
      {attribution?.text ? <p style={styles.credit}>{attribution.text}</p> : null}
    </div>
  );
}

const READER_CSS = `
.kidq-story [data-control]:focus-visible{outline:4px solid #f5a524;outline-offset:3px}
.kidq-story button:disabled{opacity:.4;cursor:default}
`;

const styles: Record<string, CSSProperties> = {
  root: { display: "grid", gap: 10, width: "100%" },
  frame: {
    display: "grid",
    alignContent: "start",
    gap: 12,
    minHeight: 320,
    padding: 16,
    borderRadius: 16,
    background: "#fffdf8",
    border: "1px solid rgba(36,53,47,.15)",
  },
  // A fixed box, so pages don't jump as you turn them; contain shows the whole illustration.
  image: { width: "100%", height: "min(52vh, 460px)", objectFit: "contain", borderRadius: 12, background: "#f4efe4" },
  text: { margin: 0, fontSize: 22, lineHeight: 1.5, color: "#24352f" },
  end: { display: "grid", placeItems: "center", alignContent: "center", gap: 16, minHeight: 280, textAlign: "center" },
  endTitle: { margin: 0, fontSize: 26, fontWeight: 800, color: "#24352f" },
  credits: { margin: 0, maxWidth: "70ch", fontSize: 13, lineHeight: 1.5, color: "#5b6d64", textAlign: "left" },
  bigButton: { minHeight: 56, padding: "0 28px", borderRadius: 999, border: 0, background: "#dd5b3c", color: "#fffaf0", fontSize: 20, fontWeight: 800, cursor: "pointer" },
  controls: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 },
  button: { minWidth: 64, minHeight: 56, borderRadius: 14, border: "1px solid rgba(36,53,47,.2)", background: "#fffdf8", color: "#24352f", fontSize: 22, cursor: "pointer" },
  counter: { fontVariantNumeric: "tabular-nums", color: "#5b6d64", fontSize: 15, fontWeight: 700 },
  credit: { margin: 0, fontSize: 12, color: "#5b6d64" },
};
