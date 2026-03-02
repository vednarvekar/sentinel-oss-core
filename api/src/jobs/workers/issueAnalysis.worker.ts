import { Job } from "bullmq";
import { runFullAnalysis } from "../../service/analysis.service.js";
import { getRepoFilesForAnalysis, saveIssueAnalysis } from "../../db/analysis.repo.js";
import { getIssueDataForAnalysis } from "../../db/issues.repo.js";

export async function issueAnalysisWorker(job: Job) {
    const { issueId, repoId } = job.data;

    try {
        const issue = await getIssueDataForAnalysis(String(issueId));
        if (!issue) return;

        const files = await getRepoFilesForAnalysis(repoId);

        // 🔥 Run full analysis (local + LLM)
        const result = await runFullAnalysis(issue, files);

        const matchCount = result.likelyPaths.length;
        const difficulty =
            matchCount === 0 ? "Unknown" :
            matchCount <= 3 ? "Easy" :
            matchCount <= 8 ? "Medium" : "Hard";
        const confidence =
            matchCount === 0 ? 0.1 :
            Math.min(0.95, 0.45 + Math.min(0.45, (result.likelyPaths[0]?.score ?? 0) / 20));

       await saveIssueAnalysis({
        issueId,
        likelyPaths: result.likelyPaths,
        difficulty,
        confidence,
        explanation: result.explanation,
        aiSummary: result.aiAnalysis?.summary ?? null,
        rootAnalysis: result.aiAnalysis?.root_analysis ?? result.explanation,
        possibleSolution: result.aiAnalysis?.possible_solution ?? null,
        graphData: result.graph ?? { nodes: [], edges: [] }
});

        console.log(`✅ Issue analyzed: ${issueId}`);
    } catch (err) {
        console.error("Issue Analysis Worker Error:", err);
        throw err;
    }
}
