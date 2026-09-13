// One-off re-curation for scoring v2 (docs/recommendation/README.md "Re-curating the library"):
// pre-screens every stored item, puts its categories right, rescores it under the active scoring
// version and queues the AI to review it again with the current prompt. Dry run by default: it
// prints what would change.
//   npm run recurate -w api             # dry run
//   npm run recurate -w api -- --apply  # make the changes
import { PROMPT_VERSION } from "../src/ai/scoring-agent";
import type { DiscoveryHints } from "../src/connectors/types";
import { closePool, getPool, withTransaction } from "../src/db/pool";
import { prescreen } from "../src/domain/analysis/prescreen";
import { MAX_CATEGORIES, suggestCategories } from "../src/domain/analysis/rules";
import { recordDecision } from "../src/repositories/decisions";
import { enqueueJob } from "../src/repositories/jobs";
import { keysOf, listTaxonomy } from "../src/repositories/taxonomy";
import { rescoreItem } from "../src/services/scoring";

const apply = process.argv.includes("--apply");

interface Item {
  id: string;
  title: string;
  description: string | null;
  keywords: string[] | null;
  content_type: string;
  duration_seconds: number | null;
  category: string | null;
  categories: string[];
  classification_source: string | null;
  current_status: string;
  source: string;
  /** Found by a discovery search; links an admin or a parent added skip the pre-screen. */
  discovered: boolean;
  hints: DiscoveryHints | null;
  reviewed_now: boolean;
}

const same = (a: string[], b: string[]) => a.length === b.length && a.every((key, index) => key === b[index]);
const cell = (text: string, width: number) => (text.length > width ? `${text.slice(0, width - 1)}…` : text.padEnd(width));

async function main() {
  const pool = getPool();
  const activeCategories = keysOf(await listTaxonomy(pool), "category");
  const { rows } = await pool.query<Item>(
    `SELECT ci.id, ci.title, ci.description, ci.keywords, ci.content_type, ci.duration_seconds, ci.category, ci.categories,
       ci.classification_source, ci.current_status, sr.source_system_id AS source,
       COALESCE(ir.query->>'mode' = 'search', false) AS discovered,
       (SELECT o.payload->'hints' FROM outbox_events o
        WHERE o.aggregate_id = ci.id AND o.event_type = 'ANALYZE' AND o.payload ? 'hints' ORDER BY o.created_at LIMIT 1) AS hints,
       EXISTS (SELECT 1 FROM assessments a WHERE a.content_item_id = ci.id AND a.assessor_type = 'MODEL' AND a.prompt_version = $1) AS reviewed_now
     FROM content_items ci
     JOIN LATERAL (SELECT * FROM source_records WHERE content_item_id = ci.id ORDER BY fetched_at DESC LIMIT 1) sr ON true
     LEFT JOIN ingestion_runs ir ON ir.id = sr.ingestion_run_id
     ORDER BY sr.source_system_id, ci.title`,
    [PROMPT_VERSION],
  );

  const plan = rows.map((item) => {
    const screen = item.discovered
      ? prescreen({ contentType: item.content_type, title: item.title, description: item.description, tags: item.keywords ?? [], durationSeconds: item.duration_seconds })
      : ({ ok: true } as const);
    const current = (item.categories.length ? item.categories : item.category ? [item.category] : []).filter((key) => activeCategories.includes(key));
    const hints: DiscoveryHints = { ...(item.hints ?? {}) };
    if (hints.category && !activeCategories.includes(hints.category)) delete hints.category;
    let next: string[];
    if (item.classification_source === "HUMAN" || item.classification_source === "MODEL") {
      // An admin's or the AI's choice stays; a picture book still gets Storybooks first.
      next = item.content_type === "STORYBOOK" ? ["storybooks", ...current.filter((key) => key !== "storybooks")] : current.filter((key) => key !== "storybooks");
    } else {
      const suggested = suggestCategories(
        { title: item.title, description: item.description, tags: item.keywords ?? [], language: null, contentType: item.content_type, source: item.source },
        hints,
      );
      next = suggested.length ? suggested : current;
    }
    next = next.slice(0, MAX_CATEGORIES);
    const live = item.current_status !== "REJECTED";
    return {
      item,
      screen,
      current,
      next,
      hints,
      recategorise: !same(current, next),
      takeDown: live && !screen.ok,
      queue: live && screen.ok && !item.reviewed_now,
    };
  });

  console.log(`${cell("SOURCE", 18)} ${cell("CATEGORIES BEFORE → AFTER", 48)} ${cell("PRE-SCREEN", 34)} TITLE`);
  for (const entry of plan) {
    const categories = `${entry.current.join("+") || "-"} → ${entry.next.join("+") || "-"}${entry.recategorise ? " *" : ""}`;
    const screen = entry.screen.ok ? "ok" : entry.screen.reason.replace("Pre-screen: ", "reject: ");
    console.log(`${cell(entry.item.source, 18)} ${cell(categories, 48)} ${cell(screen, 34)} ${entry.item.title}`);
  }
  const count = (key: "recategorise" | "takeDown" | "queue") => plan.filter((entry) => entry[key]).length;
  console.log(
    `\n${count("takeDown")} to take down, ${count("recategorise")} to re-categorise (*), ${count("queue")} to queue for AI prompt v${PROMPT_VERSION}, ${plan.length} to rescore.`,
  );
  if (!apply) {
    console.log("Dry run: nothing changed. Re-run with -- --apply to make these changes.");
    return;
  }

  for (const entry of plan) {
    await withTransaction(async (client) => {
      if (entry.takeDown && !entry.screen.ok) {
        await recordDecision(client, entry.item.id, {
          // A published item goes back to review; anything else is rejected. An admin can restore either.
          decision: entry.item.current_status === "APPROVED" ? "MANUAL_REVIEW_REQUIRED" : "REJECTED",
          reason: `KidQ checks: ${entry.screen.reason}`,
          decidedBy: "kidq-checks",
          source: "SYSTEM",
        });
      }
      if (entry.recategorise) {
        await client.query("UPDATE content_items SET category = $2, categories = $3, updated_at = now() WHERE id = $1", [entry.item.id, entry.next[0] ?? null, entry.next]);
      }
      await rescoreItem(client, entry.item.id);
    });
  }

  // Published items first, then the rest shortest first, so the free daily quota goes where parents look.
  const published = (entry: (typeof plan)[number]) => Number(entry.item.current_status === "APPROVED");
  const queue = plan
    .filter((entry) => entry.queue)
    .sort((a, b) => published(b) - published(a) || (a.item.duration_seconds ?? Infinity) - (b.item.duration_seconds ?? Infinity));
  for (const entry of queue) {
    await pool.query("UPDATE content_items SET analysis_status = 'QUEUED', updated_at = now() WHERE id = $1", [entry.item.id]);
    await enqueueJob(pool, {
      type: "ANALYZE",
      aggregateType: "content_item",
      aggregateId: entry.item.id,
      payload: { force: true, hints: entry.hints },
      priority: published(entry) ? 5 : 0,
      dedupeKey: `analyze:${entry.item.id}`,
    });
  }
  console.log(`Applied. ${queue.length} item(s) queued for the AI; a running worker scores them within the free daily limit.`);
}

main()
  .catch((error: Error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(closePool);
