"use client";

import { useEffect, useState } from "react";
import { getHealth } from "@/services/api";
import styles from "./page.module.css";

export default function Home() {
  const [apiStatus, setApiStatus] = useState<"checking" | "connected" | "unreachable">("checking");

  useEffect(() => {
    getHealth().then(() => setApiStatus("connected")).catch(() => setApiStatus("unreachable"));
  }, []);

  return (
    <main className={styles.page}>
      <nav className={styles.nav} aria-label="Primary navigation">
        <a className={styles.brand} href="#top" aria-label="KidQ home">
          <span className={styles.brandMark}>Q</span><span>KidQ</span>
        </a>
        <div className={styles.navLinks}><a href="#explore">Explore</a><a href="#grownups">For grown-ups</a></div>
        <span className={styles.apiBadge} data-status={apiStatus}>
          <span aria-hidden="true" />
          {apiStatus === "connected" ? "Library ready" : apiStatus === "checking" ? "Checking library" : "Preview mode"}
        </span>
      </nav>

      <section className={styles.hero} id="top">
        <div className={styles.copy}>
          <p className={styles.eyebrow}>A calmer place to be curious</p>
          <h1>Little questions.<br />Lovely discoveries.</h1>
          <p className={styles.intro}>Thoughtfully chosen stories, activities, and gentle learning for curious minds from birth to six.</p>
          <div className={styles.actions}>
            <a className={styles.primaryAction} href="#explore">Start exploring <span>→</span></a>
            <a className={styles.secondaryAction} href="#grownups">How we choose</a>
          </div>
        </div>

        <div className={styles.animationCard} aria-label="KidQ letters softly roll together and unfold">
          <div className={styles.sunGlow} aria-hidden="true" />
          <div className={styles.motionStage} aria-hidden="true">
            <div className={`${styles.clayPiece} ${styles.pieceK}`}><span>K</span></div>
            <div className={`${styles.clayPiece} ${styles.pieceI}`}><span>i</span></div>
            <div className={`${styles.clayPiece} ${styles.pieceD}`}><span>d</span></div>
            <div className={`${styles.clayPiece} ${styles.pieceQ}`}><span>Q</span></div>
            <div className={styles.orbitDotOne} /><div className={styles.orbitDotTwo} />
          </div>
          <p className={styles.motionCaption}><span /> Curiosity, rolling into place</p>
        </div>
      </section>

      <section className={styles.promise} id="explore" aria-label="KidQ content principles">
        <article><span className={styles.promiseNumber}>01</span><h2>Gentle by design</h2><p>Slow-paced, uncluttered experiences that leave room to think.</p></article>
        <article><span className={styles.promiseNumber}>02</span><h2>Chosen with care</h2><p>Every item is reviewed for age fit, learning value, and safety.</p></article>
        <article id="grownups"><span className={styles.promiseNumber}>03</span><h2>Made for together</h2><p>Small prompts turn screen time into talking, moving, and making.</p></article>
      </section>
    </main>
  );
}
