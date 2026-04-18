import { FastifyInstance } from "fastify";
import { redis } from "../utils/redis.js";
import { analysisQueue, issueIngestQueue, repoIngestQueue, repoSearchQueue } from "../jobs/queues.js";
import { getRepoByOwnerAndName, getRepoFileCount, getRepoGraphFiles } from "../db/repos.repo.js";
import { getAllIssues, getIssueById, getIssueCount, getLatestIssueIngest, getIssueDataForAnalysis } from "../db/issues.repo.js";
import { getAnalysisResult } from "../db/analysis.repo.js";
import { cacheKeys, CacheTtlSeconds } from "../utils/cache.keys.js";

function normalizeImport(value: string): string {
    return value
        .replace(/^\.\//, "")
        .replace(/\.(ts|tsx|js|jsx|py|go)$/, "")
        .replace(/\\/g, "/")
        .toLowerCase();
}

    // ------------------------------------------------------------------------------------------------

export async function repoRoutes(server: FastifyInstance){
    server.get("/repos/search", async(request, reply) => {
        const {q} = request.query as {q?:string};

        if(!q) {
            return reply.status(400).send({error: "Missing Query"})
        }

        const cacheKey = cacheKeys.repoSearch(q);
        const normalizedQuery = q.toLowerCase().trim();

        const cached = await redis.get(cacheKey);
        if(cached){
            return {
                status: "ready",
                source: "cache",
                data: JSON.parse(cached),
            }
        }

        const jobId = `search-${normalizedQuery}`;
        const existingJob = await repoSearchQueue.getJob(jobId);
        const state = existingJob ? await existingJob.getState() : null;

        if (state !== "active" && state !== "waiting") {
            await repoSearchQueue.add("search",
                {query: q},
                { jobId, removeOnComplete: true, removeOnFail: true },
            );
        }

        return {
            status: "processing",
            source: "queue",
            data: [],
        }
    });
    
    // ------------------------------------------------------------------------------------------------
    
    server.get("/repos/:owner/:name", async (request) => {

        const { owner, name } = request.params as { owner: string; name: string };
        const failureKey = cacheKeys.repoIngestFailure(owner, name);
        const recentFailure = await redis.get(failureKey);
        if (recentFailure) {
            return {
                status: "error",
                error: `Repository ingest failed recently: ${recentFailure}. Please retry in ~90 seconds.`,
                data: null
            };
        }

        const repo = await getRepoByOwnerAndName(owner, name);
        const fileCount = repo ? await getRepoFileCount(repo.id) : 0;
        const jobId = `repository-${owner}-${name}`;

        // 1. Precise Math using UTC
        const lastIngest = repo?.ingested_at ? new Date(repo.ingested_at).getTime() : 0;
        const isStale = (Date.now() - lastIngest) > (60 * 60 * 1000); // 1 Hour
        const needsIngest = !repo || fileCount === 0 || isStale;

        if(!needsIngest){
            console.log("🔥 No Repository Ingest Needed");
        }
        
        if (needsIngest) {
            const existingJob = await repoIngestQueue.getJob(jobId);
            const state = existingJob ? await existingJob.getState() : null;
        
        // 2. If it's stale but NOT currently running, trigger it
        if (state !== 'active' && state !== 'waiting') {
            const lockKey = cacheKeys.repoIngestLock(owner, name);
            const lockAcquired = await redis.set(lockKey, "1", "EX", CacheTtlSeconds.repoIngestLock, "NX");
            if (lockAcquired === "OK") {
                if (existingJob) await existingJob.remove(); // Clear failed/old jobs
                await redis.del(failureKey);

                await repoIngestQueue.add("repo-ingest", 
                    { owner, name}, 
                    { 
                        jobId,
                        attempts: 3, 
                        backoff: { type: "exponential", delay: 5000 },
                        removeOnComplete: true,
                        removeOnFail: true
                    }
                );
                console.log("🚀 New Repository Ingest Triggered");
            }
        }
    }
    
    const hasUsableIndex = !!repo && fileCount > 0;
    return {
        status: hasUsableIndex ? "ready" : "processing",
        refreshing: hasUsableIndex && needsIngest,
        fileCount,
        data: repo
    }});

 // ------------------------------------------------------------------------------------------------

    server.get("/repos/:owner/:name/issues", async (request, reply) => {
        const { owner, name } = request.params as { owner: string; name: string };
        
        // 1. Get the Repo first
        const repo = await getRepoByOwnerAndName(owner, name);
        if (!repo) return reply.status(404).send({ error: "Repo not found" });
        
        // 2. Check current status
        const issueCount = await getIssueCount(repo.id);
        const issues = await getAllIssues(repo.id);
        const latestIssueIngestAt = await getLatestIssueIngest(repo.id);
        const lastIngest = latestIssueIngestAt ? new Date(latestIssueIngestAt).getTime() : 0;
        const isStale = (Date.now() - lastIngest) > (60 * 60 * 1000); 
        const needsIngest = issues.length === 0 || isStale;
        
        if (needsIngest) {
            const jobId = `issues-${owner}-${name}`;
            const existingJob = await issueIngestQueue.getJob(jobId);
            const state = existingJob ? await existingJob.getState() : null;
            
            if (state !== 'active' && state !== 'waiting') {
                const lockKey = cacheKeys.issueIngestLock(owner, name);
                const lockAcquired = await redis.set(lockKey, "1", "EX", CacheTtlSeconds.issueIngestLock, "NX");
                if (lockAcquired === "OK") {
                    if (existingJob) await existingJob.remove();

                    await issueIngestQueue.add("issue-ingest",
                        {
                            repoId: repo.id,
                            owner,
                            name,
                            since: latestIssueIngestAt ? new Date(latestIssueIngestAt).toISOString() : null,
                        },
                        {
                            jobId,
                            attempts: 3,
                            backoff: { type: "exponential", delay: 5000 },
                            removeOnComplete: true,
                            removeOnFail: true,
                        }
                    );
                }
            }
        }
        
        return {
            status: !needsIngest ? "ready" : "processing",
            count: issueCount,
            data: issues
        };
    });

    // ------------------------------------------------------------------------------------------------

    server.get("/repos/:repoId/graph", async (request, reply) => {
        const { repoId } = request.params as { repoId: string };
        const files = await getRepoGraphFiles(repoId);
        if (!files.length) {
            return reply.status(404).send({ error: "Repo graph not available yet" });
        }

        const nodes = files.map((file) => ({
            id: file.path,
            label: file.path,
            group: "repo"
        }));

        const lookup = new Map<string, string>();
        for (const file of files) {
            lookup.set(normalizeImport(file.path), file.path);
        }

        const edges: Array<{ source: string; target: string; label: string }> = [];
        for (const file of files) {
            const imports = Array.isArray(file.imports) ? file.imports : [];
            for (const imp of imports) {
                const norm = normalizeImport(imp);
                const target = lookup.get(norm) || lookup.get(`${norm}/index`);
                if (!target || target === file.path) continue;
                edges.push({
                    source: file.path,
                    target,
                    label: "imports"
                });
            }
        }

        return {
            status: "ready",
            data: { nodes, edges }
        };
    });

    // ------------------------------------------------------------------------------------------------

    server.get("/issues/:issueId", async (request, reply) => {
        const { issueId } = request.params as { issueId: string };
        const issue = await getIssueById(issueId);
        if (!issue) return reply.status(404).send({ error: "Issue not found" });
        return {
            status: "ready",
            data: issue
        };
    });

    // ------------------------------------------------------------------------------------------------

    server.get("/issues/:issueId/analysis", async (request, reply) => {
        const { issueId } = request.params as { issueId: string };
        const { refresh } = request.query as { refresh?: string };
        const forceRefresh = refresh === "1" || refresh === "true";
        const cacheKey = cacheKeys.issueAnalysis(issueId);

        // 1️⃣ Redis Cache
        const cached = forceRefresh ? null : await redis.get(cacheKey);
        if (cached && !forceRefresh) {
            return {
                status: "ready",
                source: "cache",
                data: JSON.parse(cached)
            };
        }

        // 2️⃣ Check DB
        const analysis = forceRefresh ? null : await getAnalysisResult(issueId);

        const isStale = analysis?.analyzed_at
            ? (Date.now() - new Date(analysis.analyzed_at).getTime()) > (60 * 60 * 1000)
            : true;

        const shouldQueue = !analysis || isStale || forceRefresh;
        if (shouldQueue) {

            const issue = await getIssueDataForAnalysis(issueId);
            if (!issue) {
                return reply.status(404).send({ error: "Issue not found" });
            }

            const jobId = `analyze-issue-${issueId}`;
            const existingJob = await analysisQueue.getJob(jobId);
            const state = existingJob ? await existingJob.getState() : null;

            if (state !== "active" && state !== "waiting") {
                if (existingJob) await existingJob.remove();
                await redis.del(cacheKey);

                await analysisQueue.add(
                    "analyze-job",
                    {
                        issueId: issue.id,
                        repoId: issue.repo_id
                    },
                    {
                        jobId,
                        attempts: 2,
                        backoff: { type: "exponential", delay: 5000 },
                        removeOnComplete: true,
                        removeOnFail: true
                    }
                );
            }

            return reply.status(202).send({
                status: "processing",
                source: "queue",
                trigger: {
                    forceRefresh,
                    stale: isStale,
                    hasExistingAnalysis: !!analysis
                }
            });
        }

        // 3️⃣ Cache DB result
        await redis.set(cacheKey, JSON.stringify(analysis), "EX", CacheTtlSeconds.issueAnalysis);

        return {
            status: "ready",
            source: "db",
            data: analysis
        };
    });

    // ------------------------------------------------------------------------------------------------

};
