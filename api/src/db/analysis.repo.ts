import { db } from "./client.js";

export const saveIssueAnalysis = async (data: {
    issueId: string;
    likelyPaths: any[];
    difficulty: string;
    confidence: number;
    explanation: string;
    aiSummary?: string | null;
    rootAnalysis?: string | null;
    possibleSolution?: string | null;
    graphData?: { nodes: any[]; edges: any[] } | null;
}) => {
    await db.query(`
        INSERT INTO issue_analysis 
        (issue_id, likely_paths, difficulty, confidence_score, explanation, ai_summary, root_analysis, possible_solution, graph_data, analyzed_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        ON CONFLICT (issue_id) DO UPDATE SET
            likely_paths = EXCLUDED.likely_paths,
            difficulty = EXCLUDED.difficulty,
            confidence_score = EXCLUDED.confidence_score,
            explanation = EXCLUDED.explanation,
            ai_summary = EXCLUDED.ai_summary,
            root_analysis = EXCLUDED.root_analysis,
            possible_solution = EXCLUDED.possible_solution,
            graph_data = EXCLUDED.graph_data,
            analyzed_at = NOW()`,
        [
            data.issueId,
            JSON.stringify(data.likelyPaths),
            data.difficulty,
            data.confidence,
            data.explanation,
            data.aiSummary ?? null,
            data.rootAnalysis ?? null,
            data.possibleSolution ?? null,
            data.graphData ? JSON.stringify(data.graphData) : null
        ]
    );
};

export const getAnalysisResult = async (issueId: string) => {
    const res = await db.query(`
        SELECT issue_id, likely_paths, difficulty, confidence_score, explanation, ai_summary, root_analysis, possible_solution, graph_data, analyzed_at
        FROM issue_analysis
        WHERE issue_id = $1`,
        [issueId]
    );
    return res.rows[0] || null;
};

export const getRepoFilesForAnalysis = async (repoId: string) => {
    const res = await db.query(`
        SELECT path, content, imports, urls, last_fetched_at
        FROM repo_files 
        WHERE repo_id = $1`,
        [repoId]
    );
    return res.rows;
};
