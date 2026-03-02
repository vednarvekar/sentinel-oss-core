import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertCircle, Clock3, FileCode, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getRepo, getRepoIssues, type IssueRecord, type RepoRecord } from "@/lib/api";

type Status = "idle" | "processing" | "ready" | "error";

const RepoIssues = () => {
  const { owner = "", name = "" } = useParams();
  const navigate = useNavigate();

  const [repo, setRepo] = useState<RepoRecord | null>(null);
  const [issues, setIssues] = useState<IssueRecord[]>([]);
  const [repoStatus, setRepoStatus] = useState<Status>("idle");
  const [issuesStatus, setIssuesStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!owner || !name) return;

    let mounted = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    const maxAttempts = 80;

    const poll = async () => {
      try {
        attempts += 1;
        if (attempts > maxAttempts) {
          setError("Timed out while waiting for repository indexing. Please retry.");
          return;
        }

        const repoRes = await getRepo(owner, name);
        if (!mounted) return;

        if (repoRes.status === "error") {
          setError(repoRes.error || "Repository ingest failed. Please retry.");
          return;
        }

        setRepoStatus(repoRes.status);
        setRepo(repoRes.data || null);

        if (repoRes.data && repoRes.status === "ready") {
          const issuesRes = await getRepoIssues(owner, name);
          if (!mounted) return;

          setIssuesStatus(issuesRes.status);
          setIssues(issuesRes.data || []);

          if (repoRes.status === "processing" || issuesRes.status === "processing") {
            timer = setTimeout(poll, 1500);
          }
          return;
        }

        if (repoRes.data && repoRes.status === "processing") {
          setIssuesStatus("processing");
        }

        timer = setTimeout(poll, 1500);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to load repository data";
        if (!mounted) return;
        setError(message);
      }
    };

    poll();

    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [owner, name]);

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="glass-card rounded-xl p-5 text-sm text-destructive font-mono">{error}</div>
      </div>
    );
  }

  const isProcessing = repoStatus === "processing" || issuesStatus === "processing";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-mono">{owner}/{name}</h1>
          <p className="text-xs text-muted-foreground font-mono mt-1">
            {isProcessing ? "Indexing updates and syncing issues..." : `${issues.length} open issues`}
          </p>
        </div>
        {isProcessing ? (
          <div className="inline-flex items-center gap-2 rounded-md glass-card px-3 py-1.5 text-xs font-mono text-primary">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Processing
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 rounded-md glass-card px-3 py-1.5 text-xs font-mono text-accent">
            <Clock3 className="h-3.5 w-3.5" />
            Ready
          </div>
        )}
      </div>

      <div className="space-y-3">
        {issues.length === 0 && isProcessing ? (
          <div className="glass-card rounded-xl p-6 text-sm text-muted-foreground font-mono">
            Waiting for issue ingestion...
          </div>
        ) : issues.length === 0 ? (
          <div className="glass-card rounded-xl p-6 text-sm text-muted-foreground font-mono">
            No open issues found.
          </div>
        ) : (
          issues.map((issue) => (
            <button
              key={issue.id}
              onClick={() => navigate(`/issues/${issue.id}/analysis`, { state: { issue } })}
              className="w-full text-left group glass-card rounded-xl p-4 hover:border-primary/30 transition-all"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors font-mono">
                      {issue.title}
                    </h3>
                    <Badge variant="outline" className="text-[10px] border font-mono">#{issue.number}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                    {issue.body || "No description"}
                  </p>
                  {!!issue.labels?.length && (
                    <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                      {issue.labels.slice(0, 4).map((label) => (
                        <span
                          key={label.name}
                          className="rounded-full px-2 py-0.5 text-[10px] font-medium font-mono"
                          style={{
                            backgroundColor: `#${label.color}1A`,
                            color: `#${label.color}`,
                            border: `1px solid #${label.color}33`,
                          }}
                        >
                          {label.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <FileCode className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export default RepoIssues;
