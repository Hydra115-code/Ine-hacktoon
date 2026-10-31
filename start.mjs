#!/usr/bin/env node
try {
  await import("./scripts/start-local.mjs");
} catch (error) {
  console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
