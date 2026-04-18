import { Job } from "bullmq";
import { githubServices } from "../../service/github.service.js";
import { cacheKeys, CacheTtlSeconds } from "../../utils/cache.keys.js";
import { redis } from "../../utils/redis.js";

export async function repositorySearchWorker (job: Job) {
        const {query} = job.data;
        console.log("Searching in logs for:", query);

        try {
                const response = await githubServices.searchRepository(query);
                const cachedKey = cacheKeys.repoSearch(query);

                await redis.set(cachedKey, JSON.stringify(response), "EX", CacheTtlSeconds.repoSearch);
                console.log(`Repo search cached for: ${query} (${response.length} results)`);
        } catch (err) {
                console.error(`Repo search failed for "${query}":`, err);
                throw err;
        }
}
