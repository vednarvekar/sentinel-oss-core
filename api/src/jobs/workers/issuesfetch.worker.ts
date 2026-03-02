import { Job } from "bullmq";
import { githubServices } from "../../service/github.service.js";
import { saveOrUpdateIssues } from "../../db/issues.repo.js";
import { redis } from "../../utils/redis.js";
import { cacheKeys } from "../../utils/cache.keys.js";

export async function issuesFetchWorker(job: Job) {
    const {repoId, owner, name, since} = job.data as {
        repoId: string;
        owner: string;
        name: string;
        since?: string | null;
    };
    const lockKey = cacheKeys.issueIngestLock(owner, name);
    
    try {     
        
        console.log("INGEST ISSUES:", owner, name);
        
        const issues = await githubServices.getRepoIssues(owner, name, { since: since ?? null });
        
        const filteredIssues = issues
        .filter((i: any) => !i.pull_request)
        .map((i: any) => ({
           id: i.id,
           repoId,
           number: i.number,
           title: i.title,
           body: i.body,
           state: i.state,
           labels: i.labels,
           createdAt: i.created_at,
           updatedAt: i.updated_at,
         }));
         
         await saveOrUpdateIssues(filteredIssues);
         console.log(`SUCCESS: Ingested ${filteredIssues.length} issues for ${owner}/${name}`);

        console.log(`SUCCESS: Ingested issues for ${filteredIssues.length} entries (analysis is on-demand per issue open).`);
         
    } catch (err) {
    console.error(`[Issues] FAILED for ${owner}/${name}:`, err);
    throw err;
    } finally {
      await redis.del(lockKey);
    }
}
