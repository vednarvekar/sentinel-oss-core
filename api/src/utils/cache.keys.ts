export const CacheTtlSeconds = {
  repoSearch: 300,
  repoIngestLock: 300,
  repoIngestFailure: 90,
  issueIngestLock: 300,
  issueAnalysis: 300,
} as const;

export const cacheKeys = {
  repoSearch: (query: string) => `repo:search:${query.trim().toLowerCase()}`,
  repoIngestLock: (owner: string, name: string) => `repo:ingest:lock:${owner}:${name}`,
  repoIngestFailure: (owner: string, name: string) => `repo:ingest:failed:${owner}:${name}`,
  issueIngestLock: (owner: string, name: string) => `issue:ingest:lock:${owner}:${name}`,
  issueAnalysis: (issueId: string | number) => `issue:analysis:${issueId}`,
};
