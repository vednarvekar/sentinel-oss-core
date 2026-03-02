import { db } from "./client.js"

export const saveOrUpdateIssues = async(issues: any[]) => {
    if(issues.length == 0) return;

    const values: any[] = [];
    const placeholders = issues.map((issues, index) => {
        const offset = index * 9;
        values.push(
            issues.id,
            issues.repoId,
            issues.number,
            issues.title,
            issues.body,
            issues.state,
            JSON.stringify(issues.labels || []),
            issues.createdAt,
            issues.updatedAt,
        );
        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, 
                $${offset + 4}, $${offset + 5}, $${offset + 6}, 
                $${offset + 7}, $${offset + 8}, $${offset + 9})`
    }).join(",");

    const query = `
    INSERT INTO issues
    (id, repo_id, number, title, body, state, labels, created_at, updated_at)
    VALUES ${placeholders}
    ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        body = EXCLUDED.body,
        state = EXCLUDED.state,
        labels = EXCLUDED.labels,
        updated_at = EXCLUDED.updated_at,
        ingested_at = NOW()`

    await db.query(query, values)
};

export const getIssueDataForAnalysis = async (issueId: string) => {
    const res = await db.query(`
        SELECT i.id, i.repo_id, i.title, i.body, i.labels, r.owner, r.name
        FROM issues i
        JOIN repos r ON r.id = i.repo_id
        WHERE i.id = $1`,
        [issueId]
    );
    return res.rows[0] || null;
};

export const getIssueById = async (issueId: string) => {
    const res = await db.query(
        `SELECT id, repo_id, number, title, body, state, labels, created_at, updated_at
         FROM issues
         WHERE id = $1`,
        [issueId]
    );
    return res.rows[0] || null;
};


// export const getIssueByOwnerAndName = async (owner: string, name: string) => {
//     // JOIN with repos because 'issues' table doesn't have owner/name columns
//     const result = await db.query(`
//         SELECT i.*, r.id as repo_db_id 
//         FROM issues i
//         JOIN repos r ON i.repo_id = r.id
//         WHERE r.owner = $1 AND r.name = $2
//         LIMIT 1`, 
//         [owner, name]
//     );
//     return result.rows[0] ?? null;
// };

export const getIssueCount = async (repoId: string) => {
    const res = await db.query(
        "SELECT COUNT(*) FROM issues WHERE repo_id = $1 AND state = 'open'",
        [repoId]
    );
    return Number(res.rows[0].count);
};

export const getAllIssues = async (repoId: string) => {
    const res = await db.query(
        "SELECT * FROM issues WHERE repo_id = $1 AND state = 'open' ORDER BY number DESC",
        [repoId]
    );
    return res.rows;
};

export const getLatestIssueIngest = async (repoId: string) => {
    const res = await db.query(
        "SELECT MAX(ingested_at) AS latest_ingested_at FROM issues WHERE repo_id = $1",
        [repoId]
    );
    return res.rows[0]?.latest_ingested_at ?? null;
};
