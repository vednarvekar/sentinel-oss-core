import { Job } from "bullmq";
import { connection } from "../queues.js";
import { githubServices } from "../../service/github.service.js";
import { cacheKeys, CacheTtlSeconds } from "../../utils/cache.keys.js";

export async function repositorySearchWorker (job: Job) {
        const {query} = job.data;
        console.log("Searching in logs for:", query);
    
        const response = await githubServices.searchRepository(query)
    
        const cachedKey = cacheKeys.repoSearch(query);

        await connection.set(cachedKey, JSON.stringify(response), "EX", CacheTtlSeconds.repoSearch)
}
