import path from "node:path";
import { db } from "./client.js";

export const createOrUpdateRepo = async(owner: string, name: string, defaultBranch: string) => {
    const result = await db.query(
        `INSERT INTO repos (owner, name, default_branch)
        VALUES ($1, $2, $3)
        ON CONFLICT (owner, name)
        DO UPDATE SET default_branch = EXCLUDED.default_branch
        RETURNING id`,
        [owner, name, defaultBranch]
    );
    return result.rows[0].id;
};

export const saveRepoFiles = async(
    repoId: string,
    fetchedFiles: {
        path: string;
        extension: string | null; 
        imports: string[];
        urls: string[];
        content: string;
        sha?: string | null;
    }[]
) => {
    if (fetchedFiles.length === 0) return;

    const values: any[] =[];
    const placeholders = fetchedFiles.map((file, i) => {
        const offset = i * 7;
        values.push(
            repoId, 
            file.path, 
            file.extension, 
            file.imports, 
            file.urls, 
            file.content,
            file.sha ?? null
        )
        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})`;
    }).join(",");

    const query = `
    INSERT INTO repo_files (repo_id, path, extension, imports, urls, content, sha)
    VALUES ${placeholders}
    ON CONFLICT (repo_id, path) DO UPDATE SET
        extension = EXCLUDED.extension,
        imports = EXCLUDED.imports,
        urls = EXCLUDED.urls,
        content = EXCLUDED.content,
        sha = EXCLUDED.sha,
        last_fetched_at = NOW()`;
    
    await db.query(query, values);
};

export const getRepoByOwnerAndName = async(owner: string, name: string) => {
    const result = await db.query(`
        SELECT id, owner, name, default_branch, ingested_at, last_head_sha, last_tree_sha
        FROM repos
        WHERE owner = $1 AND name = $2`,
        [owner, name]
    );
    return result.rows[0] ?? null;
};

export const getRepoFileCount = async (repoId: string) => {
  const res = await db.query(
    "SELECT COUNT(*) FROM repo_files WHERE repo_id = $1",
    [repoId]
  );
  return Number(res.rows[0].count);
};

export const getRepoFilePathShas = async (repoId: string) => {
    const res = await db.query(
        `SELECT path, sha
         FROM repo_files
         WHERE repo_id = $1`,
        [repoId]
    );
    return res.rows as Array<{ path: string; sha: string | null }>;
};

export const deleteRepoFilesByPaths = async (repoId: string, paths: string[]) => {
    if (!paths.length) return;
    await db.query(
        `DELETE FROM repo_files
         WHERE repo_id = $1 AND path = ANY($2::text[])`,
        [repoId, paths]
    );
};

export const touchRepoIngest = async (
    repoId: string,
    data: { headSha?: string | null; treeSha?: string | null } = {}
) => {
    await db.query(
        `UPDATE repos
         SET ingested_at = NOW(),
             last_head_sha = COALESCE($2, last_head_sha),
             last_tree_sha = COALESCE($3, last_tree_sha)
         WHERE id = $1`,
        [repoId, data.headSha ?? null, data.treeSha ?? null]
    );
};

export const getRepoGraphFiles = async (repoId: string) => {
    const res = await db.query(
        `SELECT path, imports
         FROM repo_files
         WHERE repo_id = $1`,
        [repoId]
    );
    return res.rows as Array<{ path: string; imports: string[] | null }>;
};
