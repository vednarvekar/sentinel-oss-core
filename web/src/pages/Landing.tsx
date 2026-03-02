import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Star, GitFork, ArrowRight, GitBranch, Cpu, FileCode, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pollUntilReady, searchRepos, type RepoSearchItem } from "@/lib/api";
import CodebaseBackground from "@/components/CodebaseBackground";
import { SearchResultsSkeleton } from "@/components/SkeletonCards";

const LIVE_STEPS = [
  { text: "Mapping repository structure…", icon: Layers },
  { text: "Linking issues to source files…", icon: FileCode },
  { text: "Analyzing dependency graph…", icon: GitBranch },
  { text: "Risk clusters detected…", icon: Cpu },
  { text: "Building intelligence layer…", icon: Layers },
];

const LiveTicker = () => {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setIdx((i) => (i + 1) % LIVE_STEPS.length), 2800);
    return () => clearInterval(interval);
  }, []);

  const Icon = LIVE_STEPS[idx].icon;

  return (
    <div className="h-6 overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -16, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-center gap-2 font-mono text-sm text-muted-foreground"
        >
          <Icon className="h-3.5 w-3.5 text-primary" />
          {LIVE_STEPS[idx].text}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

const Landing = () => {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<RepoSearchItem[]>([]);
  const [showResults, setShowResults] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setIsSearching(true);
    setShowResults(true);
    setResults([]);
    try {
      const res = await pollUntilReady(() => searchRepos(query.trim()), {
        intervalMs: 900,
        maxAttempts: 12,
      });
      setResults(res?.data || []);
    } catch (error) {
      console.error(error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const formatStars = (n: number) => {
    if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
    return n.toString();
  };

  return (
    <div className="relative min-h-screen">
      <CodebaseBackground />

      {/* Gradient overlay at top */}
      <div className="pointer-events-none fixed inset-0 z-[1]" style={{ background: "var(--gradient-hero)" }} />

      {/* Hero Section */}
      <section className="relative z-10">
        <div className="relative mx-auto max-w-4xl px-4 pb-16 pt-24 md:pt-32 md:pb-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mb-6 inline-flex items-center gap-2 rounded-full glass-subtle px-4 py-1.5 text-sm text-muted-foreground"
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
              Open Source Intelligence Platform
            </motion.div>

            <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground md:text-6xl lg:text-7xl leading-[1.08]">
              Understand codebases.
              <br />
              <span className="gradient-text">Ship contributions.</span>
            </h1>

            <p className="mx-auto mt-5 max-w-xl text-balance text-lg text-secondary-foreground md:text-xl leading-relaxed">
              Sentinel maps repositories, links issues to code, and surfaces
              what matters — so you contribute with confidence.
            </p>
          </motion.div>

          {/* Search Bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mx-auto mt-10 max-w-2xl"
          >
            <div className="group relative">
              <div className="absolute -inset-1 rounded-2xl bg-primary/5 opacity-0 blur-lg transition-opacity duration-500 group-focus-within:opacity-100" />
              <div className="relative flex items-center overflow-hidden rounded-xl glass-card transition-all duration-300 focus-within:shadow-[0_0_0_1px_hsl(212_92%_62%/0.3)]">
                <Search className="ml-4 h-5 w-5 shrink-0 text-muted-foreground" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onInput={(e) => {
                    if (!e.currentTarget.value.trim()) {
                      setShowResults(false);
                      setResults([]);
                    }
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="Search a repository (e.g. facebook/react)"
                  className="h-14 flex-1 bg-transparent px-4 text-foreground placeholder:text-muted-foreground/60 focus:outline-none font-mono text-sm"
                />
                <Button
                  variant="default"
                  size="sm"
                  className="mr-2.5 font-mono text-xs"
                  onClick={handleSearch}
                  disabled={isSearching}
                >
                  {isSearching ? (
                    <span className="flex items-center gap-2">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary-foreground animate-pulse" />
                      Indexing...
                    </span>
                  ) : "Analyze"}
                </Button>
              </div>
            </div>

            {/* Live ticker under search */}
            <div className="mt-4 flex justify-center">
              <LiveTicker />
            </div>
          </motion.div>

          {/* Search Results / Skeleton */}
          <AnimatePresence>
            {showResults && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mx-auto mt-8 max-w-2xl"
              >
                {isSearching ? (
                  <SearchResultsSkeleton />
                ) : (
                  <div className="space-y-3">
                    {results.map((repo, i) => (
                      <motion.div
                        key={repo.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.08 }}
                        className="group glass-card rounded-xl p-4 hover:border-primary/30 transition-all cursor-pointer hover-glow"
                        onClick={() => navigate(`/repos/${repo.owner}/${repo.name}`)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors font-mono">
                              {repo.full_name}
                            </h3>
                            <p className="mt-1 text-sm text-muted-foreground line-clamp-1">
                              {repo.description}
                            </p>
                            <div className="mt-2.5 flex items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Star className="h-3.5 w-3.5 text-warning" />
                                {formatStars(repo.stars)}
                              </span>
                              <span className="flex items-center gap-1">
                                <GitFork className="h-3.5 w-3.5" />
                                {formatStars(repo.forks || 0)}
                              </span>
                              <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-mono">
                                {repo.language || "Unknown"}
                              </span>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" className="text-primary opacity-0 group-hover:opacity-100 transition-opacity text-xs font-mono">
                            Analyze
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* Terminal Preview Section */}
      <section className="relative z-10 border-t border-border/50 py-16">
        <div className="mx-auto max-w-4xl px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass-card rounded-xl overflow-hidden"
          >
            {/* Terminal header */}
            <div className="flex items-center gap-2 border-b border-border/50 px-4 py-3">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-destructive/70" />
                <div className="h-3 w-3 rounded-full bg-warning/70" />
                <div className="h-3 w-3 rounded-full bg-accent/70" />
              </div>
              <span className="ml-2 font-mono text-xs text-muted-foreground">sentinel-oss — issue analysis</span>
            </div>
            <div className="p-5 font-mono text-sm space-y-3">
              <TerminalLine delay={0} color="text-muted-foreground">$ sentinel analyze facebook/react#28104</TerminalLine>
              <TerminalLine delay={0.4} color="text-accent">✓ Repository indexed (14,832 files)</TerminalLine>
              <TerminalLine delay={0.8} color="text-primary">✓ Issue linked to 3 source files</TerminalLine>
              <TerminalLine delay={1.2} color="text-accent">✓ Difficulty: Medium · Risk: 34%</TerminalLine>
              <TerminalLine delay={1.6} color="text-foreground">
                Root cause: Stale closure in useEffect callback
              </TerminalLine>
              <TerminalLine delay={2.0} color="text-muted-foreground">
                → packages/react-reconciler/src/ReactFiberHooks.js <span className="text-primary">(92%)</span>
              </TerminalLine>
              <TerminalLine delay={2.4} color="text-muted-foreground">
                → packages/react/src/ReactHooks.js <span className="text-primary">(78%)</span>
              </TerminalLine>
            </div>
          </motion.div>

          {/* Stats */}
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              { value: "14,832", label: "files indexed", color: "text-primary" },
              { value: "3", label: "files linked", color: "text-accent" },
              { value: "34%", label: "risk score", color: "text-warning" },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass-card rounded-xl p-5 text-center"
              >
                <div className={`text-3xl font-bold font-mono ${stat.color}`}>{stat.value}</div>
                <div className="mt-1 text-xs text-muted-foreground uppercase tracking-wider font-mono">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

const TerminalLine = ({
  children,
  delay,
  color,
}: {
  children: React.ReactNode;
  delay: number;
  color: string;
}) => (
  <motion.div
    initial={{ opacity: 0, x: -8 }}
    whileInView={{ opacity: 1, x: 0 }}
    viewport={{ once: true }}
    transition={{ delay, duration: 0.4 }}
    className={color}
  >
    {children}
  </motion.div>
);

export default Landing;
