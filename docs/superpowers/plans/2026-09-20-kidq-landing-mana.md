# KidQ Landing Page (MANA-style, Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `design/kidq-landing-v1.html` — KidQ's new marketing/landing page with MANA-style scroll-typewriter hero, full-bleed color-block tiles, and the subscription pitch (90 days free, then ₹99/month) — and publish it as a NEW Claude Artifact.

**Architecture:** One self-contained HTML file (inline CSS + JS, no libraries), same convention as `design/parent-mockups-v1.html`. Scroll-driven animation via one rAF loop reading `scrollY`; sticky-pinned hero; pure CSS/SVG illustrations.

**Tech Stack:** Plain HTML/CSS/JS. Google Fonts (Baloo 2 + Mukta — KidQ's existing brand fonts). No build step.

**Spec:** `docs/superpowers/specs/2026-09-20-kidq-mana-revamp-design.md` (read it first — palette table, motion rules, copy, a11y are all binding).

## Global Constraints

- File: `design/kidq-landing-v1.html`, next to `parent-mockups-v1.html`. Do NOT touch `parent-mockups-v1.html` (that's Phase 2, separate plan).
- No animation/JS libraries; no raster images. Inline SVG only.
- `<meta charset="utf-8">` required (this project's known mojibake trap).
- Test over `http://localhost:<port>` via `python -m http.server` — never `file://` (extension can't script file:// pages). Pick an uncommon port (e.g. 8360).
- No git commits — design files in this worktree stay untracked (established user choice).
- Every text-bearing color pairing must pass WCAG 2.1 AA (4.5:1 body, 3:1 for text ≥24px regular / 19px bold). The token values below are pre-verified; if you deviate, recompute.
- `prefers-reduced-motion: reduce` must yield: fully-typed unpinned hero, no parallax, opacity-only hovers, no balloon bob.
- All CTAs/social links are mockup links (`href="#"`).
- Currency symbol ₹ and copy strings exactly as written in tasks — no paraphrasing.
- Every animation timing comes from the spec's motion system; don't invent new tiers.

---

### Task 1: Skeleton, tokens, header, page scaffolding

**Files:**
- Create: `design/kidq-landing-v1.html`

**Interfaces:**
- Produces: CSS custom properties on `:root` (`--cream`, `--ink`, `--leaf`, `--sun`, `--sky`, `--coral`, `--pink`, `--night`, `--teal`, `--teal-deep`), classes `.pill-btn`, `.wrap`, and the empty section stubs `#hero`, `#how`, `#demo`, `#pricing`, `footer` that Tasks 2-6 fill.

- [ ] **Step 1: Write the file skeleton**

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>KidQ — Screen time that ends well</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Mukta:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{
  --cream:#FAF4E8; --ink:#2E2A24; --night:#2B2955;
  --leaf:#58B368; --sun:#FFC64D; --sky:#3D64C4; --coral:#F26B4E; --pink:#F585B9;
  --teal:#17A398; --teal-deep:#167D72;
  --font-display:"Baloo 2",system-ui,sans-serif; --font-body:"Mukta",system-ui,sans-serif;
}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{background:var(--cream);color:var(--ink);font-family:var(--font-body);line-height:1.5}
.wrap{max-width:1200px;margin:0 auto;padding:0 24px}
.pill-btn{display:inline-flex;align-items:center;justify-content:center;
  font-family:var(--font-display);font-weight:700;font-size:1.05rem;
  background:var(--ink);color:var(--cream);border:none;border-radius:99px;
  padding:14px 30px;text-decoration:none;cursor:pointer;
  transition:transform .25s ease,box-shadow .25s ease}
.pill-btn:hover{transform:translateY(-2px);box-shadow:0 6px 18px rgba(46,42,36,.18)}
.site-header{position:sticky;top:0;z-index:50;background:var(--cream);
  border-bottom:1.5px solid var(--ink)}
.site-header .wrap{display:flex;align-items:center;gap:28px;height:68px}
.logo{font-family:var(--font-display);font-weight:800;font-size:1.6rem;color:var(--ink);text-decoration:none;margin-right:auto}
.nav-link{font-weight:600;color:var(--ink);text-decoration:none}
.nav-link:hover{color:var(--teal-deep)}
.site-header .pill-btn{padding:10px 22px;font-size:.95rem}
</style>
</head>
<body>
<header class="site-header">
  <div class="wrap">
    <a class="logo" href="#hero">KidQ</a>
    <a class="nav-link" href="#how">How it works</a>
    <a class="nav-link" href="#pricing">Pricing</a>
    <a class="pill-btn" href="#pricing">Start free</a>
  </div>
</header>
<section id="hero"></section>
<section id="how"></section>
<section id="demo"></section>
<section id="pricing"></section>
<footer id="site-footer"></footer>
<script>
"use strict";
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
</script>
</body>
</html>
```

- [ ] **Step 2: Verify it serves and renders**

Run from `design/`: `python -m http.server 8360` (background). Open `http://localhost:8360/kidq-landing-v1.html` in Chrome. Expected: cream page, sticky header with logo, two links, ink pill button; zero console errors; fonts load (Baloo 2 visible on logo).

---

### Task 2: Scroll-typewriter hero

**Files:**
- Modify: `design/kidq-landing-v1.html` (fill `#hero`, extend `<style>` and `<script>`)

**Interfaces:**
- Consumes: `:root` tokens, `REDUCED` const (Task 1).
- Produces: a single shared rAF scroll loop — `const onScrollFns = [];` array + one `requestAnimationFrame` pump. Tasks 3 pushes into `onScrollFns`. Do not add second scroll listeners later.

- [ ] **Step 1: Hero HTML**

```html
<section id="hero" aria-label="Intro">
  <div class="hero-pin">
    <h1 class="type-headline" aria-label="Screen time that ends well."></h1>
    <svg class="hero-arc" viewBox="0 0 420 120" aria-hidden="true">
      <path id="arcPath" d="M 20 110 Q 210 -30 400 110" fill="none"/>
      <text><textPath href="#arcPath" startOffset="8%">and ends with goodnight ✦</textPath></text>
    </svg>
  </div>
</section>
```

- [ ] **Step 2: Hero CSS**

```css
#hero{height:250vh;position:relative}
.hero-pin{position:sticky;top:0;height:100vh;display:flex;flex-direction:column;
  align-items:center;justify-content:center;overflow:hidden}
.type-headline{font-family:var(--font-display);font-weight:800;
  font-size:clamp(3.2rem,11vw,10rem);line-height:.95;letter-spacing:-.01em;
  text-transform:uppercase;max-width:12ch;text-align:left}
.type-headline .lt{visibility:hidden}
.type-headline .lt.on{visibility:visible}
.type-headline .c-leaf{color:var(--leaf)}
.type-headline .c-sky{color:var(--sky)}
.type-headline .c-coral{color:var(--coral)}
.type-headline .c-sun{color:var(--sun)}
.hero-arc{position:absolute;right:6vw;top:14vh;width:min(360px,34vw)}
.hero-arc text{font-family:var(--font-display);font-weight:700;font-size:22px;
  fill:var(--coral);letter-spacing:.08em;text-transform:uppercase}
@media (prefers-reduced-motion: reduce){
  #hero{height:100vh}
}
```

Note: `--sun` (#FFC64D) on cream is 1.43:1 — decorative-glyph territory only. Use `c-sun` on at most ONE letter and never a letter that changes word meaning if unseen; leaf/sky/coral carry the rest. (Headline letters are giant display glyphs on top of an already ink-colored word set — the AA-binding text is ink.)

- [ ] **Step 3: Typewriter JS (inside the existing script block)**

```js
const HEADLINE = "SCREEN TIME THAT ENDS WELL.";
// deterministic accent positions (index into HEADLINE): S=leaf, T(of TIME)=sky, E(of ENDS)=coral, W=sun
const ACCENTS = { 0:"c-leaf", 7:"c-sky", 17:"c-coral", 22:"c-sun" };
const headlineEl = document.querySelector(".type-headline");
const letterEls = [];
[...HEADLINE].forEach((ch,i)=>{
  if(ch===" "){ headlineEl.appendChild(document.createTextNode(" ")); return; }
  const s=document.createElement("span");
  s.className="lt"+(ACCENTS[i]?" "+ACCENTS[i]:"");
  s.textContent=ch; s.setAttribute("aria-hidden","true");
  headlineEl.appendChild(s); letterEls.push(s);
});

const onScrollFns=[];
function heroTick(){
  const hero=document.getElementById("hero");
  const total=hero.offsetHeight-innerHeight;
  const p=Math.min(1,Math.max(0,-hero.getBoundingClientRect().top/total));
  const n=Math.round(p*letterEls.length);
  letterEls.forEach((el,i)=>el.classList.toggle("on",i<n));
}
if(REDUCED){ letterEls.forEach(el=>el.classList.add("on")); }
else{
  onScrollFns.push(heroTick);
  let ticking=false;
  addEventListener("scroll",()=>{ if(!ticking){ ticking=true;
    requestAnimationFrame(()=>{ onScrollFns.forEach(f=>f()); ticking=false; }); }},{passive:true});
  onScrollFns.forEach(f=>f());
}
```

- [ ] **Step 4: Verify**

Node syntax check: extract the script block and run `node -e "new Function(require('fs').readFileSync(0,'utf8'))" < extracted.js`. Then in Chrome: at page top zero/few letters visible; `scrollTo(0, heroHeight*0.5)` → roughly half the letters; full scroll → all letters + period. The `aria-label` on the h1 carries the accessible name (letter spans are aria-hidden). Check reduced-motion by toggling emulation in DevTools rendering settings via CDP if available, else verify the `REDUCED` branch by temporarily forcing `REDUCED=true` in console and reloading logic manually — confirm all letters shown.

---

### Task 3: Parallax decorations

**Files:**
- Modify: `design/kidq-landing-v1.html` (add decorations into `.hero-pin`, extend script)

**Interfaces:**
- Consumes: `onScrollFns` array (Task 2). Push, don't add listeners.

- [ ] **Step 1: Decoration HTML (insert as first children of `.hero-pin`)**

```html
<svg class="par par-sun" data-speed="0.22" viewBox="0 0 80 80" aria-hidden="true">
  <circle cx="40" cy="40" r="18" fill="var(--sun)"/>
  <g stroke="var(--ink)" stroke-width="3" stroke-linecap="round">
    <line x1="40" y1="6" x2="40" y2="16"/><line x1="40" y1="64" x2="40" y2="74"/>
    <line x1="6" y1="40" x2="16" y2="40"/><line x1="64" y1="40" x2="74" y2="40"/>
    <line x1="16" y1="16" x2="23" y2="23"/><line x1="57" y1="57" x2="64" y2="64"/>
    <line x1="64" y1="16" x2="57" y2="23"/><line x1="23" y1="57" x2="16" y2="64"/>
  </g>
</svg>
<svg class="par par-star1" data-speed="0.4" viewBox="0 0 24 24" aria-hidden="true">
  <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" fill="var(--coral)"/>
</svg>
<svg class="par par-star2" data-speed="0.5" viewBox="0 0 24 24" aria-hidden="true">
  <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" fill="var(--sky)"/>
</svg>
<svg class="par par-cloud" data-speed="0.3" viewBox="0 0 120 60" aria-hidden="true">
  <path d="M20 45 Q20 25 40 27 Q45 12 62 16 Q80 8 88 25 Q105 25 103 45 Z"
        fill="none" stroke="var(--ink)" stroke-width="2.5"/>
</svg>
```

- [ ] **Step 2: Decoration CSS**

```css
.par{position:absolute;will-change:transform}
.par-sun{width:90px;left:8vw;top:18vh}
.par-star1{width:34px;right:14vw;bottom:24vh}
.par-star2{width:24px;left:18vw;bottom:16vh}
.par-cloud{width:130px;right:8vw;top:52vh}
@media (prefers-reduced-motion: reduce){ .par{display:none} }
```

- [ ] **Step 3: Parallax JS**

```js
if(!REDUCED){
  const pars=[...document.querySelectorAll(".par")];
  onScrollFns.push(()=>{ pars.forEach(el=>{
    el.style.transform=`translateY(${-(scrollY*parseFloat(el.dataset.speed))}px)`;
  });});
}
```

- [ ] **Step 4: Verify**

Chrome: decorations visible in hero; JS-read `getComputedStyle(...).transform` changes with scroll position and each element moves a different amount (0.22 vs 0.5). No console errors.

---

### Task 4: How-it-works color-block grid

**Files:**
- Modify: `design/kidq-landing-v1.html` (fill `#how`)

**Interfaces:**
- Consumes: tokens. Produces class `.tile` used only here.

- [ ] **Step 1: HTML — 4 full-bleed tiles**

```html
<section id="how" aria-label="How KidQ works">
  <div class="tile-grid">
    <div class="tile t-coral" tabindex="0">
      <h2>Mumma picks</h2>
      <div class="art">
        <svg class="art-base" viewBox="0 0 100 100" aria-hidden="true">
          <path d="M50 82 C20 60 12 38 26 26 C36 18 46 22 50 30 C54 22 64 18 74 26 C88 38 80 60 50 82Z" fill="var(--cream)"/>
        </svg>
        <svg class="art-hover" viewBox="0 0 100 100" aria-hidden="true">
          <path d="M50 82 C20 60 12 38 26 26 C36 18 46 22 50 30 C54 22 64 18 74 26 C88 38 80 60 50 82Z" fill="var(--cream)" transform="scale(1.12) translate(-5.4 -5.4)" transform-origin="50 50"/>
          <path d="M22 20l4 8M78 20l-4 8M50 8l0 9" stroke="var(--cream)" stroke-width="3" stroke-linecap="round"/>
        </svg>
      </div>
      <p>You choose today's videos. The app never picks for your kid.</p>
    </div>
    <div class="tile t-sun" tabindex="0">
      <h2>The sun keeps time</h2>
      <div class="art">
        <svg class="art-base" viewBox="0 0 100 100" aria-hidden="true">
          <path d="M10 78 Q50 18 90 78" fill="none" stroke="var(--ink)" stroke-width="3" stroke-dasharray="2 6" stroke-linecap="round"/>
          <circle cx="22" cy="66" r="10" fill="var(--ink)"/>
        </svg>
        <svg class="art-hover" viewBox="0 0 100 100" aria-hidden="true">
          <path d="M10 78 Q50 18 90 78" fill="none" stroke="var(--ink)" stroke-width="3" stroke-dasharray="2 6" stroke-linecap="round"/>
          <circle cx="50" cy="48" r="10" fill="var(--ink)"/>
        </svg>
      </div>
      <p>A sky crosses the session. When the sun sets, videos are done.</p>
    </div>
    <div class="tile t-leaf" tabindex="0">
      <h2>Breaks to play</h2>
      <div class="art">
        <svg class="art-base" viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="46" r="10" fill="var(--cream)"/>
          <line x1="50" y1="56" x2="50" y2="84" stroke="var(--cream)" stroke-width="4" stroke-linecap="round"/>
        </svg>
        <svg class="art-hover" viewBox="0 0 100 100" aria-hidden="true">
          <g fill="var(--cream)"><circle cx="50" cy="30" r="9"/><circle cx="35" cy="42" r="9"/><circle cx="65" cy="42" r="9"/><circle cx="40" cy="58" r="9"/><circle cx="60" cy="58" r="9"/><circle cx="50" cy="46" r="8" fill="var(--sun)"/></g>
          <line x1="50" y1="64" x2="50" y2="88" stroke="var(--cream)" stroke-width="4" stroke-linecap="round"/>
        </svg>
      </div>
      <p>Between videos, a real-world moment: breathe, stretch, smile.</p>
    </div>
    <div class="tile t-night" tabindex="0">
      <h2>Ends with goodnight</h2>
      <div class="art">
        <svg class="art-base" viewBox="0 0 100 100" aria-hidden="true">
          <path d="M62 20 A30 30 0 1 0 62 80 A24 24 0 1 1 62 20Z" fill="var(--cream)"/>
        </svg>
        <svg class="art-hover" viewBox="0 0 100 100" aria-hidden="true">
          <path d="M62 20 A30 30 0 1 0 62 80 A24 24 0 1 1 62 20Z" fill="var(--cream)"/>
          <circle cx="50" cy="50" r="42" fill="var(--cream)" opacity=".14"/>
          <path d="M80 26l1.5 4.5L86 32l-4.5 1.5L80 38l-1.5-4.5L74 32l4.5-1.5z" fill="var(--sun)"/>
        </svg>
      </div>
      <p>The session ends itself — a moonrise, a high-five, goodnight.</p>
    </div>
  </div>
</section>
```

- [ ] **Step 2: CSS**

```css
.tile-grid{display:grid;grid-template-columns:1fr 1fr}
.tile{min-height:56vh;padding:48px 32px;display:flex;flex-direction:column;
  align-items:center;text-align:center;gap:18px;outline-offset:-4px;
  transition:transform .25s ease}
.tile h2{font-family:var(--font-display);font-weight:800;font-size:clamp(1.6rem,3vw,2.4rem);text-transform:uppercase}
.tile p{max-width:34ch;font-size:1.05rem;font-weight:500}
.tile .art{position:relative;width:min(180px,40vw);aspect-ratio:1;margin-top:auto;margin-bottom:auto}
.tile .art svg{position:absolute;inset:0;width:100%;height:100%;transition:opacity .25s ease}
.tile .art-hover{opacity:0}
.tile:hover,.tile:focus-visible{transform:translateY(-4px)}
.tile:hover .art-hover,.tile:focus-visible .art-hover{opacity:1}
.tile:hover .art-base,.tile:focus-visible .art-base{opacity:0}
.t-coral{background:var(--coral);color:var(--ink)}
.t-sun{background:var(--sun);color:var(--ink)}
.t-leaf{background:var(--leaf);color:var(--ink)}
.t-night{background:var(--night);color:var(--cream)}
@media (prefers-reduced-motion: reduce){
  .tile:hover,.tile:focus-visible{transform:none}
}
@media (max-width:720px){ .tile-grid{grid-template-columns:1fr} .tile{min-height:48vh} }
```

- [ ] **Step 3: Verify**

Chrome: 2×2 edge-to-edge blocks (no gaps, no page margin — grid must NOT be inside `.wrap`); hover each tile → illustration state swaps (sun moves up its arc, flower blooms, moon gains halo+star, heart grows rays); keyboard Tab reaches each tile and triggers the same swap via `:focus-visible`. At 500px width: single column. Contrast spot-check: ink on coral/sun/leaf, cream on night — matches spec table.

---

### Task 5: Living-sky demo band

**Files:**
- Modify: `design/kidq-landing-v1.html` (fill `#demo`)

- [ ] **Step 1: HTML + CSS**

```html
<section id="demo" aria-label="The sky is the timer">
  <div class="sky-band">
    <svg class="sky-arc" viewBox="0 0 600 180" aria-hidden="true">
      <path d="M40 170 Q300 -40 560 170" fill="none" stroke="rgba(250,244,232,.55)" stroke-width="3" stroke-dasharray="1 10" stroke-linecap="round"/>
    </svg>
    <div class="sky-sun"></div>
    <p class="sky-caption">The sky is the timer. When the sun sets, the day's videos are done.</p>
  </div>
</section>
```

```css
.sky-band{position:relative;height:52vh;min-height:340px;overflow:hidden;
  background:linear-gradient(180deg,#7EC8F2 0%,#BFE3F7 55%,#FFE3B3 100%);
  display:flex;align-items:flex-end;justify-content:center}
.sky-arc{position:absolute;inset:0;width:100%;height:100%}
.sky-sun{position:absolute;width:56px;height:56px;border-radius:50%;
  background:var(--sun);box-shadow:0 0 40px 12px rgba(255,198,77,.55);
  offset-rotate:0deg; /* NOT offset-path — see constraint below */
  left:0;top:0;animation:sunride 14s ease-in-out infinite alternate}
@keyframes sunride{
  0%{transform:translate(6vw,38vh) }
  50%{transform:translate(46vw,6vh) }
  100%{transform:translate(86vw,38vh) }
}
.sky-caption{position:relative;z-index:1;font-family:var(--font-display);
  font-weight:700;font-size:clamp(1.1rem,2.2vw,1.5rem);color:var(--night);
  background:var(--cream);border-radius:16px;padding:12px 22px;margin-bottom:36px}
@media (prefers-reduced-motion: reduce){ .sky-sun{animation:none;transform:translate(46vw,6vh)} }
```

HARD CONSTRAINT: do not use CSS `offset-path` anywhere — it reproducibly white-screens the artifact viewer on this machine (documented project memory). Transform keyframes only, exactly as above.

- [ ] **Step 2: Verify**

Chrome: gradient band renders; sun element has a running `animation` (assert via `getComputedStyle(document.querySelector('.sky-sun')).animationName === 'sunride'` — do NOT claim visual playback; automation window is `document.hidden`, animations can't be watched here, state-check only, per project convention). Caption chip readable (night on cream = 12.36:1).

---

### Task 6: Subscription block + footer

**Files:**
- Modify: `design/kidq-landing-v1.html` (fill `#pricing` and `#site-footer`)

- [ ] **Step 1: Pricing HTML + CSS**

```html
<section id="pricing" aria-label="Pricing">
  <div class="price-block">
    <h2 class="price-headline">90 days free.</h2>
    <p class="price-sub">Then ₹99/month. One plan, everything in it.</p>
    <ul class="price-feats">
      <li>You pick every video</li>
      <li>The sky keeps time — sessions end themselves</li>
      <li>Playful between-video breaks</li>
      <li>Ends with goodnight, not a tantrum</li>
    </ul>
    <a class="pill-btn price-cta" href="#">Start your 90 days</a>
    <p class="price-note">No card needed to start.</p>
  </div>
</section>
```

```css
.price-block{background:var(--sun);padding:96px 24px;display:flex;flex-direction:column;
  align-items:center;text-align:center;gap:14px}
.price-headline{font-family:var(--font-display);font-weight:800;
  font-size:clamp(3rem,8vw,6.5rem);line-height:1;text-transform:uppercase;color:var(--ink)}
.price-sub{font-size:clamp(1.2rem,2.4vw,1.6rem);font-weight:600;color:var(--ink)}
.price-feats{list-style:none;display:flex;flex-direction:column;gap:6px;margin:10px 0;
  font-weight:500;color:var(--ink)}
.price-feats li::before{content:"✦ ";color:var(--sky)}
.price-cta{font-size:1.2rem;padding:18px 40px;margin-top:8px}
.price-note{font-size:.95rem;font-weight:600;color:var(--ink)}
```

- [ ] **Step 2: Footer HTML + CSS**

```html
<footer id="site-footer" aria-label="Footer">
  <svg class="foot-wave" viewBox="0 0 1200 60" preserveAspectRatio="none" aria-hidden="true">
    <path d="M0 30 Q150 0 300 30 T600 30 T900 30 T1200 30" fill="none" stroke="var(--ink)" stroke-width="2"/>
  </svg>
  <div class="foot-inner">
    <div class="balloon-word" aria-label="KidQ">
      <span class="bl bl-teal" aria-hidden="true">K</span><span class="bl bl-sun" aria-hidden="true">i</span><span class="bl bl-coral" aria-hidden="true">d</span><span class="bl bl-sky" aria-hidden="true">Q</span>
    </div>
    <svg class="foot-cloud" viewBox="0 0 120 60" aria-hidden="true">
      <path d="M20 45 Q20 25 40 27 Q45 12 62 16 Q80 8 88 25 Q105 25 103 45 Z" fill="none" stroke="var(--ink)" stroke-width="2.5"/>
    </svg>
    <div class="foot-social">
      <a href="#" aria-label="Instagram" class="soc">ig</a>
      <a href="#" aria-label="YouTube" class="soc">yt</a>
      <a href="#" aria-label="WhatsApp" class="soc">wa</a>
    </div>
    <p class="foot-copy">2026 © KidQ · Screen time that ends well</p>
  </div>
</footer>
```

```css
#site-footer{padding:24px 0 40px;position:relative}
.foot-wave{width:100%;height:40px;display:block}
.foot-inner{display:flex;flex-direction:column;align-items:center;gap:20px;padding-top:20px}
.balloon-word{display:flex;gap:4px;font-family:var(--font-display);font-weight:800;
  font-size:clamp(3rem,7vw,5rem);line-height:1}
.bl{display:inline-block;-webkit-text-stroke:1.5px rgba(46,42,36,.25)}
.bl-teal{color:var(--teal)} .bl-sun{color:var(--sun)} .bl-coral{color:var(--coral)} .bl-sky{color:var(--sky)}
@keyframes blbob{from{transform:translateY(3px)}to{transform:translateY(-3px)}}
.bl{animation:blbob 3s ease-in-out infinite alternate}
.bl:nth-child(2){animation-delay:.4s}.bl:nth-child(3){animation-delay:.8s}.bl:nth-child(4){animation-delay:1.2s}
.foot-cloud{width:110px;position:absolute;right:10vw;bottom:60px;opacity:.7}
.foot-social{display:flex;gap:12px}
.soc{width:44px;height:44px;border-radius:50%;background:var(--sun);color:var(--ink);
  display:flex;align-items:center;justify-content:center;font-weight:700;text-decoration:none;
  border:1.5px solid var(--ink)}
.foot-copy{font-size:.9rem;font-weight:500}
@media (prefers-reduced-motion: reduce){ .bl{animation:none} }
```

- [ ] **Step 3: Verify**

Chrome full-page pass: header → hero → tiles → sky band → gold pricing block → footer. Pricing copy EXACT: "90 days free." / "Then ₹99/month. One plan, everything in it." / "Start your 90 days" / "No card needed to start." (₹ renders — charset check). Footer balloons have per-letter animation-delay (state-check). Social buttons ≥44px tap targets.

---

### Task 7: Final pass — a11y, responsive, publish

**Files:**
- Modify: `design/kidq-landing-v1.html` (fixes only)

- [ ] **Step 1: Responsive walk** — Chrome at 390px, 768px, 1280px widths: no horizontal scroll at any width; hero headline wraps without clipping; tiles stack at ≤720px; pricing type scales down.

- [ ] **Step 2: Reduced-motion walk** — with `REDUCED` path forced: hero 100vh + fully typed, no `.par` elements visible, sun static mid-arc, balloons still. (CSS media query + JS const both fire.)

- [ ] **Step 3: Full a11y check** — headings h1→h2 order; every svg decorative one `aria-hidden`; focus visible on links/tiles/CTA; `node` syntax check on the full extracted script block passes.

- [ ] **Step 4: Detector pass** — run the project's usual `impeccable detect`-class check if available in your session; fix real findings, document defended ones. (Do not run `impeccable.exe` — flagged as malware on this machine; use the npx path only if the user has cleared it, otherwise skip and note.)

- [ ] **Step 5: Publish** — publish `design/kidq-landing-v1.html` as a NEW Claude Artifact: title "KidQ Landing", icon "sun", description "KidQ marketing page — 90-day free trial, ₹99/month". Report the URL back.

- [ ] **Step 6: Report** — message shreena-05 (plan author) with: artifact URL, any deviations from this plan, any findings deliberately not fixed.
