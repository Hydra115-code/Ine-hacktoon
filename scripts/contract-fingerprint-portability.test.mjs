import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  normalizeContractSource as normalizeBackendSource,
  updateContractHash as updateBackendHash,
} from "../back-end/packages/contracts/scripts/contract-fingerprint-utils.mjs";
import {
  normalizeContractSource as normalizeFrontendSource,
  updateContractHash as updateFrontendHash,
} from "../front-end/packages/contracts/scripts/contract-fingerprint-utils.mjs";

const lfSource = "export const version = 1;\nexport const ready = true;\n";
const crlfSource = lfSource.replace(/\n/gu, "\r\n");
const crSource = lfSource.replace(/\n/gu, "\r");

function fingerprint(updateHash, source) {
  const hash = createHash("sha256");
  updateHash(hash, "index.ts", source);
  return hash.digest("hex");
}

test("backend genera el mismo fingerprint con LF, CRLF o CR", () => {
  assert.equal(normalizeBackendSource(crlfSource), lfSource);
  assert.equal(normalizeBackendSource(crSource), lfSource);
  assert.equal(fingerprint(updateBackendHash, crlfSource), fingerprint(updateBackendHash, lfSource));
  assert.equal(fingerprint(updateBackendHash, crSource), fingerprint(updateBackendHash, lfSource));
});

test("frontend genera el mismo fingerprint con LF, CRLF o CR", () => {
  assert.equal(normalizeFrontendSource(crlfSource), lfSource);
  assert.equal(normalizeFrontendSource(crSource), lfSource);
  assert.equal(fingerprint(updateFrontendHash, crlfSource), fingerprint(updateFrontendHash, lfSource));
  assert.equal(fingerprint(updateFrontendHash, crSource), fingerprint(updateFrontendHash, lfSource));
});
