import dns from "node:dns";

dns.setDefaultResultOrder("ipv4first");

type GitHubRequestOptions = {
  accept?: string;
  retries?: number;
  timeoutMs?: number;
};

const BASE_HEADERS = {
  "User-Agent": "Sentinel-OSS",
} as const;

function getAuthToken() {
  return process.env.GITHUB_TOKEN?.trim() || "";
}

function getHeaders(includeAuth: boolean) {
  const token = includeAuth ? getAuthToken() : "";
  if (!token) {
    return { ...BASE_HEADERS } as Record<string, string>;
  }

  return {
    ...BASE_HEADERS,
    Authorization: `Bearer ${token}`,
  } as Record<string, string>;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryDelayMs(response: Response, fallbackMs: number) {
  const retryAfter = Number(response.headers.get("retry-after") || "0");
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(30_000, retryAfter * 1000);
  }

  const resetAt = Number(response.headers.get("x-ratelimit-reset") || "0");
  if (Number.isFinite(resetAt) && resetAt > 0) {
    const wait = Math.max(1000, (resetAt - Math.floor(Date.now() / 1000) + 1) * 1000);
    return Math.min(30_000, wait);
  }

  return fallbackMs;
}

async function githubFetch(url: string, options: GitHubRequestOptions = {}) {
  const retries = options.retries ?? 5;
  const timeoutMs = options.timeoutMs ?? 20_000;
  let backoffMs = 2000;
  const hasAuthToken = Boolean(getAuthToken());

  for (let attempt = 0; attempt <= retries; attempt++) {
    let response = await fetch(url, {
      headers: {
        ...getHeaders(true),
        Accept: options.accept || "application/vnd.github+json",
      } as HeadersInit,
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (response.status === 401 && hasAuthToken) {
      response = await fetch(url, {
        headers: {
          ...getHeaders(false),
          Accept: options.accept || "application/vnd.github+json",
        } as HeadersInit,
        signal: AbortSignal.timeout(timeoutMs),
      });
    }

    if (response.ok) return response;

    const isRateLimited = response.status === 429 || response.status === 403;
    if (attempt < retries && isRateLimited) {
      const remaining = Number(response.headers.get("x-ratelimit-remaining") || "1");
      if (response.status === 429 || remaining === 0 || response.status === 403) {
        // 403 with remaining > 0 is often GitHub secondary rate limiting.
        const waitMs = getRetryDelayMs(response, Math.max(backoffMs, 10_000));
        await sleep(waitMs);
        backoffMs = Math.min(60_000, backoffMs * 2);
        continue;
      }
    }

    throw new Error(`GitHub request failed ${response.status} for ${url}`);
  }

  throw new Error(`GitHub request failed after retries for ${url}`);
}

async function githubJson<T = any>(url: string, options: GitHubRequestOptions = {}) {
  const response = await githubFetch(url, options);
  return response.json() as Promise<T>;
}

async function githubText(url: string, options: GitHubRequestOptions = {}) {
  const response = await githubFetch(url, options);
  return response.text();
}

export const githubServices = {
  async searchRepository(query: string) {
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&per_page=10`;
    const data = await githubJson<any>(url);

    return (data.items || []).map((repo: any) => ({
      id: repo.id,
      owner: repo.owner.login,
      name: repo.name,
      full_name: repo.full_name,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      language: repo.language,
      open_issues: repo.open_issues_count,
      description: repo.description,
    }));
  },

  async getRepoOverviewData(owner: string, name: string) {
    const url = `https://api.github.com/repos/${owner}/${name}`;
    return githubJson<any>(url);
  },

  async getBranchHeadSha(owner: string, name: string, branch: string) {
    const url = `https://api.github.com/repos/${owner}/${name}/commits/${encodeURIComponent(branch)}`;
    const data = await githubJson<any>(url);
    return String(data.sha || "");
  },

  async getRepoTree(owner: string, name: string, branch: string) {
    const url = `https://api.github.com/repos/${owner}/${name}/git/trees/${branch}?recursive=1`;
    return githubJson<any>(url);
  },

  async getRepoIssues(owner: string, name: string, options?: { since?: string | null }) {
    const perPage = 100;
    const allIssues: any[] = [];

    for (let page = 1; page <= 3; page++) {
      const url = new URL(`https://api.github.com/repos/${owner}/${name}/issues`);
      url.searchParams.set("state", "all");
      url.searchParams.set("per_page", String(perPage));
      url.searchParams.set("page", String(page));
      url.searchParams.set("sort", "updated");
      url.searchParams.set("direction", "desc");

      if (options?.since) {
        url.searchParams.set("since", options.since);
      }

      const pageItems = await githubJson<any[]>(url.toString());
      if (!Array.isArray(pageItems) || pageItems.length === 0) break;

      allIssues.push(...pageItems);
      if (pageItems.length < perPage) break;
    }

    return allIssues;
  },

  async getFileContent(owner: string, name: string, path: string) {
    const url = `https://api.github.com/repos/${owner}/${name}/contents/${path}`;
    return githubText(url, { accept: "application/vnd.github.v3.raw" });
  },

  async getFileImportsAndUrls(owner: string, name: string, path: string) {
    const url = `https://api.github.com/repos/${owner}/${name}/contents/${path}`;
    const content = await githubText(url, { accept: "application/vnd.github.v3.raw" });

    const importRegex = /(?:import|from|require)\s*\(?\s*[`'"]([./][^`'"]+)[`'"]/g;
    const urlRegex = /[`'"](\/[^`'"]+)[`'"]/g;

    const imports = new Set<string>();
    const urls = new Set<string>();

    let match: RegExpExecArray | null;
    while ((match = importRegex.exec(content)) !== null) {
      imports.add(match[1]);
    }
    while ((match = urlRegex.exec(content)) !== null) {
      const foundPath = match[1];
      const isTrash = /^[\/\-\s=_]+$/.test(foundPath);

      if (!imports.has(foundPath) && foundPath !== "/" && !isTrash) {
        urls.add(foundPath);
      }
    }

    return {
      content,
      imports: Array.from(imports),
      urls: Array.from(urls),
    };
  },
};
