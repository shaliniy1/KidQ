// Writes api/openapi.json — the contract both UIs generate typed clients from.
// `--check` fails when the committed file is stale, so contract changes show up in review (CI).
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createApp } from "../src/app";
import { buildOpenApiDocument } from "../src/http/route";

async function main() {
  createApp(); // registers every route with the OpenAPI registry
  const target = path.resolve(__dirname, "../openapi.json");
  const json = `${JSON.stringify(buildOpenApiDocument(), null, 2)}\n`;
  if (process.argv.includes("--check")) {
    const current = await readFile(target, "utf8").catch(() => "");
    if (current !== json) {
      console.error("api/openapi.json is out of date. Run: npm run openapi:write -w api");
      process.exitCode = 1;
      return;
    }
    console.log("api/openapi.json is up to date");
    return;
  }
  await writeFile(target, json);
  console.log(`wrote ${target}`);
}

void main();
