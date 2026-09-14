import { mkdir, appendFile, readFile } from "node:fs/promises";
import path from "node:path";
import type { KidqContentRecord } from "../types/content";

const dataDirectory = path.resolve(process.env.KIDQ_DATA_DIR || "data");
const contentFile = path.join(dataDirectory, "content.jsonl");

export async function saveContent(records: KidqContentRecord[]) {
  if (records.length === 0) return;
  await mkdir(dataDirectory, { recursive: true });
  await appendFile(contentFile, records.map((record) => JSON.stringify(record)).join("\n") + "\n", "utf8");
}

/** Reads every content record ever discovered/seeded — callers filter by status/age/category themselves. */
export async function readAllContent(): Promise<KidqContentRecord[]> {
  try {
    const raw = await readFile(contentFile, "utf8");
    return raw
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as KidqContentRecord);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}
