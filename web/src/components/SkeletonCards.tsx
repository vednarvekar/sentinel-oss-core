import { motion } from "framer-motion";

export const RepoCardSkeleton = () => (
  <div className="glass-card rounded-xl p-5 space-y-3">
    <div className="flex items-start justify-between">
      <div className="space-y-2 flex-1">
        <div className="h-5 w-48 skeleton-shimmer rounded-md" />
        <div className="h-4 w-72 skeleton-shimmer rounded-md" />
      </div>
      <div className="h-8 w-28 skeleton-shimmer rounded-lg" />
    </div>
    <div className="flex gap-3 pt-1">
      <div className="h-4 w-16 skeleton-shimmer rounded-full" />
      <div className="h-4 w-16 skeleton-shimmer rounded-full" />
      <div className="h-5 w-20 skeleton-shimmer rounded-full" />
    </div>
  </div>
);

export const IssueCardSkeleton = () => (
  <div className="glass-card rounded-xl p-4 space-y-3">
    <div className="flex items-start gap-3">
      <div className="h-4 w-4 skeleton-shimmer rounded-full mt-0.5 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="flex items-start justify-between">
          <div className="h-4 w-64 skeleton-shimmer rounded-md" />
          <div className="h-5 w-16 skeleton-shimmer rounded-full" />
        </div>
        <div className="h-3 w-full skeleton-shimmer rounded-md" />
        <div className="h-3 w-48 skeleton-shimmer rounded-md" />
        <div className="flex gap-2 pt-1">
          <div className="h-4 w-10 skeleton-shimmer rounded-full" />
          <div className="h-4 w-20 skeleton-shimmer rounded-full" />
          <div className="h-4 w-16 skeleton-shimmer rounded-full" />
        </div>
      </div>
    </div>
  </div>
);

export const AnalysisSkeleton = () => (
  <div className="space-y-5">
    {[1, 2, 3, 4].map((i) => (
      <motion.div
        key={i}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.1 }}
        className="glass-card rounded-xl p-5 space-y-3"
      >
        <div className="h-4 w-32 skeleton-shimmer rounded-md" />
        <div className="space-y-2">
          <div className="h-3 w-full skeleton-shimmer rounded-md" />
          <div className="h-3 w-5/6 skeleton-shimmer rounded-md" />
          <div className="h-3 w-4/6 skeleton-shimmer rounded-md" />
        </div>
      </motion.div>
    ))}
  </div>
);

export const SearchResultsSkeleton = () => (
  <div className="space-y-3">
    {[1, 2, 3].map((i) => (
      <motion.div
        key={i}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.08 }}
      >
        <RepoCardSkeleton />
      </motion.div>
    ))}
  </div>
);
