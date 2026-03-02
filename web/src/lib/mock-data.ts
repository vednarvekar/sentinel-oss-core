import { Star, GitFork, Eye, AlertCircle } from "lucide-react";

export interface MockRepo {
  id: number;
  full_name: string;
  owner: string;
  name: string;
  description: string;
  stars: number;
  forks: number;
  watchers: number;
  language: string;
  open_issues: number;
  topics: string[];
  updated_at: string;
}

export interface MockIssue {
  id: string;
  number: number;
  title: string;
  state: "open" | "closed";
  labels: { name: string; color: string }[];
  created_at: string;
  updated_at: string;
  author: string;
  comments: number;
  difficulty: "easy" | "medium" | "hard";
  ai_summary: string;
  body: string;
}

export interface MockAnalysis {
  issue_id: string;
  issue_title: string;
  issue_number: number;
  issue_body: string;
  root_cause: string;
  file_map: { path: string; relevance: number; reason: string }[];
  proposed_fix: string;
  difficulty: "easy" | "medium" | "hard";
  risk_score: number;
  status: "ready" | "processing";
}

export const mockRepos: MockRepo[] = [
  {
    id: 1,
    full_name: "facebook/react",
    owner: "facebook",
    name: "react",
    description: "The library for web and native user interfaces.",
    stars: 224000,
    forks: 45800,
    watchers: 6700,
    language: "JavaScript",
    open_issues: 950,
    topics: ["javascript", "ui", "frontend", "declarative", "component"],
    updated_at: "2025-12-01",
  },
  {
    id: 2,
    full_name: "vercel/next.js",
    owner: "vercel",
    name: "next.js",
    description: "The React Framework for the Web.",
    stars: 126000,
    forks: 26900,
    watchers: 1400,
    language: "JavaScript",
    open_issues: 2800,
    topics: ["react", "nextjs", "ssr", "static", "framework"],
    updated_at: "2025-11-28",
  },
  {
    id: 3,
    full_name: "denoland/deno",
    owner: "denoland",
    name: "deno",
    description: "A modern runtime for JavaScript and TypeScript.",
    stars: 97000,
    forks: 5400,
    watchers: 1200,
    language: "Rust",
    open_issues: 1700,
    topics: ["deno", "typescript", "runtime", "rust", "v8"],
    updated_at: "2025-11-30",
  },
];

export const mockIssues: MockIssue[] = [
  {
    id: "issue-1",
    number: 28374,
    title: "useEffect cleanup runs twice in StrictMode",
    state: "open",
    labels: [
      { name: "bug", color: "d73a4a" },
      { name: "good first issue", color: "7057ff" },
    ],
    created_at: "2025-11-15",
    updated_at: "2025-11-28",
    author: "dev-user-42",
    comments: 12,
    difficulty: "medium",
    ai_summary: "StrictMode intentionally double-invokes effects for development safety checks, but this causes confusion when cleanup functions have side effects on external systems.",
    body: "## Bug Report\n\nWhen using `useEffect` with a cleanup function in React 18's StrictMode, the cleanup runs twice on mount. This causes issues when interacting with external APIs that don't support idempotent cleanup operations.\n\n### Steps to Reproduce\n1. Create a component with useEffect\n2. Add a cleanup function that calls an external API\n3. Wrap in StrictMode\n4. Observe double cleanup invocation",
  },
  {
    id: "issue-2",
    number: 28401,
    title: "Concurrent rendering causes stale closure in event handlers",
    state: "open",
    labels: [
      { name: "bug", color: "d73a4a" },
      { name: "Component: Hooks", color: "c2e0f0" },
    ],
    created_at: "2025-11-20",
    updated_at: "2025-12-01",
    author: "react-contributor",
    comments: 8,
    difficulty: "hard",
    ai_summary: "Event handlers capture stale closures during concurrent rendering transitions, leading to UI state inconsistencies when rapid user interactions occur.",
    body: "## Description\n\nDuring concurrent rendering transitions, event handlers may capture stale closures leading to unexpected behavior.",
  },
  {
    id: "issue-3",
    number: 28455,
    title: "Missing TypeScript types for new cache() API",
    state: "open",
    labels: [
      { name: "good first issue", color: "7057ff" },
      { name: "TypeScript", color: "2b7489" },
    ],
    created_at: "2025-11-25",
    updated_at: "2025-11-29",
    author: "ts-enthusiast",
    comments: 3,
    difficulty: "easy",
    ai_summary: "The newly introduced cache() API lacks proper TypeScript type definitions, causing type errors in TS projects.",
    body: "## Feature Request\n\nThe new `cache()` API needs TypeScript definitions.",
  },
  {
    id: "issue-4",
    number: 28490,
    title: "Memory leak in Suspense boundary with streaming SSR",
    state: "open",
    labels: [
      { name: "bug", color: "d73a4a" },
      { name: "Suspense", color: "fbca04" },
    ],
    created_at: "2025-11-27",
    updated_at: "2025-12-01",
    author: "ssr-expert",
    comments: 15,
    difficulty: "hard",
    ai_summary: "Suspense boundaries in streaming SSR accumulate detached DOM nodes when fallback content is rapidly replaced, leading to gradual memory growth.",
    body: "## Critical Bug\n\nMemory leak detected in Suspense boundary during streaming SSR.",
  },
];

export const mockAnalysis: MockAnalysis = {
  issue_id: "issue-1",
  issue_title: "useEffect cleanup runs twice in StrictMode",
  issue_number: 28374,
  issue_body: mockIssues[0].body,
  root_cause: `The double invocation of useEffect cleanup in StrictMode is **intentional behavior** introduced in React 18. React deliberately unmounts and remounts components to surface bugs related to missing cleanup logic.

**Why this happens:**
1. React mounts the component and runs the effect
2. React simulates an unmount (runs cleanup)
3. React re-mounts and runs the effect again

This pattern exposes effects that don't properly clean up subscriptions, timers, or external connections. The issue arises when developers interact with **non-idempotent external systems** (payment APIs, analytics, WebSocket connections) where double-calling has real consequences.

**The core problem** is not React's behavior, but the assumption that effects run exactly once. The fix requires making cleanup operations idempotent or implementing guard patterns.`,
  file_map: [
    { path: "packages/react-reconciler/src/ReactFiberHooks.js", relevance: 95, reason: "Core hooks implementation — contains the effect scheduling and cleanup logic" },
    { path: "packages/react-reconciler/src/ReactFiberCommitWork.js", relevance: 88, reason: "Commit phase — where effects are actually invoked and cleaned up" },
    { path: "packages/react/src/ReactStrictMode.js", relevance: 75, reason: "StrictMode configuration that triggers double-invocation" },
    { path: "packages/react-reconciler/src/ReactFiberWorkLoop.js", relevance: 60, reason: "Work loop scheduling — controls when effects are processed" },
  ],
  proposed_fix: `// Implement an idempotent cleanup pattern
useEffect(() => {
  const controller = new AbortController();
  
  // Use AbortController for cancellable operations
  fetchExternalAPI({ signal: controller.signal })
    .then(data => {
      if (!controller.signal.aborted) {
        setState(data);
      }
    });

  return () => {
    // This is now safe to call multiple times
    controller.abort();
  };
}, []);

// For WebSocket/subscription patterns:
useEffect(() => {
  let isActive = true;
  const ws = new WebSocket(url);
  
  ws.onmessage = (event) => {
    if (isActive) handleMessage(event.data);
  };

  return () => {
    isActive = false;
    ws.close(); // Safe to call on already-closed socket
  };
}, [url]);`,
  difficulty: "medium",
  risk_score: 35,
  status: "ready",
};

export const mockOverview = {
  summary: "React is a declarative, efficient, and flexible JavaScript library for building user interfaces. It lets you compose complex UIs from small, isolated pieces of code called \"components\". React's core innovation is the virtual DOM — a programming concept where an ideal representation of the UI is kept in memory and synced with the real DOM through a process called reconciliation.",
  tech_stack: ["JavaScript", "TypeScript", "Flow", "C++", "HTML", "CSS"],
  complexity_score: 87,
  total_files: 4250,
  total_contributors: 1800,
  graph_nodes: [
    { id: "1", label: "ReactFiberHooks.js", group: "reconciler" },
    { id: "2", label: "ReactFiberCommitWork.js", group: "reconciler" },
    { id: "3", label: "ReactDOM.js", group: "dom" },
    { id: "4", label: "ReactFiberWorkLoop.js", group: "reconciler" },
    { id: "5", label: "ReactStrictMode.js", group: "core" },
    { id: "6", label: "ReactElement.js", group: "core" },
    { id: "7", label: "ReactHooks.js", group: "core" },
    { id: "8", label: "ReactDOMComponent.js", group: "dom" },
    { id: "9", label: "Scheduler.js", group: "scheduler" },
    { id: "10", label: "ReactFiberReconciler.js", group: "reconciler" },
  ],
  graph_edges: [
    { source: "1", target: "2" },
    { source: "1", target: "4" },
    { source: "2", target: "3" },
    { source: "3", target: "8" },
    { source: "4", target: "9" },
    { source: "5", target: "6" },
    { source: "6", target: "7" },
    { source: "7", target: "1" },
    { source: "10", target: "1" },
    { source: "10", target: "2" },
    { source: "10", target: "4" },
  ],
};
