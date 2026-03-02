import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, FileCode, AlertCircle, Gauge, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AnalysisSkeleton } from "@/components/SkeletonCards";
import CodeGraph from "@/components/CodeGraph";
import MarkdownBlock from "@/components/MarkdownBlock";
import { getIssue, getIssueAnalysis, getRepoGraph, type IssueAnalysisRecord, type IssueRecord, type RepoGraphRecord } from "@/lib/api";

const IssueAnalysis = () => {
  const { issueId = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const stateIssue = (location.state as { issue?: IssueRecord } | undefined)?.issue;

  const [issue, setIssue] = useState<IssueRecord | null>(stateIssue || null);
  const [analysis, setAnalysis] = useState<IssueAnalysisRecord | null>(null);
  const [repoGraph, setRepoGraph] = useState<RepoGraphRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!issueId) return;

    setIsLoading(true);
    setError(null);
    setAnalysis(null);
    setRepoGraph(null);
    setIssue(null);

    let mounted = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    const maxAttempts = 120;

    const loadIssueAndAnalysis = async () => {
      try {
        const issueRes = await getIssue(issueId);
        if (!mounted) return;
        const loadedIssue = issueRes.data || null;
        setIssue(loadedIssue);
        if (loadedIssue?.repo_id) {
          try {
            const graphRes = await getRepoGraph(loadedIssue.repo_id);
            if (mounted) setRepoGraph(graphRes.data || null);
          } catch {
            if (mounted) setRepoGraph(null);
          }
        }

        const poll = async () => {
          attempts += 1;
          if (attempts > maxAttempts) {
            setError("Timed out while waiting for analysis. Please retry.");
            setIsLoading(false);
            return;
          }

          const res = await getIssueAnalysis(issueId, { refresh: attempts === 1 });
          if (!mounted) return;

          if (res.status === "error") {
            setError(res.error || "Analysis failed. Please retry.");
            setIsLoading(false);
            return;
          }

          if (res.status === "ready" && res.data) {
            setAnalysis(res.data);
            setIsLoading(false);
            return;
          }

          timer = setTimeout(poll, 1200);
        };

        await poll();
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : "Failed to load issue analysis");
        setIsLoading(false);
      }
    };

    loadIssueAndAnalysis();

    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [issueId]);

  const topScore = analysis?.likely_paths?.[0]?.score || 1;
  const fileMap = useMemo(() => {
    if (!analysis) return [];
    return analysis.likely_paths.slice(0, 5).map((file) => ({
      path: file.path,
      relevance: Math.min(99, Math.max(1, Math.round((file.score / topScore) * 100))),
      reason: file.signals?.slice(0, 2).join(" · ") || "Local ranking evidence",
    }));
  }, [analysis, topScore]);

  if (isLoading && !analysis) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="glass-card rounded-xl p-5 mb-5">
          <div className="flex items-center gap-3 mb-4">
            <Loader2 className="h-4 w-4 text-primary animate-spin" />
            <span className="font-mono text-sm text-primary">Running local analysis (BM25 + AST) and LLM reasoning...</span>
          </div>
        </div>
        <AnalysisSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="glass-card rounded-xl p-5 font-mono text-sm text-destructive">{error}</div>
      </div>
    );
  }

  if (!analysis || !issue) return null;

  const difficulty = (analysis.difficulty || "Unknown").toLowerCase();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-5">
      <div>
        <button
          onClick={() => navigate(-1)}
          className="mb-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-mono"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>

        <div className="glass-card rounded-xl p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1 font-mono">
                <AlertCircle className="h-3.5 w-3.5 text-accent" />
                #{issue.number} · {issue.state}
              </div>
              <h1 className="text-xl font-semibold text-foreground font-mono">{issue.title}</h1>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(issue.labels || []).map((label) => (
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
            </div>
            <div className="flex items-center gap-3">
              <Badge
                variant="outline"
                className={`text-xs border font-mono ${
                  difficulty === "easy" ? "difficulty-easy" : difficulty === "medium" ? "difficulty-medium" : "difficulty-hard"
                }`}
              >
                {analysis.difficulty}
              </Badge>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground font-mono">
                <Gauge className="h-4 w-4" />
                Confidence: {Math.round((analysis.confidence_score || 0) * 100)}%
              </div>
            </div>
          </div>
        </div>
      </div>

      <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5 accent-bar pl-7">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 font-mono">Issue Body</h2>
        <MarkdownBlock
          content={issue.body || "No issue body provided."}
          className="text-sm text-foreground/85 leading-relaxed"
        />
      </motion.section>

      <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-card rounded-xl p-5 accent-bar pl-7">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 font-mono">Root Analysis</h2>
        <MarkdownBlock
          content={analysis.root_analysis || analysis.ai_summary || analysis.explanation}
          className="text-sm text-foreground/85 leading-relaxed"
        />
      </motion.section>

      <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card rounded-xl p-5">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 font-mono">Narrowed Files</h2>
        <div className="space-y-2">
          {fileMap.map((file) => (
            <div key={file.path} className="rounded-lg glass-subtle p-3">
              <div className="flex items-start gap-3">
                <FileCode className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-foreground truncate">{file.path}</span>
                    <span className="shrink-0 text-xs text-primary font-semibold font-mono">{file.relevance}%</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{file.reason}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.section>

      <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-card rounded-xl p-5 accent-bar pl-7">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 font-mono">Possible Solution</h2>
        <MarkdownBlock
          content={analysis.possible_solution || "No solution generated yet."}
          className="text-sm text-foreground/85 leading-relaxed"
        />
      </motion.section>

      {/* <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card rounded-xl p-5">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 font-mono">Repository Graph</h2>
        <CodeGraph
          nodes={repoGraph?.nodes || []}
          edges={repoGraph?.edges || []}
        />
      </motion.section> */}
    </div>
  );
};

export default IssueAnalysis;
