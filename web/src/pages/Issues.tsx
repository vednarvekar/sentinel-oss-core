import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertCircle, Search, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { mockIssues, mockRepos } from "@/lib/mock-data";
import { IssueCardSkeleton } from "@/components/SkeletonCards";

const Issues = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);

  // Simulate loading
  useState(() => {
    const timer = setTimeout(() => setIsLoading(false), 1200);
    return () => clearTimeout(timer);
  });

  const filtered = mockIssues.filter((issue) => {
    const matchesSearch =
      !search ||
      issue.title.toLowerCase().includes(search.toLowerCase()) ||
      issue.ai_summary.toLowerCase().includes(search.toLowerCase());
    const matchesDifficulty =
      difficultyFilter === "all" || issue.difficulty === difficultyFilter;
    return matchesSearch && matchesDifficulty;
  });

  const difficulties = ["all", "easy", "medium", "hard"] as const;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground font-mono flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-accent" />
          Issues
        </h1>
        <p className="text-sm text-muted-foreground font-mono mt-1">
          {mockIssues.length} open issues across analyzed repositories
        </p>
      </div>

      {/* Search & Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search issues..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg glass-card border border-border/50 bg-transparent py-2.5 pl-10 pr-4 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {difficulties.map((d) => (
            <button
              key={d}
              onClick={() => setDifficultyFilter(d)}
              className={`rounded-md px-3 py-1.5 text-xs font-mono font-medium transition-all ${
                difficultyFilter === d
                  ? "glass-card text-primary border border-primary/30"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Issue List */}
      <div className="space-y-3">
        {isLoading ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <IssueCardSkeleton />
              </motion.div>
            ))}
          </>
        ) : filtered.length === 0 ? (
          <div className="glass-card rounded-xl p-8 text-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground font-mono">
              No issues match your filters
            </p>
          </div>
        ) : (
          filtered.map((issue, i) => (
            <motion.div
              key={issue.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => navigate(`/issues/${issue.id}/analysis`)}
              className="group glass-card rounded-xl p-4 hover:border-primary/30 transition-all cursor-pointer hover-glow"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors font-mono">
                      {issue.title}
                    </h3>
                    <Badge
                      variant="outline"
                      className={`shrink-0 text-[10px] border font-mono ${
                        issue.difficulty === "easy"
                          ? "difficulty-easy"
                          : issue.difficulty === "medium"
                          ? "difficulty-medium"
                          : "difficulty-hard"
                      }`}
                    >
                      {issue.difficulty}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                    {issue.ai_summary}
                  </p>
                  <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground font-mono">
                    <span>#{issue.number}</span>
                    <span>by {issue.author}</span>
                    <span>{issue.comments} comments</span>
                    <div className="flex gap-1.5">
                      {issue.labels.map((l) => (
                        <span
                          key={l.name}
                          className="rounded-full px-2 py-0.5 text-[10px] font-medium font-mono"
                          style={{
                            backgroundColor: `#${l.color}15`,
                            color: `#${l.color}`,
                            border: `1px solid #${l.color}30`,
                          }}
                        >
                          {l.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

export default Issues;
