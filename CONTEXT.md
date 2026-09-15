# KidQ Content Curation

KidQ discovers external children's content, evaluates it against KidQ's standards, and publishes only material approved for children aged birth to six.

## Language

**Source System**:
An external platform or collection from which KidQ discovers content metadata, such as YouTube, NASA, or Wikimedia Commons.
_Avoid_: Provider, scraper

**Source Record**:
The metadata observed for one external item during an ingestion run. It preserves provenance without becoming KidQ's canonical content entry.
_Avoid_: Raw content, scraped content

**Content Item**:
KidQ's canonical record for one video, activity, storybook, or interactive experience, independent of where it was discovered.
_Avoid_: Video record, database content

**Ingestion Run**:
One traceable attempt to discover or refresh source records using a particular connector and query.
_Avoid_: Scrape, import job

**Transcript**:
Text obtained through a permitted caption, transcript, or transcription mechanism, stored with its origin and usage rights.
_Avoid_: Captions, script

**Rights Assertion**:
The evidence KidQ has collected about whether an item may be embedded, copied, transcribed, adapted, and attributed.
_Avoid_: License flag

**Assessment**:
A versioned evaluation of a content item against KidQ criteria, with evidence and the identity of the human or model that performed it.
_Avoid_: Score, AI approval

**Publication Decision**:
The decision that makes a content item approved, rejected, or pending manual review. Only an admin approves; KidQ Checks may reject or unpublish, and an admin can reverse that.
_Avoid_: AI status, safety score

**Content Score** (KidQ Score):
The 0–100 summary of how calm and safe an item is, computed from its latest assessments — content & language, pacing, visual comfort and audio comfort — with a confidence figure and a reason. A failed check caps the part it's about. It shows how KidQ evaluated the item; it is never an approval.
_Avoid_: AI approval, safety score

**Learning Value**:
A 0–100 measure of what a child can learn or do from an item — thinking, language, feelings & friends, doing — from its filter-in criteria. Kept apart from the Content Score; ranking uses both.
_Avoid_: educational score

**Pre-screen**:
The pull-time check that drops a discovered item before it's stored when its title or length shows it isn't for children aged 0–6 (a trailer, agency news, a clip under 15 seconds).
_Avoid_: filter, blocklist

**KidQ Checks**:
The step after an AI review that rejects an item — or unpublishes a live one — when the AI or an admin confirmed a safety problem or an exclusion, or its Content Score is under 60. Recorded as a SYSTEM publication decision any admin can reverse.
_Avoid_: auto-reject, AI rejection

**Scoring Agent**:
The AI model call that watches a video and proposes component scores, rubric results and tags. Its output is recorded as a MODEL assessment that an admin can override.
_Avoid_: AI reviewer decision

**Studio State**:
What an admin sees for an item, derived from its analysis and publication status: Draft, Ready to publish, Needs changes, Published or Rejected.
_Avoid_: content status

**Taxonomy Term**:
A key from the shared vocabulary — category, interest, development goal, regulation goal, language or age group — used by admin tagging, AI suggestions and parent onboarding alike.
_Avoid_: tag string, label

**Child Profile**:
A parent's onboarding answers for one child: a nickname and an age band, plus any "Customize" choices (interests, content mix, regulation goals, session length and breaks, languages). Anything not chosen follows from the child's age. The input to recommendations.
_Avoid_: user profile, account

**Parent Profile**:
The signed-in parent's name and chosen language, created at onboarding. Their child profiles belong to it.
_Avoid_: account, user

**Recommendation**:
An admin-approved content item ranked for one child profile, with the reasons it matched.
_Avoid_: feed item, suggestion

**Library Item**:
A parent's choice about a content item for one child: added, requested (awaiting admin approval), dismissed or removed. Only added, approved items are playable.
_Avoid_: favourite, playlist entry

**Play**:
One playback of one video or activity by one child, from start to exit; watching again is a new play. Analytics count times watched, completion and screen time per play.
_Avoid_: view, session

**Screen Time**:
Minutes a video was actually playing on screen: never paused, buffering, in a hidden tab or idle. Activity time is reported apart from it.
_Avoid_: session length, time in app

**Parent Category**:
One of the seven groups parents choose from (Stories & Rhymes, Songs & Music, Numbers & Thinking, Our World, Art & Making, Move & Play, Calm & Breathe). Each rolls up admin categories, which admins and the AI keep tagging.
_Avoid_: content type, genre

**Session Mode**:
How a session is shaped by time of day: Auto (India's clock decides) or a Morning, Daytime or Bedtime override the parent picked, remembered per child. Items carry the modes they suit, tagged once by the AI.
_Avoid_: profile, playlist
