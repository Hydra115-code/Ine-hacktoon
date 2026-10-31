export function normalizeContractSource(source) {
  return source.replace(/\r\n?/gu, "\n");
}

export function updateContractHash(hash, relativePath, source) {
  hash.update(relativePath);
  hash.update("\0");
  hash.update(normalizeContractSource(source));
  hash.update("\0");
}
