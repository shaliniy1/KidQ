import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    env: {
      NODE_ENV: "test",
      AUTH_MODE: "dev",
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgresql://localhost:5432/kidq_test",
      RUN_WORKER_IN_PROCESS: "false",
    },
    // Integration tests share one database, so files run one at a time.
    fileParallelism: false,
  },
});
