import { Queue } from "bullmq";
import {Redis} from "ioredis";
import { cleanRepositories } from "./workers/cleanup.worker.js";

export const connection = new Redis({
    host: "127.0.0.1",
    port: 6379,
    maxRetriesPerRequest: null,
})

export const repoSearchQueue = new Queue("repo-search", {connection});

export const repoIngestQueue = new Queue("repo-ingest", {connection});

export const issueIngestQueue = new Queue("issue-ingest", {connection});

export const analysisQueue = new Queue("analyze-issue", {connection});

export const repoCleanupQueue = new Queue("repo-cleanup", {connection});
repoCleanupQueue.add(
  "daily-cleanup", 
  {}, 
  {
    repeat: { pattern: "0 3 * * *" },
    jobId: "cleanup-static-id", // Prevents creating duplicate schedules
    removeOnComplete: true
  }
);