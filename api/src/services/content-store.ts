import { mkdir, appendFile } from "node:fs/promises";
import path from "node:path";
import type { KidqContentRecord } from "../types/content";

const dataDirectory = path.resolve(process.env.KIDQ_DATA_DIR || "data");
const contentFile = path.join(dataDirectory, "content.jsonl");

export async function saveContent(records: KidqContentRecord[]) {
  if (records.length === 0) return;
  await mkdir(dataDirectory, { recursive: true });
  await appendFile(contentFile, records.map((record) => JSON.stringify(record)).join("\n") + "\n", "utf8");
}
