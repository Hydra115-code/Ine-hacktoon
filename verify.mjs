#!/usr/bin/env node
try {
  await import("./scripts/verify-all.mjs");
} catch (error) {
  console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
