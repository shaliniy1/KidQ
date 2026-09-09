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
The human-controlled decision that makes a content item approved, rejected, or pending manual review.
_Avoid_: AI status, safety score
