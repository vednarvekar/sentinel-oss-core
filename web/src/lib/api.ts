const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4004";

type ApiEnvelope<T> = {
  status: "ready" | "processing" | "error";
  source?: string;
  data?: T;
  count?: number;
  error?: string;
};

function normalizeText(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, "\"")
    .trim();
}

function titleCase(input: string) {
  return input
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function objectToMarkdown(value: unknown, depth = 0): string {
  if (value == null) return "";
  if (typeof value === "string") return normalizeText(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        const rendered = objectToMarkdown(item, depth + 1);
        if (!rendered) return "";
        const lines = rendered.split("\n");
        return [`- ${lines[0]}`, ...lines.slice(1).map((l) => `  ${l}`)].join("\n");
      })
      .filter(Boolean)
      .join("\n");
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const entries = Object.entries(obj);
    if (!entries.length) return "";

    const isTop = depth === 0;
    return entries
      .map(([k, v]) => {
        const rendered = objectToMarkdown(v, depth + 1);
        if (!rendered) return "";
        if (isTop) return `### ${titleCase(k)}\n${rendered}`;
        return `- **${titleCase(k)}**: ${rendered}`;
      })
      .filter(Boolean)
      .join(isTop ? "\n\n" : "\n");
  }
  return "";
}

function prettifyLlmField(input?: string | null): string | null {
  if (!input) return input ?? null;
  const text = normalizeText(input);
  if (!text) return text;

  if ((text.startsWith("{") && text.endsWith("}")) || (text.startsWith("[") && text.endsWith("]"))) {
    try {
      const parsed = JSON.parse(text);
      const md = objectToMarkdown(parsed);
      return md || text;
    } catch {
      return text;
    }
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = text.slice(firstBrace, lastBrace + 1);
    try {
      const parsed = JSON.parse(candidate);
      const md = objectToMarkdown(parsed);
      if (md) return md;
    } catch {
      // ignore
    }
  }

  return text;
}

export type RepoSearchItem = {
  id: number;
  owner: string;
  name: string;
  full_name: string;
  stars: number;
  forks?: number;
  language?: string | null;
  open_issues?: number;
  description: string | null;
};

export type RepoRecord = {
  id: string;
  owner: string;
  name: string;
  default_branch: string;
  ingested_at: string | null;
  last_head_sha?: string | null;
  last_tree_sha?: string | null;
};

export type IssueRecord = {
  id: number;
  repo_id: string;
  number: number;
  title: string;
  body: string | null;
  state: string;
  labels: Array<{ name: string; color: string }>;
  created_at: string;
  updated_at: string;
};

export type IssueAnalysisRecord = {
  issue_id: number;
  likely_paths: Array<{
    path: string;
    score: number;
    signals: string[];
    snippet: string | null;
  }>;
  difficulty: string;
  confidence_score: number;
  explanation: string;
  root_analysis?: string | null;
  possible_solution?: string | null;
  ai_summary?: string | null;
  graph_data?: {
    nodes: Array<{ id: string; label: string; rank?: number; score?: number; group?: string }>;
    edges: Array<{ source: string; target: string; label?: string }>;
  } | null;
  analyzed_at: string;
};

export type RepoGraphRecord = {
  nodes: Array<{ id: string; label: string; group?: string }>;
  edges: Array<{ source: string; target: string; label?: string }>;
};

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || `Request failed (${response.status})`);
  }

  return data as T;
}

export async function searchRepos(query: string) {
  return getJson<ApiEnvelope<RepoSearchItem[]>>(`/repos/search?q=${encodeURIComponent(query)}`);
}

export async function getRepo(owner: string, name: string) {
  return getJson<ApiEnvelope<RepoRecord | null>>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`);
}

export async function getRepoIssues(owner: string, name: string) {
  return getJson<ApiEnvelope<IssueRecord[]>>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/issues`);
}

export async function getIssueAnalysis(issueId: string, options?: { refresh?: boolean }) {
  const query = options?.refresh ? "?refresh=1" : "";
  const result = await getJson<ApiEnvelope<IssueAnalysisRecord>>(`/issues/${encodeURIComponent(issueId)}/analysis${query}`);
  if (result.status === "ready" && result.data) {
    result.data.root_analysis = prettifyLlmField(result.data.root_analysis);
    result.data.possible_solution = prettifyLlmField(result.data.possible_solution);
    result.data.ai_summary = prettifyLlmField(result.data.ai_summary);
  }
  return result;
}

export async function getIssue(issueId: string) {
  return getJson<ApiEnvelope<IssueRecord>>(`/issues/${encodeURIComponent(issueId)}`);
}

export async function getRepoGraph(repoId: string) {
  return getJson<ApiEnvelope<RepoGraphRecord>>(`/repos/${encodeURIComponent(repoId)}/graph`);
}

export async function pollUntilReady<T>(
  fn: () => Promise<ApiEnvelope<T>>,
  options: { intervalMs?: number; maxAttempts?: number } = {}
) {
  const intervalMs = options.intervalMs ?? 1200;
  const maxAttempts = options.maxAttempts ?? 15;

  let last: ApiEnvelope<T> | null = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = await fn();
    last = result;
    if (result.status === "ready") return result;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return last;
}
