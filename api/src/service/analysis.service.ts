import { computeSignals, IssueSignalsInput, RepoFileInput } from "../logic/analysis.logic.js";
import { analyzeWithLLM } from "./ai.service.js";

function normalizeImport(value: string): string {
    return value
        .replace(/^\.\//, "")
        .replace(/\.(ts|tsx|js|jsx|py|go)$/, "")
        .replace(/\\/g, "/")
        .toLowerCase();
}

function buildGraph(likelyPaths: Array<{
    path: string;
    imports?: string[];
    score?: number;
}>) {
    const nodes = likelyPaths.map((file, i) => ({
        id: file.path,
        label: file.path,
        rank: i + 1,
        score: file.score ?? 0,
        group: "narrowed"
    }));

    const pathLookup = new Map<string, string>();
    for (const file of likelyPaths) {
        pathLookup.set(normalizeImport(file.path), file.path);
    }

    const edges: Array<{ source: string; target: string; label: string }> = [];
    for (const file of likelyPaths) {
        const imports = Array.isArray(file.imports) ? file.imports : [];
        for (const raw of imports) {
            const norm = normalizeImport(raw);
            const target = pathLookup.get(norm) || pathLookup.get(`${norm}/index`);
            if (!target || target === file.path) continue;
            edges.push({
                source: file.path,
                target,
                label: "imports"
            });
        }
    }

    return { nodes, edges };
}

export async function runFullAnalysis(issue: IssueSignalsInput, files: RepoFileInput[]) {

    // Step 1: Local deterministic analysis
    const localResult = computeSignals(issue, files);
    const llmCandidates = localResult.likelyPaths.length
        ? localResult.likelyPaths.slice(0, 5)
        : files.slice(0, 5).map((file) => ({
            path: file.path,
            score: 0,
            signals: ["Fallback candidate"],
            snippet: file.content ? file.content.split("\n").slice(0, 20).join("\n") : null,
            imports: Array.isArray(file.imports) ? file.imports.slice(0, 20) : [],
            urls: Array.isArray(file.urls) ? file.urls.slice(0, 20) : []
        }));

    // If nothing relevant found, skip LLM
    if (!llmCandidates.length) {
        return {
            ...localResult,
            aiAnalysis: null,
            graph: { nodes: [], edges: [] }
        };
    }

    // Step 2: Send top files to LLM
    let aiAnalysis: Awaited<ReturnType<typeof analyzeWithLLM>> = null;
    try {
        aiAnalysis = await analyzeWithLLM(
            issue,
            llmCandidates
        );
    } catch (error) {
        console.error("LLM analysis failed; returning local analysis only:", error);
    }

    return {
        ...localResult,
        aiAnalysis,
        graph: buildGraph(localResult.likelyPaths)
    };
}
