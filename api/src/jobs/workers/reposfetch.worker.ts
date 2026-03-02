import { Job } from "bullmq";
import { redis } from "../../utils/redis.js";
import {
  createOrUpdateRepo,
  deleteRepoFilesByPaths,
  getRepoByOwnerAndName,
  getRepoFilePathShas,
  saveRepoFiles,
  touchRepoIngest,
} from "../../db/repos.repo.js";
import { githubServices } from "../../service/github.service.js"
import path from "node:path";
import { cacheKeys, CacheTtlSeconds } from "../../utils/cache.keys.js";
import pLimit from "p-limit";

type RepoFileMeta = {
  path: string;
  extension: string | null;
  sha: string;
};

export async function repositoryFetchWorker(job: Job) {
    const { owner, name } = job.data;
    const lockKey = cacheKeys.repoIngestLock(owner, name);
    const failureKey = cacheKeys.repoIngestFailure(owner, name);
    const ALLOWED_EXTS = ['.ts', '.js', '.tsx', '.jsx', '.py', '.go'];
    const fetchConcurrency = Math.max(1, Number(process.env.GITHUB_FILE_FETCH_CONCURRENCY || 3));

    try{    
        console.log("INGEST REPO:", owner, name);
        await redis.del(failureKey);

        const meta = await githubServices.getRepoOverviewData(owner, name);
        const defaultBranch = meta.default_branch;

        const existingRepo = await getRepoByOwnerAndName(owner, name);
        const repoId = existingRepo?.id ?? await createOrUpdateRepo(owner, name, defaultBranch);
        if (existingRepo) {
            await createOrUpdateRepo(owner, name, defaultBranch);
        }

        const headSha = await githubServices.getBranchHeadSha(owner, name, defaultBranch);
        if (existingRepo?.last_head_sha && existingRepo.last_head_sha === headSha) {
            console.log("No head commit change. Skipping file ingest.");
            await touchRepoIngest(repoId, { headSha, treeSha: existingRepo.last_tree_sha });
            return;
        }

        const tree = await githubServices.getRepoTree(owner, name, headSha);
        if(!tree.tree){
            throw new Error("No tree returned from GitHub")
        }

        const treeSha = String(tree.sha || "");
        if (existingRepo?.last_tree_sha && existingRepo.last_tree_sha === treeSha) {
            console.log("No tree change. Skipping file ingest.");
            await touchRepoIngest(repoId, { headSha, treeSha });
            return;
        }
        
        const files: RepoFileMeta[] = tree.tree
        .filter((items: any) => {
            if(items.type !== "blob") return false
            const extension = path.extname(items.path);

            return ALLOWED_EXTS.includes(extension)
        })
        .map((items:any) => ({
            path: items.path,
            extension: path.extname(items.path).slice(1),
            sha: String(items.sha || ""),
        }));

        console.log(`FILES FOUND: ${files.length}`);

        const existingFileRows = await getRepoFilePathShas(repoId);
        const existingPathToSha = new Map(existingFileRows.map((row) => [row.path, row.sha]));
        const currentTreePaths = new Set(files.map((file) => file.path));

        const changedFiles = files.filter((file) => existingPathToSha.get(file.path) !== file.sha);
        const deletedPaths = existingFileRows
            .map((row) => row.path)
            .filter((existingPath) => !currentTreePaths.has(existingPath));

        if (deletedPaths.length) {
            await deleteRepoFilesByPaths(repoId, deletedPaths);
        }

        if (!changedFiles.length) {
            console.log("No changed file blobs detected.");
            await touchRepoIngest(repoId, { headSha, treeSha });
            return;
        }

        console.log(`CHANGED FILES: ${changedFiles.length}`);

        const limit = pLimit(fetchConcurrency);
        let processed = 0;

        await Promise.all(
            changedFiles.map((file: RepoFileMeta) =>
                limit(async () => {
                    const data = await githubServices.getFileImportsAndUrls(owner, name, file.path);
                    await saveRepoFiles(repoId, [{
                        path: file.path,
                        extension: file.extension,
                        imports: data.imports,
                        urls: data.urls,
                        content: data.content,
                        sha: file.sha,
                    }]);
                    processed += 1;
                    await job.updateProgress(Math.round((processed / changedFiles.length) * 100));
                })
            )
        );

        await touchRepoIngest(repoId, { headSha, treeSha });
        await redis.del(failureKey);
        
        console.log("🏁 INGEST COMPLETE:", owner, name);

    } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown ingest error";
    await redis.set(failureKey, message, "EX", CacheTtlSeconds.repoIngestFailure);
    console.error("❌ REPO INGEST FAILED:", err);
    throw err;
  } finally {
    await redis.del(lockKey);
  }
};
