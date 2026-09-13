# KidQ – Content Recommendation Architecture Process

## 1. Objective

KidQ should recommend only **admin-approved content** to parents based on their child's onboarding preferences.

For MVP, the primary content type is **video content**.

Each content item goes through:

**Content Added → Analysis → KidQ Scoring → Admin Approval → Categorization → Parent Matching → Parent Approval → Child Viewing**

---

# 2. End-to-End Recommendation Flow

```text
Admin adds 200–300 curated content URLs
            +
Parent can submit a content URL
            ↓
      CONTENT INGESTION
            ↓
Validate URL
Check duplicate
Fetch available metadata
Create content record
Add to analysis queue
            ↓
      CONTENT ANALYSIS
            ↓
Transcript Analysis
Video/Pacing Analysis
Visual Comfort Analysis
Audio Comfort Analysis
            ↓
       HARD SAFETY CHECK
            ↓
Critical issue?
      YES → Needs Admin Review
      NO  → Continue Scoring
            ↓
       KIDQ CONTENT SCORE
            ↓
Content & Language Safety – 40%
Pacing – 25%
Visual Comfort – 20%
Audio Comfort – 15%
            ↓
Generate:
• KidQ Score (0–100)
• Confidence Score
• Reason for Score
• Safety Flags
            ↓
       ADMIN CONTENT STUDIO
            ↓
Admin reviews:
• Content
• Transcript
• Scores
• Safety flags
• Age
• Category
• Development goal
• Regulation goal
• Expert review
• Breakpoint configuration
            ↓
      APPROVE / REJECT
            ↓
Only APPROVED content becomes
RECOMMENDATION-ELIGIBLE
            ↓
      CONTENT CLASSIFICATION
            ↓
Tag approved content by:
• Age
• Language
• Category
• Interests
• Development goal
• Regulation goal
• Duration
• KidQ score
• Expert review
            ↓
        PARENT ONBOARDING
            ↓
Collect:
• Child age
• Preferred language
• Interests
• Preferred content types
• Development goals
• Regulation goals
• Screen-time / break preference
            ↓
      RECOMMENDATION ENGINE
            ↓
Filter approved content using:
Age
+ Language
+ Interests
+ Content Type
+ Development Goal
+ Regulation Goal
            ↓
Rank using:
Relevance
+ KidQ Score
+ Expert Review
+ Parent Preferences
            ↓
   PARENT RECOMMENDATION SCREEN
            ↓
Parent sees:
• Content
• KidQ Score
• Score breakdown
• Age
• Category
• Goal
• Expert review
            ↓
Parent chooses:
ADD / REMOVE
            ↓
     PARENT-APPROVED LIBRARY
            ↓
        CHILD KIDQ PLAYER
            ↓
Video playback
+ Session timer
+ Automatic breakpoints
            ↓
KidQ Orange Agent appears
            ↓
Eye / Movement / Offline Activity
            ↓
Resume content
```

---

# 3. Content Record

Each video should exist as one **Content** record.

The record can contain:

```text
CONTENT
├── URL
├── Title
├── Description
├── Thumbnail
├── Duration
├── Source
├── Language
├── Transcript
├── Analysis
│   ├── Content / Language
│   ├── Pacing
│   ├── Visual Comfort
│   └── Audio Comfort
├── Safety Flags
├── KidQ Score
├── Confidence Score
├── Classification
│   ├── Age
│   ├── Category
│   ├── Interests
│   ├── Development Goal
│   └── Regulation Goal
├── Expert Review
├── Admin Approval Status
└── Breakpoint Rules
```

---

# 4. Content Analysis

## 4.1 Transcript Analysis

Use transcript, where available, to identify:

- language
- inappropriate words
- violence-related language
- scary themes
- bullying / abusive language
- dangerous behaviour
- topic
- age appropriateness

The transcript should also be stored against the content record.

## 4.2 Pacing Analysis

Do not score based only on FPS.

Prefer signals such as:

- scene changes
- cuts per minute
- average shot duration
- rapid transitions
- fast-moving sequences

Output:

```text
Pacing Score: 0–100
```

Higher = calmer / more suitable pacing.

## 4.3 Visual Comfort

Analyse, where technically available:

- brightness
- brightness variation
- saturation
- sudden visual changes
- flashing / rapid changes
- visual intensity
- excessive motion

Output:

```text
Visual Comfort Score: 0–100
```

## 4.4 Audio Comfort

Analyse:

- loudness
- sudden loudness changes
- audio peaks
- highly jarring sounds
- audio intensity

Output:

```text
Audio Comfort Score: 0–100
```

---

# 5. Hard Safety Check

Hard safety rules should run **before weighted scoring**.

Examples:

- sexual / explicit content
- graphic or strong violence
- dangerous behaviour
- severe abusive language
- disturbing / highly frightening content
- other critical child-safety concerns

If a critical issue is detected:

```text
STATUS = NEEDS_ADMIN_REVIEW
```

Do not allow a high pacing or visual score to compensate for a serious safety problem.

---

# 6. KidQ Score

Initial scoring model:

```text
Content & Language Safety = 40%
Pacing                   = 25%
Visual Comfort           = 20%
Audio Comfort            = 15%
```

Formula:

```text
KidQ Score =
(Content × 0.40)
+ (Pacing × 0.25)
+ (Visual × 0.20)
+ (Audio × 0.15)
```

Also generate:

- Confidence Score
- Explanation / reason
- Missing-analysis indicators

Do not store only the final score. Store raw analysis values so weights can be changed later.

Use scoring versioning:

```text
KIDQ_SCORE_V1
```

---

# 7. Expert Review

Keep expert review separate from the automated KidQ Score.

Example:

```text
KidQ Score:       91/100
Expert Review:    3 of 4 recommend
Recommended Age:  4–6
```

Possible expert fields:

- reviewer name
- reviewer type
- credentials
- recommendation
- recommended age
- comments
- source

Do not claim a psychiatrist / psychologist recommendation unless it is genuinely verified.

---

# 8. Admin Content Studio

Admin should be able to see all content.

Main states:

```text
Pending Analysis
Analysing
Needs Review
Approved
Rejected
Analysis Incomplete
Failed
```

Admin content detail should show:

- content/video player
- transcript
- KidQ score
- individual parameter scores
- confidence
- safety flags
- age
- language
- category
- development goal
- regulation goal
- expert review
- breakpoint settings

Admin then:

```text
APPROVE
or
REJECT
```

Only approved content becomes eligible for recommendation.

---

# 9. Content Classification

Approved content should be categorized using onboarding-compatible attributes.

## Age

Example:

```text
0–2
2–3
3–4
4–5
5–6
```

MVP can focus on ages up to 6.

## Content Category

Examples:

- Animation
- Stories
- Storybooks
- Crafts
- Painting
- Science
- Maths
- Yoga
- Activities
- Educational
- Music / Rhymes
- Knowledge / General Learning

## Development Goal

Examples:

- Emotional
- Social
- Cognitive
- Communication
- Creativity
- Motor Skills
- Learning
- Problem Solving

## Regulation Goal

Examples:

- Calm
- Emotional Regulation
- Focus
- Movement
- Relaxation
- Social Regulation

Other tags can include language, interests, duration, content type, KidQ score, and expert review.

---

# 10. Parent Onboarding

Parent onboarding data becomes the recommendation profile.

Collect:

```text
Child Age
Preferred Language
Child Interests
Preferred Content Types
Development Goals
Regulation Goals
Screen-time Preferences
Break Preferences
```

---

# 11. Recommendation Engine

Recommendation should run only against:

```text
ADMIN_APPROVED_CONTENT = TRUE
```

## Step 1 – Filter

Filter by:

```text
Age
Language
Content Type
Interests
Development Goal
Regulation Goal
```

## Step 2 – Rank

Rank matched content using:

```text
Relevance to Parent Profile
+
KidQ Score
+
Expert Review
+
Parent Preferences
```

The exact ranking weights can be tuned later.

---

# 12. Parent Recommendation Screen

Each recommendation can show:

```text
Learning to Share

KidQ Score:      89/100
Expert Review:   3/4 Recommend
Age:             4–6
Goal:            Social Skills
Category:        Story

Content          96
Pacing           78
Visual           89
Audio            87

[ ADD ]    [ REMOVE ]
```

Parents remain in control.

---

# 13. Parent-Approved Library

Only content selected / allowed by the parent becomes visible in the child's KidQ experience.

```text
Recommendation
     ↓
Parent ADD
     ↓
Parent-Approved Library
     ↓
Child KidQ Player
```

---

# 14. Breakpoint Engine

Breakpoints should NOT need to be manually created for every video.

Use **global configurable rules**.

Example:

```text
BREAK_RULE_V1

Every 10 minutes
→ Insert activity break
```

For a 30-minute video:

```text
0 min ───── 10 min ───── 20 min ───── 30 min
              ↓             ↓
           Break 1        Break 2
```

Rules can apply to:

- all content
- age group
- content category
- selected content
- individual content override

---

# 15. Session Breakpoints

Do not depend only on video duration.

If a child watches several short videos continuously, track total session time.

Support both:

```text
CONTENT BREAKPOINTS
+
SESSION BREAKPOINTS
```

---

# 16. KidQ Orange Break Agent

Reuse / recreate the small orange agent style for break interactions.

At a breakpoint:

```text
Video pauses
      ↓
Orange KidQ Agent appears
      ↓
5–6 second instruction
      ↓
Offline / eye / movement activity
      ↓
20–30 second activity time
      ↓
Resume content
```

Examples:

- “Look away from the screen and find something green.”
- “Can you jump five times?”
- “Stretch your arms up high.”
- “Find something shaped like a circle.”
- “Look at something far away for a few seconds.”

The agent animation is only the introduction. The actual break should encourage the child to move or look away from the screen.

---

# 17. Activity Database

Create activities independently from videos so they can be reused.

```text
ACTIVITY
├── activity_id
├── name
├── type
├── age_min
├── age_max
├── instruction
├── intro_duration
├── activity_duration
├── requires_look_away
├── agent_animation
└── active
```

Example:

```json
{
  "activity_id": "ACT_021",
  "name": "Find Something Green",
  "type": "eye_distance",
  "age_min": 3,
  "age_max": 6,
  "intro_duration": 6,
  "activity_duration": 20,
  "requires_look_away": true,
  "agent_animation": "orange_agent_find_object",
  "instruction": "Can you find something green in your room?"
}
```

---

# 18. Activity Types

## Eye / Distance

- find something far away
- look outside
- find an object of a certain colour
- close eyes briefly

## Movement

- jump
- stretch
- touch toes
- walk around
- shake hands

## Cognitive

- count objects
- find a shape
- remember something from the video

## Fun

- walk like a penguin
- roar like a lion
- hop like a bunny

Prefer activities that encourage children to look away from the screen.

---

# 19. Separate Activity Admin

Admin navigation can include:

```text
Dashboard

Content
├── Content Library
├── Add Content
└── Analysis Queue

Activities
├── Activity Library
├── Create Activity
└── Agent Animations

Reviews
└── Needs Review

Configuration
├── KidQ Scoring
└── Break Rules
```

Activity Admin should allow:

- create activity
- edit activity
- enable / disable
- assign age range
- assign activity type
- assign animation
- set duration
- preview activity

---

# 20. Bulk Breakpoint Configuration

Admin should not configure 300 videos individually.

Example global rules:

```text
Rule A
Every 10 minutes
→ Eye break

Rule B
Every 20 minutes
→ Movement activity

Rule C
After configured session limit
→ Longer break
```

The breakpoint engine applies rules automatically.

Admin can override a specific content item if required.

---

# 21. Viewing Wellness Layer

This sits in the KidQ playback experience.

Include:

- reduced unnecessary UI motion
- comfortable UI brightness / glare
- restrained saturation
- avoid flashing interface elements
- continuous viewing timer
- automatic breakpoints
- movement / eye breaks
- parent-controlled session duration
- no endless autoplay

Use wording such as **Visual Comfort Mode** rather than medical claims about blue-light protection.

---

# 22. Session Time Budget

Optional but recommended.

Parent can configure:

```text
Today's KidQ Time = 30 minutes
```

When the session limit is reached, KidQ can end the viewing session instead of automatically pushing another video.

---

# 23. Queue-Based Processing

Content analysis should be asynchronous / queue-based.

```text
URL Submitted
      ↓
Content Record Created
      ↓
QUEUED
      ↓
ANALYSING
      ↓
ASSESSED
```

Possible states:

```text
QUEUED
ANALYSING
ASSESSED
NEEDS_REVIEW
ANALYSIS_INCOMPLETE
FAILED
```

For MVP, a simple database-backed job queue is enough.

---

# 24. Parent-Submitted Content

```text
Parent submits URL
      ↓
Validate
      ↓
Duplicate check
      ↓
Create content record
      ↓
Add to analysis queue
      ↓
Show: Assessment Pending
      ↓
Analysis completes
      ↓
Show KidQ Score + breakdown
      ↓
Parent can Keep / Remove
```

Do not block the parent UI waiting for analysis.

---

# 25. Analysis Confidence

Every KidQ Score can have an analysis confidence.

Example:

```text
KidQ Score: 82/100
Confidence: 55%

Visual analysis unavailable.
```

---

# 26. Technical Constraint

Do not architect KidQ assuming every arbitrary public YouTube URL will always provide:

- full transcript
- downloadable video
- downloadable audio

Build the analysis pipeline with fallbacks.

```text
Transcript available?
YES → Analyse transcript
NO  → Mark transcript unavailable

Media analysis available?
YES → Analyse video/audio
NO  → Mark visual/audio analysis unavailable
```

The architecture should support richer analysis later without changing the Content model.

---

# 27. MVP Scope

## MVP

Build:

- Content table
- Admin content upload
- 200–300 manually curated URLs
- Duplicate detection
- Analysis queue
- Transcript analysis where available
- KidQ scoring structure
- Hard safety flags
- Admin review / approval
- Content tagging
- Parent onboarding
- Recommendation filtering
- Recommendation ranking
- Parent Add / Remove
- Parent-approved library
- Activity database
- Activity admin
- Break rules
- Automatic breakpoints
- Session timer
- Orange KidQ break agent

## Later Phase

Add:

- advanced shot detection
- automated visual intensity analysis
- advanced audio analysis
- automatic breakpoint placement at natural scene boundaries
- recommendation learning from parent behaviour
- more expert reviewers
- personalized break frequency
- child interaction signals
- improved ranking models

---

# 28. Suggested Implementation Order

```text
STEP 1  Create Content data model
STEP 2  Create Admin Content Library
STEP 3  Implement Content ingestion + queue
STEP 4  Implement transcript / metadata analysis
STEP 5  Implement scoring + safety rules
STEP 6  Implement Admin approval
STEP 7  Implement content classification / tagging
STEP 8  Implement Parent onboarding profile
STEP 9  Implement approved-content recommendation filtering
STEP 10 Implement ranking
STEP 11 Implement Parent Add / Remove library
STEP 12 Create Activity database
STEP 13 Create Activity Admin
STEP 14 Create global Break Rules
STEP 15 Implement automatic content + session breakpoints
STEP 16 Integrate Orange KidQ Agent
STEP 17 Implement child playback + resume flow
STEP 18 Add analytics and tune scoring / ranking
```

---

# 29. Final Architecture Summary

```text
CURATED CONTENT
      +
PARENT-SUBMITTED CONTENT
          ↓
     INGESTION QUEUE
          ↓
    CONTENT ANALYSIS
          ↓
     SAFETY CHECK
          ↓
      KIDQ SCORE
          ↓
     ADMIN REVIEW
          ↓
   ADMIN APPROVAL
          ↓
CONTENT CLASSIFICATION
          ↓
 PARENT ONBOARDING
          ↓
RECOMMENDATION MATCHING
          ↓
     PARENT REVIEW
          ↓
 PARENT-APPROVED LIBRARY
          ↓
      KIDQ PLAYER
          ↓
 CONTENT + SESSION TIMER
          ↓
 AUTOMATIC BREAKPOINT
          ↓
   ORANGE KIDQ AGENT
          ↓
 EYE / MOVEMENT ACTIVITY
          ↓
         RESUME
```

## Core KidQ Principle

**KidQ does not directly recommend arbitrary internet content.**

The system first:

**Analyses → Scores → Admin Approves → Categorizes → Matches → Parent Approves → Child Watches**
