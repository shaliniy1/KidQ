import { closePool, getPool } from "../src/db/pool";
import { runMigrations } from "../src/db/migrate";

runMigrations(getPool())
  .then(() => console.log("migrations up to date"))
  .catch((error: Error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(closePool);
